import { CACHE } from '@/constants/common';
import type { InstallSource, ReleaseSection, UpdateInfo } from '@/helpers/updates';
import {
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_SNOOZE_MS,
  getAvailableUpdate,
  getInstallSource,
  getReleaseNotes,
} from '@/helpers/updates';
import { cstorage } from '@/utils/storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import semver from 'semver';

/**
 * UI-owned bookkeeping persisted under {@link CACHE.UPDATE_CHECK}.
 * @group Types
 */
interface UpdateCheckState {
  /** Epoch ms of the last GitHub poll; throttles the manual-install path. */
  lastCheckedAt?: number;
  /** Newest version seen by the last successful poll. */
  latestVersion?: string;
  /** Release page for {@link UpdateCheckState.latestVersion}. */
  releaseUrl?: string;
  /** Version the user dismissed; suppresses the prompt for that version only. */
  dismissedVersion?: string;
  /** Version the user snoozed via "Later"; suppressed until {@link UpdateCheckState.snoozedUntil}. */
  snoozedVersion?: string;
  /** Epoch ms until which {@link UpdateCheckState.snoozedVersion} stays suppressed. */
  snoozedUntil?: number;
  /** The version {@link UpdateCheckState.notes} belongs to. */
  notesVersion?: string;
  /** Cached release notes, so the modal opens without a second fetch. */
  notes?: ReleaseSection[];
}

/**
 * Service-worker-owned record written under {@link CACHE.UPDATE_PENDING} when
 * Chrome stages a Web Store update.
 * @group Types
 */
interface UpdatePendingState {
  /** The staged version, as reported by `chrome.runtime.onUpdateAvailable`. */
  version: string;
  /** Epoch ms the staged update was detected. */
  detectedAt: number;
}

/**
 * An update the user should be told about.
 * @category Hooks
 * @group Types
 */
export interface UpdateNotice {
  /** The newer version, without a leading `v`. */
  version: string;
  /** How the extension was installed; decides the call to action. */
  source: InstallSource;
  /** GitHub release page; absent if the release couldn't be looked up. */
  releaseUrl?: string;
  /** Release-note highlights; empty when none could be retrieved. */
  notes: ReleaseSection[];
}

/**
 * Return shape of {@link useUpdateAvailable}.
 */
interface UseUpdateAvailable {
  /** The pending update, or `undefined` when up to date or already dismissed. */
  notice: UpdateNotice | undefined;
  /** Suppresses the prompt for {@link UpdateNotice.version} for good. */
  dismiss: () => void;
  /** Suppresses the prompt for {@link UpdateNotice.version} for {@link UPDATE_SNOOZE_MS}. */
  snooze: () => void;
  /** Reloads the extension (Web Store) or opens the release page (manual). */
  applyUpdate: () => void;
}

// Shared across hook instances and across StrictMode's double-mount, so
// concurrent callers issue one request and all observe its result.
let pollPromise: Promise<UpdateInfo | undefined> | undefined;
let notesPromise: Promise<{ releaseUrl: string; notes: ReleaseSection[] } | undefined> | undefined;

/**
 * Narrows a stored value to {@link UpdateCheckState}.
 * @param value - Raw value read from storage.
 * @returns True when the value is a plain object usable as check state.
 * @source
 */
function isUpdateCheckState(value: unknown): value is UpdateCheckState {
  return typeof value === 'object' && value !== null;
}

/**
 * Narrows a stored value to {@link UpdatePendingState}.
 * @param value - Raw value read from storage.
 * @returns True when the value carries a `version` string.
 * @source
 */
function isUpdatePendingState(value: unknown): value is UpdatePendingState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof value.version === 'string'
  );
}

/**
 * Polls GitHub once and records the outcome under {@link CACHE.UPDATE_CHECK}.
 * @param state - The current stored check state, carried forward into the write.
 * @returns The newer release, or `undefined` when up to date.
 * @source
 */
async function runPoll(state: UpdateCheckState): Promise<UpdateInfo | undefined> {
  // Stamp before the request: the popup unmounts as soon as it loses focus, and
  // an unstamped abort would re-poll on every single open, walking straight into
  // GitHub's unauthenticated rate limit.
  const pollStarted: UpdateCheckState = { ...state, lastCheckedAt: Date.now() };
  await cstorage.local.set({ [CACHE.UPDATE_CHECK]: pollStarted });

  const update = await getAvailableUpdate();
  if (!update) return undefined;

  await cstorage.local.set({
    [CACHE.UPDATE_CHECK]: {
      ...pollStarted,
      latestVersion: update.version,
      releaseUrl: update.releaseUrl,
      notesVersion: update.version,
      notes: update.notes,
    },
  });
  return update;
}

/**
 * Deduplicates concurrent polls. StrictMode's double-mount cancels the first
 * effect run before its request lands, so simply skipping the second run would
 * drop the result entirely; instead every caller awaits the same promise.
 * @param state - The current stored check state.
 * @returns The newer release, or `undefined` when up to date.
 * @source
 */
function pollOnce(state: UpdateCheckState): Promise<UpdateInfo | undefined> {
  pollPromise ??= runPoll(state).finally(() => {
    pollPromise = undefined;
  });
  return pollPromise;
}

/**
 * Returns the cached notes when they belong to `version`, so the prompt can
 * render immediately without a network round trip.
 * @param state - The stored check state.
 * @param version - The version the prompt is about.
 * @returns The cached notes and release URL, or `undefined` on a cache miss.
 * @source
 */
function readCachedNotes(
  state: UpdateCheckState,
  version: string,
): { releaseUrl?: string; notes: ReleaseSection[] } | undefined {
  if (state.notesVersion !== version || !Array.isArray(state.notes)) return undefined;
  return { releaseUrl: state.releaseUrl, notes: state.notes };
}

/**
 * Fetches the release notes for a staged Web Store update and caches them.
 * Deduplicated the same way as the poll, so two mounts share one request.
 * @param state - The stored check state, carried forward into the write.
 * @param version - The staged version to look up.
 * @returns The notes and release URL, or `undefined` if the lookup failed.
 * @source
 */
async function fetchNotesOnce(
  state: UpdateCheckState,
  version: string,
): Promise<{ releaseUrl: string; notes: ReleaseSection[] } | undefined> {
  notesPromise ??= getReleaseNotes(version).finally(() => {
    notesPromise = undefined;
  });
  const result = await notesPromise;
  if (!result) return undefined;

  await cstorage.local.set({
    [CACHE.UPDATE_CHECK]: {
      ...state,
      notesVersion: version,
      notes: result.notes,
      releaseUrl: result.releaseUrl,
    },
  });
  return result;
}

/**
 * Reports whether the prompt for `version` is currently held back — either
 * dismissed for good, or snoozed and not yet expired.
 * @param state - The stored check state carrying the dismissal/snooze.
 * @param version - The version a prompt would be about.
 * @param now - Current epoch ms, compared against the snooze expiry.
 * @returns True when `version` should not be prompted right now.
 * @source
 */
function isSuppressed(state: UpdateCheckState, version: string, now: number): boolean {
  if (version === state.dismissedVersion) return true;
  return (
    state.snoozedVersion === version &&
    typeof state.snoozedUntil === 'number' &&
    now < state.snoozedUntil
  );
}

/**
 * Determines whether `version` is newer than the running build and isn't being
 * held back by a dismissal or an active snooze.
 * @param state - The stored check state carrying the dismissal/snooze.
 * @param version - Candidate version, without a leading `v`.
 * @param now - Current epoch ms, compared against the snooze expiry.
 * @returns True when the user should be prompted about `version`.
 * @source
 */
function shouldPrompt(state: UpdateCheckState, version: string | undefined, now: number): boolean {
  if (!version || isSuppressed(state, version, now)) return false;
  const valid = semver.valid(version);
  return valid !== null && semver.gt(valid, __APP_VERSION__);
}

/**
 * Merges a suppression patch (a dismissal or a snooze) into the stored check
 * state, re-reading first so a concurrent write isn't clobbered.
 * @param patch - The fields to record, e.g. `{ dismissedVersion }`.
 * @returns Resolves once the merged state is written.
 * @source
 */
async function persistSuppression(patch: Partial<UpdateCheckState>): Promise<void> {
  const stored = await cstorage.local.get([CACHE.UPDATE_CHECK]);
  const state: UpdateCheckState = isUpdateCheckState(stored[CACHE.UPDATE_CHECK])
    ? stored[CACHE.UPDATE_CHECK]
    : {};
  // Leave UPDATE_PENDING alone — it belongs to the service worker.
  await cstorage.local.set({ [CACHE.UPDATE_CHECK]: { ...state, ...patch } });
}

/**
 * Surfaces a pending extension update, picking the right detection strategy for
 * how the extension was installed.
 *
 * On Web Store installs the browser stages the update itself and the service
 * worker records it (see `src/service-worker.ts`); this hook only reads that
 * record and watches for it live. On manual/unpacked installs it polls the
 * GitHub releases API, throttled to one request per
 * {@link UPDATE_CHECK_INTERVAL_MS} across all popup opens — the timestamp is
 * written *before* the request so a popup dismissed mid-flight can't reset the
 * throttle and walk into GitHub's unauthenticated rate limit.
 *
 * Dismissal is recorded per version, so a new release prompts again.
 * @category Hooks
 * @returns The pending {@link UpdateNotice} plus `dismiss` and `applyUpdate` actions.
 * @example
 * ```tsx
 * const { notice, dismiss, applyUpdate } = useUpdateAvailable();
 * // notice → { version: "1.3.0", source: "manual", releaseUrl: "https://github.com/…" }
 * applyUpdate(); // opens the release page
 * ```
 * @source
 */
export function useUpdateAvailable(): UseUpdateAvailable {
  const [notice, setNotice] = useState<UpdateNotice | undefined>(undefined);
  // Mirrors the stored dismissal/snooze so the storage-change listener can
  // evaluate suppression without re-reading storage on every event.
  const suppressedRef = useRef<UpdateCheckState>({});

  useEffect(() => {
    let cancelled = false;

    /** Reads stored state and decides whether to prompt, polling if due. */
    const check = async () => {
      try {
        const stored = await cstorage.local.get([CACHE.UPDATE_CHECK, CACHE.UPDATE_PENDING]);
        const state: UpdateCheckState = isUpdateCheckState(stored[CACHE.UPDATE_CHECK])
          ? stored[CACHE.UPDATE_CHECK]
          : {};
        suppressedRef.current = state;
        const now = Date.now();

        // Web Store: the browser already staged an update, so there's nothing to
        // discover — but onUpdateAvailable reports only a version, so the notes
        // still have to be looked up (once per staged version).
        if (getInstallSource() === 'webstore') {
          const pending = stored[CACHE.UPDATE_PENDING];
          if (!isUpdatePendingState(pending) || isSuppressed(state, pending.version, now)) return;

          // Show the prompt immediately; the notes fill in behind it if they
          // aren't already cached, so a slow lookup never delays the prompt.
          const cached = readCachedNotes(state, pending.version);
          if (!cancelled) {
            setNotice({
              version: pending.version,
              source: 'webstore',
              releaseUrl: cached?.releaseUrl,
              notes: cached?.notes ?? [],
            });
          }
          if (cached) return;

          const fetched = await fetchNotesOnce(state, pending.version);
          if (!cancelled && fetched) {
            setNotice({ version: pending.version, source: 'webstore', ...fetched });
          }
          return;
        }

        // Manual install, still inside the throttle window: reuse the last result.
        const elapsed = Date.now() - (state.lastCheckedAt ?? 0);
        if (elapsed < UPDATE_CHECK_INTERVAL_MS) {
          const cachedVersion = state.latestVersion;
          if (!cancelled && cachedVersion && shouldPrompt(state, cachedVersion, now)) {
            setNotice({
              version: cachedVersion,
              source: 'manual',
              releaseUrl: state.releaseUrl,
              notes: readCachedNotes(state, cachedVersion)?.notes ?? [],
            });
          }
          return;
        }

        const update = await pollOnce(state);
        if (!cancelled && update && !isSuppressed(state, update.version, now)) {
          setNotice({ ...update, source: 'manual' });
        }
      } catch (error) {
        console.error('Failed to check for updates:', { error });
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Catch a Web Store update staged while the popup is already open.
  useEffect(() => {
    if (getInstallSource() !== 'webstore') return;
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return;
      const change = changes[CACHE.UPDATE_PENDING];
      if (!change || !isUpdatePendingState(change.newValue)) return;
      if (isSuppressed(suppressedRef.current, change.newValue.version, Date.now())) return;
      // Notes are looked up by the mount effect on the next open; showing the
      // prompt without them is better than delaying it behind a fetch.
      setNotice({ version: change.newValue.version, source: 'webstore', notes: [] });
    };
    cstorage.onChanged.addListener(listener);
    return () => cstorage.onChanged.removeListener(listener);
  }, []);

  const dismiss = useCallback(() => {
    const dismissed = notice?.version;
    setNotice(undefined);
    if (!dismissed) return;
    suppressedRef.current = { ...suppressedRef.current, dismissedVersion: dismissed };
    void (async () => {
      try {
        await persistSuppression({ dismissedVersion: dismissed });
      } catch (error) {
        console.error('Failed to record update dismissal:', { error });
      }
    })();
  }, [notice]);

  const snooze = useCallback(() => {
    const snoozed = notice?.version;
    setNotice(undefined);
    if (!snoozed) return;
    const snoozedUntil = Date.now() + UPDATE_SNOOZE_MS;
    suppressedRef.current = { ...suppressedRef.current, snoozedVersion: snoozed, snoozedUntil };
    void (async () => {
      try {
        await persistSuppression({ snoozedVersion: snoozed, snoozedUntil });
      } catch (error) {
        console.error('Failed to record update snooze:', { error });
      }
    })();
  }, [notice]);

  const applyUpdate = useCallback(() => {
    if (!notice) return;
    // Reloading tears down this popup along with the extension.
    if (notice.source === 'webstore') {
      chrome.runtime.reload();
      return;
    }
    if (notice.releaseUrl) {
      chrome.tabs.create({ url: notice.releaseUrl, active: true });
    }
  }, [notice]);

  return { notice, dismiss, snooze, applyUpdate };
}
