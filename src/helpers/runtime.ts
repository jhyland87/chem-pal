/**
 * Whether ChemPal is running in Firefox, judged by its extension URL scheme.
 * @category Helpers
 * @group Runtime
 * @returns True when running as a `moz-extension://` add-on
 * @example
 * ```ts
 * isFirefoxRuntime(); // false in Chrome
 * ```
 * @source
 */
export function isFirefoxRuntime(): boolean {
  try {
    return chrome.runtime.getURL('').startsWith('moz-extension://');
  } catch {
    return false;
  }
}
