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
 * @module analytics
 * @category Helpers
 * @source
 */

/** PostHog single-event capture path, appended to the configured host. */
const CAPTURE_PATH = '/i/v0/e/';

/**
 * Self-imposed cap on the length of a text property value. Not a PostHog limit
 * (its ceiling is ~1MB) — a privacy guard bounding how much of a search term or
 * error message can leave the device.
 */
const PARAM_VALUE_LIMIT = 100;

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
 * call) until an API key is configured in `config.json` (`analytics`). Text
 * params are truncated to 100 characters; numeric params pass through as numbers.
 * Never throws.
 * @param name - Event name (e.g. `"render_error"`).
 * @param params - Non-PII event properties.
 * @returns A promise that resolves once the send settles.
 * @example
 * ```ts
 * await trackEvent("render_error", { app_version: "1.8.0" });
 * ```
 * @source
 */
export async function trackEvent(
  name: string,
  params: Record<string, string | number> = {},
): Promise<void> {
  const { apiKey, host } = analyticsConfig;
  if (!apiKey) return;
  if (!(await analyticsEnabled())) return;

  try {
    const properties: Record<string, string | number | boolean> = {
      // Anonymous: PostHog skips person-profile creation and person-property
      // updates entirely (and bills the event at the anonymous rate).
      $process_person_profile: false,
      $lib: 'chempal-extension',
      $lib_version: __APP_VERSION__,
    };
    for (const [key, value] of Object.entries(params)) {
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
 * Reports a React render-boundary crash to PostHog as a `render_error` event with
 * a minimal, non-PII payload (app version, error name, truncated message — no
 * stack traces or user input).
 * @param error - The caught error.
 * @param params - Optional extra non-PII params.
 * @returns A promise that resolves once the send settles.
 * @example
 * ```ts
 * void trackRenderError(new Error("Cannot read x of undefined"));
 * ```
 * @source
 */
export async function trackRenderError(
  error: unknown,
  params: Record<string, string | number> = {},
): Promise<void> {
  const name = error instanceof Error ? error.name : 'Error';
  const message = error instanceof Error ? error.message : String(error);
  return trackEvent('render_error', {
    app_version: __APP_VERSION__,
    error_name: name,
    error_message: message,
    ...params,
  });
}
