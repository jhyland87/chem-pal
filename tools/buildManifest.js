/**
 * Derives a browser-specific extension manifest from the shared base manifest.
 *
 * `public/manifest.json` is the single source of truth for the static fields
 * (name, icons, CSP, and the full `host_permissions` list live there once). The
 * extension **version** is injected from `package.json` at build time via the
 * `version` parameter — the version committed in the base manifest is only a
 * placeholder. Chrome consumes the rest of the base unchanged; Firefox needs a
 * handful of MV3 differences applied at build time so the two never drift.
 */

/** Gecko extension id — also used to pin the moz-extension UUID in E2E. */
export const GECKO_ID = "chem-pal@jhyland87";

/** Minimum Firefox version. 115 is the floor for `storage.session`. */
const FIREFOX_MIN_VERSION = "115.0";

/**
 * Transforms the shared base manifest into the manifest for a given browser
 * target. The base is never mutated — a structured clone is returned.
 *
 * The extension version is taken from `version` (the `package.json` version):
 * `version_name` keeps the full string, and Chrome's `version` is its numeric
 * portion (Chrome requires 1–4 dot-separated integers, so any `-beta.N` suffix
 * is stripped).
 *
 * Firefox differences applied:
 *  - `background.service_worker` → `background.scripts` (event page, not SW)
 *  - add `browser_specific_settings.gecko` (id + `strict_min_version`)
 *
 * @param base - The parsed `public/manifest.json` object.
 * @param target - The browser to build for; `"chrome"` returns the base as-is.
 * @param version - The `package.json` version, e.g. `"1.8.0"` or `"1.8.0-beta.1"`.
 * @returns A new manifest object tailored to `target`.
 * @example
 * ```ts
 * const ff = buildManifest(base, "firefox", "1.8.0");
 * ff.version; // => "1.8.0"
 * ff.background; // => { scripts: ["service-worker.js"] }
 * ff.browser_specific_settings.gecko.id; // => "chem-pal@jhyland87"
 * ```
 * @source
 */
export function buildManifest(base, target, version) {
  const manifest = structuredClone(base);

  // package.json is the single source of truth for the version, applied here so
  // local and CI builds never drift from it. `version_name` keeps the full string
  // (including any `-beta.N`); Chrome's `version` must be 1–4 dot-separated
  // integers, so strip any prerelease suffix.
  if (version) {
    manifest.version_name = version;
    const numeric = version.match(/^\d+(\.\d+){0,3}/)?.[0];
    if (numeric) {
      manifest.version = numeric;
    }
  }

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
