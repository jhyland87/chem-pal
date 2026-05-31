import { Logger } from "@/utils/Logger";

/**
 * @group Helpers
 * @groupDescription Guarded wrappers around the `chrome.cookies` API for
 * seeding cookies into the browser jar and reading them back. The `Cookie`
 * request header is on the fetch-forbidden list, so suppliers cannot set
 * cookies via `this.headers`; writing them into the jar (and fetching with
 * `credentials: "include"`) is the only reliable path.
 * @source
 */

const logger = new Logger("cookies");

/**
 * Reports whether the `chrome.cookies` API is usable in the current context.
 * It is `undefined` unless the extension has the "cookies" permission and the
 * host permission for the origin, so callers guard with this to degrade
 * gracefully (dev fallback, or when a user hasn't accepted the upgraded
 * permission set yet).
 * @category Helpers
 * @returns `true` when `chrome.cookies` is available, otherwise `false`
 * @example
 * ```typescript
 * isCookiesApiAvailable() // true inside the extension, false in unit tests
 * ```
 * @source
 */
export function isCookiesApiAvailable(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.cookies);
}

/**
 * Writes a cookie into the browser cookie jar so the storefront returns it on
 * subsequent requests made with `credentials: "include"`. No-ops with a
 * warning when the API is unavailable, and swallows write failures (logging
 * them) so a failed seed never aborts the surrounding query.
 * @category Helpers
 * @param details - The `chrome.cookies.set` details (url, name, value, etc.)
 * @returns A promise that resolves once the write has been attempted
 * @example
 * ```typescript
 * await setCookie({ url: "https://shop.es-drei.de", name: "currency", value: "2" });
 * ```
 * @source
 */
export async function setCookie(details: chrome.cookies.SetDetails): Promise<void> {
  if (!isCookiesApiAvailable()) {
    logger.warn("chrome.cookies unavailable; skipping cookie set", { details });
    return;
  }
  try {
    await chrome.cookies.set(details);
  } catch (error: unknown) {
    logger.warn("Failed to set cookie", { details, error });
  }
}

/**
 * Reads every cookie the jar holds for the given URL. Useful for verifying
 * that session cookies are being stored/updated across requests. Returns an
 * empty array when the API is unavailable or the read fails.
 * @category Helpers
 * @param url - The URL whose cookies should be read
 * @returns A promise resolving to the matching cookies (empty on failure)
 * @example
 * ```typescript
 * const cookies = await getCookies("https://shop.es-drei.de");
 * console.log(cookies.find((c) => c.name === "currency")?.value); // "2"
 * ```
 * @source
 */
export async function getCookies(url: string): Promise<chrome.cookies.Cookie[]> {
  if (!isCookiesApiAvailable()) {
    logger.warn("chrome.cookies unavailable; cannot read cookies", { url });
    return [];
  }
  try {
    return await chrome.cookies.getAll({ url });
  } catch (error: unknown) {
    logger.warn("Failed to read cookies", { url, error });
    return [];
  }
}

/**
 * Reads a single named cookie for the given URL. Returns `null` when the
 * cookie is absent, the API is unavailable, or the read fails.
 * @category Helpers
 * @param url - The URL the cookie belongs to
 * @param name - The cookie name to read
 * @returns A promise resolving to the cookie, or `null`
 * @example
 * ```typescript
 * const cookie = await getCookie("https://shop.es-drei.de", "currency");
 * console.log(cookie?.value); // "2"
 * ```
 * @source
 */
export async function getCookie(
  url: string,
  name: string,
): Promise<chrome.cookies.Cookie | null> {
  if (!isCookiesApiAvailable()) {
    logger.warn("chrome.cookies unavailable; cannot read cookie", { url, name });
    return null;
  }
  try {
    return await chrome.cookies.get({ url, name });
  } catch (error: unknown) {
    logger.warn("Failed to read cookie", { url, name, error });
    return null;
  }
}
