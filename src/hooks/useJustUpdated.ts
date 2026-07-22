import { CACHE } from '@/constants/common';
import type { ReleaseSection } from '@/helpers/updates';
import { parseReleaseNotes } from '@/helpers/updates';
import { cstorage } from '@/utils/storage';
import { useCallback, useEffect, useState } from 'react';
import semver from 'semver';

/**
 * A release the user has just moved onto, with the notes that shipped in it.
 * @group Types
 * @category Hooks
 */
export interface JustUpdatedNotice {
  /** The version now running, without a leading `v`. */
  version: string;
  /** The version this profile was on before, for context. */
  previousVersion: string;
  /** Highlights from this build's own changelog section; never empty. */
  notes: ReleaseSection[];
}

/**
 * Return shape of {@link useJustUpdated}.
 */
interface UseJustUpdated {
  /** The just-installed release, or `undefined` when there's nothing to announce. */
  notice: JustUpdatedNotice | undefined;
  /** Marks the notes as seen so they don't reappear on the next open. */
  acknowledge: () => void;
}

/**
 * Announces what changed after the extension updates itself.
 *
 * Works by comparing the running `__APP_VERSION__` against the last version this
 * profile opened. The notes come from `__CHANGELOG_CURRENT__` — this build's own
 * changelog section, baked in at build time — so the prompt needs no network and
 * shows exactly the entries published for the release.
 *
 * Two cases deliberately stay silent: a **fresh install** (no previous version
 * recorded — a changelog means nothing to a first-time user) and a **downgrade
 * or re-install** of the same version. The version is recorded on first sight
 * either way, so each release announces itself at most once.
 * @returns The pending {@link JustUpdatedNotice} plus an `acknowledge` action.
 * @category Hooks
 * @example
 * ```tsx
 * const { notice, acknowledge } = useJustUpdated();
 * // after updating 1.2.0 -> 1.3.0:
 * // notice → { version: "1.3.0", previousVersion: "1.2.0", notes: [...] }
 * ```
 * @source
 */
export function useJustUpdated(): UseJustUpdated {
  const [notice, setNotice] = useState<JustUpdatedNotice | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const stored = await cstorage.local.get([CACHE.LAST_SEEN_VERSION]);
        const previousVersion = stored[CACHE.LAST_SEEN_VERSION];

        // Record the current version regardless, so this only ever fires once
        // per release even if the user closes the popup without acknowledging.
        if (previousVersion !== __APP_VERSION__) {
          await cstorage.local.set({ [CACHE.LAST_SEEN_VERSION]: __APP_VERSION__ });
        }

        // Fresh install: nothing to compare against, and no history to summarize.
        if (typeof previousVersion !== 'string') return;

        const from = semver.valid(previousVersion);
        const to = semver.valid(__APP_VERSION__);
        if (!from || !to || !semver.gt(to, from)) return;

        const notes = parseReleaseNotes(__CHANGELOG_CURRENT__);
        // With no changelog section there is nothing worth interrupting for.
        if (notes.length === 0 || cancelled) return;

        setNotice({ version: to, previousVersion: from, notes });
      } catch (error) {
        console.error('Failed to check for a just-installed update:', { error });
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const acknowledge = useCallback(() => setNotice(undefined), []);

  return { notice, acknowledge };
}
