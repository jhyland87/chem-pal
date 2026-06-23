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
 *  - `side_panel` → `sidebar_action` (Firefox has no Side Panel API)
 *  - `background.service_worker` → `background.scripts` (event page, not SW)
 *  - drop the Chrome-only `sidePanel` permission
 *  - add `browser_specific_settings.gecko` (id + `strict_min_version`)
 *
 * @param base - The parsed `public/manifest.json` object.
 * @param target - The browser to build for; `"chrome"` returns the base as-is.
 * @returns A new manifest object tailored to `target`.
 * @example
 * ```ts
 * const ff = buildManifest(base, "firefox");
 * ff.sidebar_action; // => { default_panel: "index.html", default_title: "Chem Pal" }
 * ff.side_panel;     // => undefined
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

  // Side panel → sidebar.
  delete manifest.side_panel;
  manifest.sidebar_action = {
    default_panel: "index.html",
    default_title: manifest.name ?? "Chem Pal",
  };

  // Service worker → background script (Firefox MV3 uses an event page).
  manifest.background = { scripts: ["service-worker.js"] };

  // `sidePanel` permission is Chrome-only; everything else is supported.
  if (Array.isArray(manifest.permissions)) {
    manifest.permissions = manifest.permissions.filter((perm) => perm !== "sidePanel");
  }

  manifest.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: FIREFOX_MIN_VERSION,
    },
  };

  return manifest;
}
