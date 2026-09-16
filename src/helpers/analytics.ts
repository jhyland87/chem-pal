import { analytics as analyticsConfig } from '@/../config.json';
import { CACHE } from '@/constants/common';
import { cstorage } from '@/utils/storage';
import { generateUuidV7 } from '@/utils/uuidv7';
import { md5 } from 'js-md5';

/**
 * Minimal PostHog reporter. Posts directly to PostHog's capture endpoint,
 * hand-crafting the request rather than loading `posthog-js` — which MV3 would
 * bar from a CDN anyway, and which drags in autocapture, session replay, and
 * remote-config fetches this extension neither wants nor can justify. Needs only
 * the project API key (a public, write-only `phc_` key), exactly like a normal
 * PostHog snippet. Events are best-effort and fire-and-forget: failures never
 * throw, and nothing is sent until an API key is configured in `config.json`
 * (`analytics`).
 *
 * `distinct_id` is derived from a small set of stable device signals (see
 * `getFingerprintDistinctId`) rather than a stored random id, so PostHog
 * builds/updates a Person for it and it survives an extension reinstall. This
 * is a coarse cohort identifier, not a strong unique-device id — see that
 * function's doc for the entropy/privacy trade-off. Every event also carries
 * a `$session_id` (see `getSessionId`) so activity within one browser
 * session groups together in PostHog.
 *
 * Render crashes are reported as a `$exception` event shaped like PostHog's own
 * `posthog-js` `captureException` output (`$exception_list`, `$exception_level`),
 * rather than a custom event name, so they land in PostHog's Error Tracking
 * product with a stack-trace viewer and automatic issue grouping. The frame
 * parser and exception-list shape are a hand-rolled port of `posthog-js`'s own
 * `packages/core/src/error-tracking` — this extension can't load that package
 * (see above), so the wire format is reproduced directly instead.
 *
 * @module analytics
 * @category Helpers
 * @source
 */

/**
 * PostHog single-event capture path, appended to the configured host.
 * @category Helpers
 * @source
 */
export const CAPTURE_PATH = '/i/v0/e/';

/**
 * Self-imposed cap on the length of a text property value, from
 * `config.json` (`analytics.paramValueLimit`). Not a PostHog limit (its
 * ceiling is ~1MB) — a privacy guard bounding how much of a search term or
 * error message can leave the device.
 * @category Helpers
 * @source
 */
export const PARAM_VALUE_LIMIT = analyticsConfig.paramValueLimit;

/**
 * Self-imposed cap on how much of a React component stack rides along in a
 * `$exception` event, from `config.json` (`analytics.componentStackLimit`).
 * Unlike JS stack frames (capped by count via `STACKTRACE_FRAME_LIMIT`),
 * a component stack is one unstructured string, so it's bounded by length.
 * @category Helpers
 * @source
 */
export const COMPONENT_STACK_LIMIT = analyticsConfig.componentStackLimit;

/**
 * Salt mixed into `getFingerprintDistinctId`'s hash, from `config.json`
 * (`analytics.fingerprintVersion`). Bump to deliberately mint a new
 * `distinct_id` for every install — e.g. if the signal set itself changes —
 * paired with its own `$create_alias` pass, the same way
 * `migrateLegacyDistinctId` handles the original random-UUID scheme.
 * @category Helpers
 * @source
 */
const FINGERPRINT_VERSION = analyticsConfig.fingerprintVersion;

/**
 * How long a `$session_id` stays valid before `getSessionId` mints a new
 * one, from `config.json` (`analytics.sessionMaxAgeMs`). Set below PostHog's
 * hard 24h UUIDv7 validity window for `$session_id` (its embedded timestamp
 * plus 24h must be after the last event's timestamp) as a safety margin.
 * @category Helpers
 * @source
 */
const SESSION_MAX_AGE_MS = analyticsConfig.sessionMaxAgeMs;

/**
 * A JSON-safe value a PostHog event property may hold — the primitives
 * {@link trackEvent} always accepted, plus arrays/objects for structured
 * properties like `$exception_list`.
 * @category Helpers
 * @source
 */
export type AnalyticsValue = string | number | boolean | AnalyticsValue[] | { [key: string]: AnalyticsValue };

/**
 * Stack-frame shape PostHog's Error Tracking product expects inside
 * `stacktrace.frames`, matching `posthog-js`'s own `StackFrame` type. Every
 * field is always populated because `parseStackLine` only returns a
 * frame once it has matched all four.
 * @category Helpers
 * @group Bug reporting
 */
interface StackFrame {
  platform: 'web:javascript';
  filename: string;
  function: string;
  lineno: number;
  colno: number;
  in_app: boolean;
  // Structural marker so this shape satisfies AnalyticsValue's object arm —
  // every property above is itself an AnalyticsValue, so this adds no laxity.
  // Also carries `chunk_id` (set via this index signature by
  // `parseStackFrames`, like `StackTrace.component_stack` below) when
  // the frame's filename matches an entry in `getFilenameToChunkIdMap`
  // — the `@posthog/rollup-plugin`-injected id of the built chunk it came
  // from, letting PostHog's server match the frame to its uploaded source map.
  [key: string]: AnalyticsValue;
}

/**
 * How an exception was captured, mirroring `posthog-js`'s `Mechanism` shape.
 * `handled` distinguishes a crash the app recovered from (a React error
 * boundary) from one that escaped every boundary; `synthetic` flags a
 * non-`Error` throw that was wrapped into an `Error` for reporting.
 * @category Helpers
 * @group Bug reporting
 */
interface ExceptionMechanism {
  type: 'generic' | 'onuncaughtexception';
  handled: boolean;
  synthetic: boolean;
  [key: string]: AnalyticsValue;
}

/**
 * The `stacktrace` field of one `ExceptionEntry`: `type: "raw"` tells
 * PostHog these frames are unsymbolicated (parsed straight from `Error.stack`,
 * not resolved via an uploaded source map). The outermost entry (the reported
 * error itself, not a `cause` link) may also carry `component_stack` — the
 * React tree that was rendering when it threw — via the index signature below.
 * @category Helpers
 * @group Bug reporting
 */
interface StackTrace {
  type: 'raw';
  frames: StackFrame[];
  [key: string]: AnalyticsValue;
}

/**
 * One exception in a PostHog `$exception_list` — either the reported error, or
 * one link of its `Error.cause` chain.
 * @category Helpers
 * @group Bug reporting
 */
interface ExceptionEntry {
  type: string;
  value: string;
  mechanism: ExceptionMechanism;
  stacktrace: StackTrace;
  [key: string]: AnalyticsValue;
}

/** Placeholder used when a stack frame's function name can't be determined. */
const UNKNOWN_FUNCTION = '?';

/**
 * Cap on parsed stack frames per exception, matching `posthog-js`'s own
 * `STACKTRACE_FRAME_LIMIT`. Applied to the newest (most relevant) frames. From
 * `config.json` (`analytics.stacktraceFrameLimit`).
 */
const STACKTRACE_FRAME_LIMIT = analyticsConfig.stacktraceFrameLimit;

/**
 * Skip any stack line longer than this. The frame regexes below backtrack, so
 * an unbounded line is a hang/DoS risk, not just noise — same rationale
 * `posthog-js`'s parser uses for its own line-length cap. From `config.json`
 * (`analytics.stacktraceLineLengthLimit`).
 */
const STACKTRACE_LINE_LENGTH_LIMIT = analyticsConfig.stacktraceLineLengthLimit;

/**
 * Depth limit on `Error.cause` chain walking, matching `posthog-js`'s own cap.
 * From `config.json` (`analytics.maxCauseDepth`).
 */
const MAX_CAUSE_DEPTH = analyticsConfig.maxCauseDepth;

/** V8/Chromium stack frame: `at fn (file:line:col)`, `at file:line:col`, or `at async fn (...)`. */
const CHROME_FRAME_PATTERN = /^\s*at\s+(?:async\s+)?(?:(.*?)\s+\()?(.*?):(\d+):(\d+)\)?\s*$/;

/** SpiderMonkey/Firefox stack frame: `fn@file:line:col`, or `@file:line:col` when anonymous. */
const GECKO_FRAME_PATTERN = /^\s*(.*?)@(.*):(\d+):(\d+)\s*$/;

/**
 * Parses one line of a raw `Error.stack` into a `StackFrame`, trying the
 * V8/Chromium frame shape first and falling back to SpiderMonkey/Firefox's —
 * ChemPal ships on both. This is a simplified port of `posthog-js`'s own
 * `chromeStackLineParser`/`geckoStackLineParser`: it skips their `eval(...)`
 * rewriting and webpack-wrapper stripping, real cases that are disproportionate
 * complexity for a hand-rolled reporter.
 * @param line - One line of a stack trace.
 * @returns The parsed frame, or `undefined` if the line isn't a stack frame
 * (e.g. the leading `Error: message` header line).
 * @example
 * ```ts
 * parseStackLine("    at trackRenderError (chrome-extension://abc/analytics.js:42:11)");
 * // => { platform: "web:javascript", filename: "chrome-extension://abc/analytics.js",
 * //      function: "trackRenderError", lineno: 42, colno: 11, in_app: true }
 * ```
 * @source
 */
function parseStackLine(line: string): StackFrame | undefined {
  const chromeMatch = CHROME_FRAME_PATTERN.exec(line);
  const geckoMatch = chromeMatch ? undefined : GECKO_FRAME_PATTERN.exec(line);
  const match = chromeMatch ?? geckoMatch;
  if (!match) return undefined;

  const [, fn, filename, lineno, colno] = match;
  return {
    platform: 'web:javascript',
    filename: filename ?? '',
    function: fn || UNKNOWN_FUNCTION,
    lineno: Number(lineno),
    colno: Number(colno),
    // Everything in a ChemPal stack runs from chrome-extension:// or
    // moz-extension:// and is ChemPal's own bundle — there's no third-party
    // script case to distinguish, unlike on a website.
    in_app: true,
  };
}

/**
 * Parses a raw `Error.stack` string into PostHog-shaped frames, oldest first,
 * without attaching `StackFrame.chunk_id`. `Error.stack` lists the crash
 * site first (newest frame first); PostHog's (and Sentry's) `stacktrace.frames`
 * convention is the reverse, crash site last, so the parsed frames are reversed
 * before returning. Caps at `STACKTRACE_FRAME_LIMIT`, keeping the frames
 * closest to the crash site when a stack is longer than that.
 *
 * Split out from `parseStackFrames` so `getFilenameToChunkIdMap` can
 * parse the tiny stacks `@posthog/rollup-plugin` records without recursing back
 * into chunk-id lookup while building the very map that lookup needs.
 * @param stack - The raw `Error.stack` string.
 * @returns Parsed frames, oldest call first, crash site last.
 * @example
 * ```ts
 * parseRawStackFrames(new Error("boom").stack ?? "");
 * ```
 * @source
 */
function parseRawStackFrames(stack: string): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const line of stack.split('\n')) {
    if (frames.length >= STACKTRACE_FRAME_LIMIT) break;
    if (line.length > STACKTRACE_LINE_LENGTH_LIMIT) continue;
    const frame = parseStackLine(line);
    if (frame) frames.push(frame);
  }
  return frames.reverse();
}

/**
 * Builds a `filename -> chunk id` map from `globalThis._posthogChunkIds`, the
 * `stack string -> chunk id` map `@posthog/rollup-plugin` injects into every
 * built chunk (a snippet that runs `new Error().stack` immediately at chunk
 * load, so the recorded stack's own frame names that chunk's file). A port of
 * `posthog-js`'s own `getFilenameToChunkIdMap` — this extension can't load
 * that package (see the module doc), so the lookup is reproduced directly.
 * Recomputed on every call rather than cached: ChemPal reports crashes, not
 * high-frequency events, so re-parsing a few dozen short stacks per report is
 * negligible, and skipping a cache avoids it ever going stale.
 * @returns `filename -> chunk id`, or `undefined` when the running build
 * injected no chunk-id map (dev/e2e builds, or a build with no
 * `POSTHOG_API_KEY`).
 * @example
 * ```ts
 * // Given globalThis._posthogChunkIds = { "Error\n  at chunk-abc.js:1:1": "id-1" }
 * getFilenameToChunkIdMap(); // => { "chunk-abc.js": "id-1" }
 * ```
 * @source
 */
function getFilenameToChunkIdMap(): Record<string, string> | undefined {
  const chunkIdsByStack = (globalThis as { _posthogChunkIds?: Record<string, string> })
    ._posthogChunkIds;
  if (!chunkIdsByStack) return undefined;

  const filenameToChunkId: Record<string, string> = {};
  for (const [stack, chunkId] of Object.entries(chunkIdsByStack)) {
    const frames = parseRawStackFrames(stack);
    // The injected snippet's own stack has only the chunk's wrapper frame (or
    // very few), all pointing at the same file — walk from the crash-site end
    // for the first frame with a filename, matching posthog-js's own search
    // order, and stop there.
    for (let i = frames.length - 1; i >= 0; i--) {
      const filename = frames[i]?.filename;
      if (filename) {
        filenameToChunkId[filename] = chunkId;
        break;
      }
    }
  }
  return filenameToChunkId;
}

/**
 * Parses a raw `Error.stack` string into PostHog-shaped frames (via
 * `parseRawStackFrames`), then attaches `StackFrame.chunk_id` to
 * every frame whose `filename` appears in `getFilenameToChunkIdMap` —
 * the step that lets PostHog's server match a captured frame to the source
 * map uploaded for the chunk it came from.
 * @param stack - The raw `Error.stack` string.
 * @returns Parsed frames, oldest call first, crash site last, chunk ids attached.
 * @example
 * ```ts
 * parseStackFrames(new Error("boom").stack ?? "");
 * ```
 * @source
 */
function parseStackFrames(stack: string): StackFrame[] {
  const frames = parseRawStackFrames(stack);
  const chunkIdMap = getFilenameToChunkIdMap();
  if (!chunkIdMap) return frames;

  for (const frame of frames) {
    const chunkId = chunkIdMap[frame.filename];
    if (chunkId) frame.chunk_id = chunkId;
  }
  return frames;
}

/**
 * Builds one `$exception_list` entry per link of `error`'s `cause` chain
 * (depth-capped at `MAX_CAUSE_DEPTH`), matching the shape `posthog-js`'s
 * own exception builder produces. Only the outermost entry carries the
 * caller's `mechanism` — every `cause` link is reported `handled: true`,
 * since wrapping and re-throwing an error is itself a form of handling it.
 * @param error - The error to convert.
 * @param mechanism - How the outermost error was captured.
 * @param depth - Current recursion depth into the `cause` chain.
 * @param componentStack - The React component stack that was rendering when
 * `error` was thrown, if known. Attached only to the outermost entry, never to
 * a `cause` link, since the stack describes where `error` itself surfaced.
 * @returns The exception list, outermost error first.
 * @example
 * ```ts
 * buildExceptionList(
 *   new Error("outer", { cause: new Error("inner") }),
 *   { type: "generic", handled: true, synthetic: false },
 *   0,
 *   "in Boom\n  in ErrorBoundary\n  in App",
 * );
 * // => [{ type: "Error", value: "outer", stacktrace: { component_stack: "in Boom...", ... } },
 * //      { type: "Error", value: "inner", ... }]
 * ```
 * @source
 */
function buildExceptionList(
  error: Error,
  mechanism: ExceptionMechanism,
  depth = 0,
  componentStack?: string,
): ExceptionEntry[] {
  const stacktrace: StackTrace = { type: 'raw', frames: error.stack ? parseStackFrames(error.stack) : [] };
  if (depth === 0 && componentStack) {
    stacktrace.component_stack = componentStack.slice(0, COMPONENT_STACK_LIMIT);
  }
  const entry: ExceptionEntry = {
    type: error.name,
    value: error.message,
    mechanism,
    stacktrace,
  };

  const cause: unknown = error.cause;
  if (depth >= MAX_CAUSE_DEPTH || !(cause instanceof Error)) {
    return [entry];
  }
  return [entry, ...buildExceptionList(cause, { type: 'generic', handled: true, synthetic: false }, depth + 1)];
}

/**
 * Whether the user has left usage analytics enabled. Defaults to `true` (on) —
 * only an explicit `shareUsageData: false` in settings opts out. Any read failure
 * also defaults to enabled.
 * @returns `true` if analytics may be sent.
 * @source
 */
async function analyticsEnabled(): Promise<boolean> {
  try {
    const stored = await cstorage.local.get(CACHE.USER_SETTINGS);
    const settings = stored[CACHE.USER_SETTINGS];
    if (settings && typeof settings === 'object') {
      return Reflect.get(settings, 'shareUsageData') !== false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Best-effort deletion of the retired GA4 client id. That id was transmitted to
 * Google, so it is deliberately not reused as the PostHog `distinct_id`; this
 * clears it instead of leaving it in local storage forever.
 * @returns A promise that resolves once the removal settles.
 * @source
 */
async function dropLegacyClientId(): Promise<void> {
  try {
    await cstorage.local.remove(CACHE.ANALYTICS_CLIENT_ID);
  } catch {
    // A stale key is harmless; never let cleanup break a send.
  }
}

/**
 * `navigator` fields `getFingerprintDistinctId` reads that are absent
 * from `lib.dom.d.ts` — Client Hints (`userAgentData`) and the Chromium-only
 * Device Memory API — widened onto the trusted global the same way
 * `bugReport.ts`'s `readUserAgent` and `hotkeys/matcher.ts`'s `isMac` already
 * do for `userAgentData`.
 * @category Helpers
 */
type NavigatorWithFingerprintSignals = Navigator & {
  userAgentData?: { platform?: string; mobile?: boolean };
  deviceMemory?: number;
};

/** Memoizes `getFingerprintDistinctId` for this JS context's lifetime. */
let cachedFingerprint: string | undefined;

/**
 * Computes the device-fingerprint `distinct_id`: a hash of a handful of
 * highly stable `navigator` signals, readable identically in the popup,
 * options page, and the service worker (no `screen`/DOM dependency). Because
 * it's a pure function of the environment rather than something stored, the
 * same physical install produces the same id before and after a reinstall —
 * `chrome.storage.local` (where the old random id lived) can be wiped with no
 * effect on it.
 *
 * This is a **coarse cohort identifier, not a strong unique-device id** —
 * deliberately low entropy. Signals were chosen to exclude anything volatile
 * (the UA version string, which churns roughly every 4 weeks on auto-update;
 * `Intl` timezone or `navigator.languages`, which drift without any user
 * action) since either would fragment the id and defeat "stable across
 * reinstall." That leaves common, stable traits — many unrelated installs
 * sharing typical hardware (e.g. "8 cores, Win32, en-US") will hash to the
 * *same* id, so PostHog will under-count unique installs, not over-count.
 * Higher-entropy techniques (canvas/WebGL/audio fingerprinting) would fix
 * that but are the specific pattern Chrome Web Store review and privacy
 * tooling scrutinize, and were deliberately ruled out, not just downweighted.
 * @returns The `fp_`-prefixed fingerprint id. Falls back to a fresh,
 * non-cached `crypto.randomUUID()` for this call only if reading `navigator`
 * somehow throws.
 * @example
 * ```ts
 * getFingerprintDistinctId(); // => "fp_3f9c2a1b..." — stable for this device
 * ```
 * @source
 */
function getFingerprintDistinctId(): string {
  if (cachedFingerprint) return cachedFingerprint;

  try {
    const nav = navigator as NavigatorWithFingerprintSignals;
    const signals = {
      fpVersion: FINGERPRINT_VERSION,
      platform: nav.userAgentData?.platform ?? nav.platform ?? '',
      mobile: nav.userAgentData?.mobile ?? false,
      cores: nav.hardwareConcurrency ?? 0,
      memory: nav.deviceMemory ?? 0,
      lang: nav.language ?? '',
    };
    cachedFingerprint = `fp_${md5(JSON.stringify(signals))}`;
    return cachedFingerprint;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * One-time migration for installs upgrading from the retired random-UUID
 * `distinct_id` scheme to the fingerprint-derived one: merges the old id into
 * the new one via PostHog's `$create_alias` event, so an existing install's
 * pre-upgrade history stays linked to its new identified Person instead of
 * being orphaned under an abandoned id. Also folds in `dropLegacyClientId`,
 * since both are one-time legacy-identity cleanups tied to the same
 * "just upgraded past an identity-scheme change" moment.
 *
 * Fires from {@link trackInstallOrUpgrade}'s `UPDATE` branch, which runs
 * exactly once per real upgrade, only in the service worker — precisely the
 * population that still has the legacy id in `chrome.storage.local`. A fresh
 * install (or a reinstall of a version that already ships this scheme) finds
 * no legacy id and no-ops, correctly landing on the same fingerprint-derived
 * Person it had before reinstalling.
 *
 * The legacy key's removal at the end **is** the idempotency guard — on the
 * next `UPDATE`, the key is already gone, so this no-ops without a separate
 * migration-flag key. Best-effort: never throws.
 * @returns A promise that resolves once the migration attempt settles.
 * @source
 */
async function migrateLegacyDistinctId(): Promise<void> {
  try {
    const stored = await cstorage.local.get(CACHE.ANALYTICS_DISTINCT_ID);
    const legacyId = stored[CACHE.ANALYTICS_DISTINCT_ID];
    if (typeof legacyId === 'string' && legacyId) {
      const fingerprintId = getFingerprintDistinctId();
      if (legacyId !== fingerprintId) {
        await postCaptureEvent({
          event: '$create_alias',
          distinct_id: legacyId,
          properties: { alias: fingerprintId },
        });
      }
      await cstorage.local.remove(CACHE.ANALYTICS_DISTINCT_ID);
    }
  } catch {
    // Best-effort: a missed migration just leaves the old id unlinked.
  }
  await dropLegacyClientId();
}

/** Shape stored under {@link CACHE.ANALYTICS_SESSION_ID} in `chrome.storage.session`. */
interface StoredSessionId {
  id: string;
  createdAt: number;
}

/** Reads the current stored session id, or `undefined` if absent/unreadable. */
async function readStoredSessionId(): Promise<StoredSessionId | undefined> {
  try {
    const stored = await cstorage.session.get(CACHE.ANALYTICS_SESSION_ID);
    const value = stored[CACHE.ANALYTICS_SESSION_ID] as StoredSessionId | undefined;
    return value && typeof value.id === 'string' && typeof value.createdAt === 'number' ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Serializes session-id creation within this JS context — see `getSessionId`. */
let sessionWriteChain: Promise<string> = Promise.resolve('');

/**
 * Reads (or creates) the current `$session_id`, mirroring `errorBuffer.ts`'s
 * read/write pattern: stored in `chrome.storage.session` (dropped when the
 * browser closes), with a fresh UUIDv7 minted when absent or older than
 * `SESSION_MAX_AGE_MS`. PostHog requires `$session_id` to be a UUIDv7,
 * not a plain random UUID — see {@link generateUuidV7}.
 *
 * Deliberately does **not** implement PostHog's normal 30-minute-idle session
 * rotation — only the browser-close and `SESSION_MAX_AGE_MS` boundaries above
 * — a simplification appropriate for ChemPal's short, bursty usage pattern.
 *
 * **Known, accepted limitation:** `sessionWriteChain` only serializes
 * writes within *this* JS context, not across the popup, options page, and
 * service worker, each of which holds its own chain. If two contexts
 * cold-start at the same instant with nothing stored yet, both may briefly
 * generate and use different ids for a single event before converging on the
 * next read. Narrow, low-stakes, and intentionally not fixed with a
 * `chrome.runtime.sendMessage`-based single-source-of-truth alternative.
 * @returns The current session's `$session_id` (a UUIDv7).
 * @example
 * ```ts
 * await getSessionId(); // => "018f4f3e-1a2b-7c3d-8e4f-5a6b7c8d9e0f"
 * ```
 * @source
 */
async function getSessionId(): Promise<string> {
  const current = await readStoredSessionId();
  if (current && Date.now() - current.createdAt < SESSION_MAX_AGE_MS) {
    return current.id;
  }

  sessionWriteChain = sessionWriteChain.then(async () => {
    // Re-check inside the chain: a concurrent call in this same context may
    // have already minted a fresh id while this one waited its turn.
    const latest = await readStoredSessionId();
    if (latest && Date.now() - latest.createdAt < SESSION_MAX_AGE_MS) {
      return latest.id;
    }
    const fresh: StoredSessionId = { id: generateUuidV7(), createdAt: Date.now() };
    try {
      await cstorage.session.set({ [CACHE.ANALYTICS_SESSION_ID]: fresh });
    } catch {
      // Best-effort: a missed persist just means the next call regenerates.
    }
    return fresh.id;
  });
  return sessionWriteChain;
}

/**
 * Whether an event should actually leave the device right now: an API key is
 * configured in `config.json` (`analytics`), this isn't a Vitest run
 * (`MODE === "test"`, independent of whether the test mocked this module —
 * a safety net against real events leaking from a run that skips the usual
 * test setup), and the user hasn't opted out. Shared by every capture path so
 * `trackEvent` can skip `getSessionId`'s storage write entirely when
 * the answer is no (an opted-out user shouldn't get session-id writes just
 * because something called `trackEvent`), and `postCaptureEvent`
 * re-checks it as the final gate right before the fetch. The e2e suite is
 * deliberately *not* covered here: it intercepts and aborts capture requests
 * at the page level (see `e2e/search-query.e2e.test.ts`) and asserts on them
 * actually firing.
 * @returns `true` if a capture request should be sent.
 * @source
 */
async function canSendAnalytics(): Promise<boolean> {
  if (import.meta.env.MODE === 'test') return false;
  if (!analyticsConfig.apiKey) return false;
  return analyticsEnabled();
}

/**
 * Fetch behind every PostHog capture send (`trackEvent` and the one-time
 * `$create_alias` migration) — re-checks `canSendAnalytics` as a final
 * gate, then posts. Never throws.
 *
 * `no-cors` keeps this a "simple" request: no preflight, no host permission,
 * and no CORS failure mode. It also pins the body to text/plain, which the
 * capture endpoint reads as raw JSON — so never set a Content-Type header, as
 * `no-cors` rejects `application/json` outright. `keepalive` lets the send
 * complete even if the page is tearing down after a crash; the response is
 * opaque and never inspected.
 * @param body - The capture-endpoint fields specific to this event
 * (`event`/`distinct_id`/`properties`, or `$create_alias`'s shape) — `api_key`
 * and `timestamp` are added here for every call.
 * @returns A promise that resolves once the send settles.
 * @source
 */
async function postCaptureEvent(body: Record<string, AnalyticsValue>): Promise<void> {
  if (!(await canSendAnalytics())) return;
  const { apiKey, host } = analyticsConfig;

  try {
    await fetch(`${host}${CAPTURE_PATH}`, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      body: JSON.stringify({
        api_key: apiKey,
        timestamp: new Date().toISOString(),
        ...body,
      }),
    });
  } catch {
    // Best-effort telemetry: swallow all failures.
  }
}

/**
 * Sends one event to PostHog's capture endpoint, identified by
 * `getFingerprintDistinctId` and tagged with the current
 * `getSessionId`. No-ops (before touching session storage) when
 * `canSendAnalytics` says not to. Text params are truncated to
 * {@link PARAM_VALUE_LIMIT}; numeric params pass through as numbers. Never
 * throws.
 * @param name - Event name (e.g. `"$exception"`).
 * @param params - Non-PII event properties.
 * @returns A promise that resolves once the send settles.
 * @example
 * ```ts
 * await trackEvent("extension_installed", { app_version: "1.8.0" });
 * ```
 * @source
 */
export async function trackEvent(name: string, params: Record<string, AnalyticsValue> = {}): Promise<void> {
  if (!(await canSendAnalytics())) return;

  const properties: Record<string, AnalyticsValue> = {
    $lib: 'chempal-extension',
    $lib_version: __APP_VERSION__,
    $session_id: await getSessionId(),
  };
  for (const [key, value] of Object.entries(params)) {
    // Only plain string params get the length clamp — structured properties
    // like $exception_list pass through untouched.
    properties[key] = typeof value === 'string' ? value.slice(0, PARAM_VALUE_LIMIT) : value;
  }
  return postCaptureEvent({
    event: name,
    distinct_id: getFingerprintDistinctId(),
    properties,
  });
}

/**
 * Reports a fresh install as `extension_installed` or a version change as
 * `extension_upgraded`, the latter carrying both the old and new version. Driven
 * by the service worker's `chrome.runtime.onInstalled` listener.
 *
 * Only `INSTALL` and `UPDATE` are reported — `CHROME_UPDATE` and
 * `SHARED_MODULE_UPDATE` mean the browser changed, not ChemPal. An `UPDATE` whose
 * `previousVersion` matches the running version is a reload of an unpacked extension
 * rather than a real upgrade, and is reported as nothing.
 *
 * Also a no-op under the e2e suite's build (`__IS_E2E_BUILD__`). Every e2e run
 * loads the extension into a fresh Chrome profile, so `onInstalled` fires for
 * real with reason `install` — unlike {@link trackEvent}'s other callers, this
 * one runs in the background service worker, whose requests the e2e suite's
 * page-level route interception can't see or abort, so it would otherwise
 * reach production PostHog.
 *
 * A real `UPDATE` also runs `migrateLegacyDistinctId` first — this is
 * the one place that fires exactly once per upgrade, only in the service
 * worker, precisely when an existing install may still have the retired
 * random-UUID `distinct_id` to migrate.
 * @param reason - The reason from `chrome.runtime.onInstalled`.
 * @param previousVersion - Version being upgraded from; Chrome supplies this only on an update.
 * @returns A promise that resolves once the send settles.
 * @example
 * ```ts
 * // sends `extension_upgraded` with { app_version: "1.9.0", previous_version: "1.8.0" }
 * await trackInstallOrUpgrade(chrome.runtime.OnInstalledReason.UPDATE, "1.8.0");
 * ```
 * @source
 */
export async function trackInstallOrUpgrade(
  reason: `${chrome.runtime.OnInstalledReason}`,
  previousVersion?: string,
): Promise<void> {
  if (__IS_E2E_BUILD__) return;
  const { INSTALL, UPDATE } = chrome.runtime.OnInstalledReason;
  if (reason !== INSTALL && reason !== UPDATE) return;
  // Reloading an unpacked extension fires onInstalled with reason "update" and
  // previousVersion equal to the version already running. Reporting that would count
  // every dev reload as an upgrade.
  if (reason === UPDATE && previousVersion === __APP_VERSION__) return;
  if (reason === UPDATE) {
    await migrateLegacyDistinctId();
  }
  const params: Record<string, string | number> = { app_version: __APP_VERSION__ };
  if (previousVersion) params.previous_version = previousVersion;
  return trackEvent(reason === INSTALL ? 'extension_installed' : 'extension_upgraded', params);
}

/**
 * Renders `cause` as a one-line, human-readable string for the flat
 * `error_cause` property — `"Name: message"` for an `Error` cause, or the
 * plain stringification of anything else a `cause` may legally be.
 * @param cause - The `Error.cause` value to describe.
 * @returns A one-line description of the cause.
 * @example
 * ```ts
 * describeCause(new TypeError("bad input")); // => "TypeError: bad input"
 * describeCause("disk full"); // => "disk full"
 * ```
 * @source
 */
function describeCause(cause: unknown): string {
  return cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
}

/**
 * Reports a React render-boundary crash to PostHog as a `$exception` event,
 * shaped like `posthog-js`'s own `captureException` output (`$exception_list`
 * with parsed stack frames, `$exception_level`), so it lands in PostHog's Error
 * Tracking product with a stack-trace viewer, per-frame file/line, and
 * automatic issue grouping. `error_name`/`error_message` are also kept as flat
 * properties alongside the structured list, for any existing dashboard built
 * on those two fields; `error_cause` is added the same way when `error.cause`
 * is set, even though the full cause chain is also walked into
 * `$exception_list` (see `buildExceptionList`) — this flat field makes
 * the immediate cause filterable/visible without opening the stack trace.
 *
 * A caller-supplied `{ fatal: 1 }` (as `main.tsx`'s uncaught-root handler
 * passes, for an error that escaped every boundary) is reported as an
 * `onuncaughtexception` mechanism with `handled: false`; otherwise (an
 * `ErrorBoundary` catch, which rendered a fallback UI) it's `generic` with
 * `handled: true`.
 * @param error - The caught error.
 * @param params - Optional extra non-PII params.
 * @param componentStack - The React component stack that was rendering when
 * `error` was thrown (from `ErrorBoundary.componentDidCatch` or the root's
 * `onCaughtError`/`onUncaughtError`), if available. Folded into the outermost
 * `$exception_list` entry's `stacktrace.component_stack` — see
 * `buildExceptionList` — rather than passed as a flat param, since it
 * belongs with the stack trace it describes.
 * @returns A promise that resolves once the send settles.
 * @example
 * ```ts
 * void trackRenderError(new Error("Cannot read x of undefined"));
 * void trackRenderError(error, { fatal: 1 }); // escaped every boundary
 * void trackRenderError(error, {}, "in Boom\n  in ErrorBoundary\n  in App");
 * ```
 * @source
 */
export async function trackRenderError(
  error: unknown,
  params: Record<string, AnalyticsValue> = {},
  componentStack?: string,
): Promise<void> {
  const isError = error instanceof Error;
  const err = isError ? error : new Error(String(error));
  const fatal = params.fatal === 1;
  const mechanism: ExceptionMechanism = {
    type: fatal ? 'onuncaughtexception' : 'generic',
    handled: !fatal,
    synthetic: !isError,
  };
  return trackEvent('$exception', {
    app_version: __APP_VERSION__,
    error_name: err.name,
    error_message: err.message,
    ...(err.cause != null ? { error_cause: describeCause(err.cause) } : {}),
    $exception_list: buildExceptionList(err, mechanism, 0, componentStack),
    $exception_level: 'error',
    ...params,
  });
}
