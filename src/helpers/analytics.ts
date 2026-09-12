import { analytics as analyticsConfig } from '@/../config.json';
import { CACHE } from '@/constants/common';
import { cstorage } from '@/utils/storage';

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
 * Every event carries `$process_person_profile: false`, so PostHog stores it as
 * anonymous — no person profile is created or updated, and no person properties
 * accumulate. Callers must only pass non-identifying params.
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
 * field is always populated because {@link parseStackLine} only returns a
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
 * The `stacktrace` field of one {@link ExceptionEntry}: `type: "raw"` tells
 * PostHog these frames are unsymbolicated (parsed straight from `Error.stack`,
 * not resolved via an uploaded source map).
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
 * `STACKTRACE_FRAME_LIMIT`. Applied to the newest (most relevant) frames.
 */
const STACKTRACE_FRAME_LIMIT = 50;

/**
 * Skip any stack line longer than this. The frame regexes below backtrack, so
 * an unbounded line is a hang/DoS risk, not just noise — same rationale
 * `posthog-js`'s parser uses for its own line-length cap.
 */
const STACKTRACE_LINE_LENGTH_LIMIT = 1024;

/** Depth limit on `Error.cause` chain walking, matching `posthog-js`'s own cap. */
const MAX_CAUSE_DEPTH = 4;

/** V8/Chromium stack frame: `at fn (file:line:col)`, `at file:line:col`, or `at async fn (...)`. */
const CHROME_FRAME_PATTERN = /^\s*at\s+(?:async\s+)?(?:(.*?)\s+\()?(.*?):(\d+):(\d+)\)?\s*$/;

/** SpiderMonkey/Firefox stack frame: `fn@file:line:col`, or `@file:line:col` when anonymous. */
const GECKO_FRAME_PATTERN = /^\s*(.*?)@(.*):(\d+):(\d+)\s*$/;

/**
 * Parses one line of a raw `Error.stack` into a {@link StackFrame}, trying the
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
 * Parses a raw `Error.stack` string into PostHog-shaped frames, oldest first.
 * `Error.stack` lists the crash site first (newest frame first); PostHog's (and
 * Sentry's) `stacktrace.frames` convention is the reverse, crash site last, so
 * the parsed frames are reversed before returning. Caps at
 * {@link STACKTRACE_FRAME_LIMIT}, keeping the frames closest to the crash site
 * when a stack is longer than that.
 * @param stack - The raw `Error.stack` string.
 * @returns Parsed frames, oldest call first, crash site last.
 * @example
 * ```ts
 * parseStackFrames(new Error("boom").stack ?? "");
 * ```
 * @source
 */
function parseStackFrames(stack: string): StackFrame[] {
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
 * Builds one `$exception_list` entry per link of `error`'s `cause` chain
 * (depth-capped at {@link MAX_CAUSE_DEPTH}), matching the shape `posthog-js`'s
 * own exception builder produces. Only the outermost entry carries the
 * caller's `mechanism` — every `cause` link is reported `handled: true`,
 * since wrapping and re-throwing an error is itself a form of handling it.
 * @param error - The error to convert.
 * @param mechanism - How the outermost error was captured.
 * @param depth - Current recursion depth into the `cause` chain.
 * @returns The exception list, outermost error first.
 * @example
 * ```ts
 * buildExceptionList(new Error("outer", { cause: new Error("inner") }), {
 *   type: "generic",
 *   handled: true,
 *   synthetic: false,
 * });
 * // => [{ type: "Error", value: "outer", ... }, { type: "Error", value: "inner", ... }]
 * ```
 * @source
 */
function buildExceptionList(error: Error, mechanism: ExceptionMechanism, depth = 0): ExceptionEntry[] {
  const entry: ExceptionEntry = {
    type: error.name,
    value: error.message,
    mechanism,
    stacktrace: { type: 'raw', frames: error.stack ? parseStackFrames(error.stack) : [] },
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
 * Reads (or lazily creates and persists) the stable per-install PostHog
 * `distinct_id`. Falls back to an ephemeral id if storage is unavailable.
 * @returns The distinct id string.
 * @source
 */
async function getDistinctId(): Promise<string> {
  try {
    const stored = await cstorage.local.get(CACHE.ANALYTICS_DISTINCT_ID);
    const existing = stored[CACHE.ANALYTICS_DISTINCT_ID];
    if (typeof existing === 'string' && existing) return existing;
    const id = crypto.randomUUID();
    await cstorage.local.set({ [CACHE.ANALYTICS_DISTINCT_ID]: id });
    await dropLegacyClientId();
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Sends one anonymous event to PostHog's capture endpoint. No-op (and no network
 * call) until an API key is configured in `config.json` (`analytics`). Also a
 * no-op under Vitest (`MODE === "test"`), independent of whether the test
 * mocked this module — a safety net against real events leaking from a run
 * that skips the usual test setup. The e2e suite is deliberately *not* guarded
 * here: it intercepts and aborts these requests at the page level (see
 * `e2e/search-query.e2e.test.ts`), and asserts on them actually firing. Text
 * params are truncated to {@link PARAM_VALUE_LIMIT}; numeric params pass
 * through as numbers. Never throws.
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
  if (import.meta.env.MODE === 'test') return;
  const { apiKey, host } = analyticsConfig;
  if (!apiKey) return;
  if (!(await analyticsEnabled())) return;

  try {
    const properties: Record<string, AnalyticsValue> = {
      // Anonymous: PostHog skips person-profile creation and person-property
      // updates entirely (and bills the event at the anonymous rate).
      $process_person_profile: false,
      $lib: 'chempal-extension',
      $lib_version: __APP_VERSION__,
    };
    for (const [key, value] of Object.entries(params)) {
      // Only plain string params get the length clamp — structured properties
      // like $exception_list pass through untouched.
      properties[key] = typeof value === 'string' ? value.slice(0, PARAM_VALUE_LIMIT) : value;
    }
    // no-cors keeps this a "simple" request: no preflight, no host permission,
    // and no CORS failure mode. It also pins the body to text/plain, which the
    // capture endpoint reads as raw JSON — so never set a Content-Type header,
    // as no-cors rejects application/json outright. The API key goes in the
    // body, not the URL. keepalive lets the send complete even if the page is
    // tearing down after a crash; the response is opaque and never inspected.
    await fetch(`${host}${CAPTURE_PATH}`, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      body: JSON.stringify({
        api_key: apiKey,
        event: name,
        distinct_id: await getDistinctId(),
        properties,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Best-effort telemetry: swallow all failures.
  }
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
 * `$exception_list` (see {@link buildExceptionList}) — this flat field makes
 * the immediate cause filterable/visible without opening the stack trace.
 *
 * A caller-supplied `{ fatal: 1 }` (as `main.tsx`'s uncaught-root handler
 * passes, for an error that escaped every boundary) is reported as an
 * `onuncaughtexception` mechanism with `handled: false`; otherwise (an
 * `ErrorBoundary` catch, which rendered a fallback UI) it's `generic` with
 * `handled: true`.
 * @param error - The caught error.
 * @param params - Optional extra non-PII params.
 * @returns A promise that resolves once the send settles.
 * @example
 * ```ts
 * void trackRenderError(new Error("Cannot read x of undefined"));
 * void trackRenderError(error, { fatal: 1 }); // escaped every boundary
 * ```
 * @source
 */
export async function trackRenderError(
  error: unknown,
  params: Record<string, AnalyticsValue> = {},
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
    $exception_list: buildExceptionList(err, mechanism),
    $exception_level: 'error',
    ...params,
  });
}
