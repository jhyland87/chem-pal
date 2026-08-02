import { analytics as analyticsConfig } from '@/../config.json';
import { CACHE } from '@/constants/common';
import { cstorage } from '@/utils/storage';

/**
 * Minimal Google Analytics 4 reporter. Posts directly to the same `/g/collect`
 * endpoint that `gtag.js` uses, hand-crafting the request rather than loading the
 * `gtag.js` library — which MV3 bans as remotely-hosted code. Needs only the
 * Measurement ID (no API secret), exactly like a normal gtag page. Events are
 * best-effort and fire-and-forget: failures never throw, and nothing is sent
 * until a Measurement ID is configured in `config.json` (`analytics`).
 *
 * The `/g/collect` wire format is undocumented but long-stable. GA4's terms
 * prohibit PII, so callers must only pass non-identifying params.
 *
 * @module analytics
 * @category Helpers
 * @source
 */

/** GA4 web collection endpoint (the one `gtag.js` posts to). */
const GA_ENDPOINT = 'https://www.google-analytics.com/g/collect';

/** Max length GA4 accepts for a text event-param value. */
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
 * Reads (or lazily creates and persists) the stable per-install GA4 client id.
 * Falls back to an ephemeral id if storage is unavailable.
 * @returns The client id string.
 * @source
 */
async function getClientId(): Promise<string> {
  try {
    const stored = await cstorage.local.get(CACHE.ANALYTICS_CLIENT_ID);
    const existing = stored[CACHE.ANALYTICS_CLIENT_ID];
    if (typeof existing === 'string' && existing) return existing;
    const id = crypto.randomUUID();
    await cstorage.local.set({ [CACHE.ANALYTICS_CLIENT_ID]: id });
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Sends one GA4 event to the `/g/collect` endpoint. No-op (and no network call)
 * until a measurement id is configured in `config.json` (`analytics`). Text
 * params go through as `ep.<key>` (truncated to GA4's limit), numeric params as
 * `epn.<key>`. Never throws.
 * @param name - GA4 event name (e.g. `"render_error"`).
 * @param params - Non-PII event parameters.
 * @returns A promise that resolves once the send settles.
 * @example
 * ```ts
 * await trackEvent("render_error", { app_version: "1.6.1" });
 * ```
 * @source
 */
export async function trackEvent(
  name: string,
  params: Record<string, string | number> = {},
): Promise<void> {
  const { measurementId } = analyticsConfig;
  if (!measurementId) return;
  if (!(await analyticsEnabled())) return;

  try {
    const query = new URLSearchParams({
      v: '2', // GA4 protocol version
      tid: measurementId, // Measurement ID
      cid: await getClientId(), // stable client id
      en: name, // event name
      _et: '1', // engagement time (ms)
    });
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'number') query.set(`epn.${key}`, String(value));
      else query.set(`ep.${key}`, value.slice(0, PARAM_VALUE_LIMIT));
    }
    // no-cors: an extension page may POST cross-origin without a host permission;
    // keepalive lets it complete even if the page is tearing down after a crash.
    await fetch(`${GA_ENDPOINT}?${query.toString()}`, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
    });
  } catch {
    // Best-effort telemetry: swallow all failures.
  }
}

/**
 * Reports a React render-boundary crash to GA4 as a `render_error` event with a
 * minimal, non-PII payload (app version, error name, truncated message — no
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
