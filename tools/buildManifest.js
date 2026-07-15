/**
 * Derives a browser-specific extension manifest from the shared base manifest.
 *
 * `public/manifest.json` is the single source of truth (name, version, icons,
 * CSP, and the full `host_permissions` list live there once). Chrome consumes
 * the base unchanged; Firefox needs a handful of MV3 differences applied at
 * build time so the two manifests can never drift.
 */

/** Gecko extension id — also used to pin the moz-extension UUID in E2E. */
export const GECKO_ID = "chem-pal@jhyland87";

/** Minimum Firefox version. 115 is the floor for `storage.session`. */
const FIREFOX_MIN_VERSION = "115.0";

/**
 * Transforms the shared base manifest into the manifest for a given browser
 * target. The base is never mutated — a structured clone is returned.
 *
 * Firefox differences applied:
 *  - `background.service_worker` → `background.scripts` (event page, not SW)
 *  - add `browser_specific_settings.gecko` (id + `strict_min_version`)
 *
 * @param base - The parsed `public/manifest.json` object.
 * @param target - The browser to build for; `"chrome"` returns the base as-is.
 * @returns A new manifest object tailored to `target`.
 * @example
 * ```ts
 * const ff = buildManifest(base, "firefox");
 * ff.background; // => { scripts: ["service-worker.js"] }
 * ff.browser_specific_settings.gecko.id; // => "chem-pal@jhyland87"
 * ```
 * @source
 */
export function buildManifest(base, target) {
  const manifest = structuredClone(base);

  if (target !== "firefox") {
    return manifest;
  }

  // `version_name` is Chrome-only; Firefox warns on it.
  delete manifest.version_name;

  // Service worker → background script (Firefox MV3 uses an event page).
  manifest.background = { scripts: ["service-worker.js"] };

  manifest.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: FIREFOX_MIN_VERSION,
    },
  };

  return manifest;
}
