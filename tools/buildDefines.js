/**
 * Builds the Vite `define` map of build-time constants sourced from
 * `package.json`. Both the app build (`vite.config.ts`) and the test runner
 * (`configs/vitest.config.ts`) consume this so the `__APP_*__` globals resolve
 * identically at runtime and under test — otherwise tests hit
 * `ReferenceError: __APP_* is not defined`.
 */

import { readSection } from "./extractChangelog.js";

/**
 * Produces the `define` object mapping each build-time global to its JSON-encoded
 * value from `package.json`.
 * @param pkg - The parsed `package.json` contents.
 * @param options - Build-mode flags that vary per environment.
 * @param options.isAggregate - Whether the `aggregate` build mode is active.
 * @param options.isProd - Whether this is a production build; drives `NODE_ENV`
 *   so React/MUI ship in production mode (smaller, no dev warnings). Tests and
 *   dev builds leave it unset and get `development`.
 * @returns A `define` map ready to spread into a Vite/Vitest config.
 * @example
 * buildDefines(pkg, { isAggregate: false, isProd: true })
 * // => { 'process.env.NODE_ENV': '"production"', __APP_VERSION__: '"1.2.3"', ... }
 * @source
 */
export function buildDefines(pkg, { isAggregate = false, isProd = false, isAnalyze = false } = {}) {
  return {
    "process.env.NODE_ENV": JSON.stringify(isProd ? "production" : "development"),
    "process.env.ANALYZE": JSON.stringify(isAnalyze),
    __RESPONSE_AGGREGATE__: JSON.stringify(isAggregate),
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_REPOSITORY__: JSON.stringify(pkg.repository.url),
    __APP_NAME__: JSON.stringify(pkg.name),
    __APP_HOMEPAGE__: JSON.stringify(pkg.homepage),
    __APP_WIKI__: JSON.stringify(pkg.config.links.wiki),
    __APP_PRIVACY__: JSON.stringify(pkg.config.links.privacy),
    __APP_BUGS__: JSON.stringify(pkg.bugs.url),
    __APP_CONTRIBUTORS__: JSON.stringify(pkg.contributors),
    __GITHUB_OWNER__: JSON.stringify(pkg.config.github.owner),
    __GITHUB_REPO__: JSON.stringify(pkg.config.github.repo),
    __CHANGELOG_UNRELEASED__: JSON.stringify(readUnreleasedSection()),
    __CHANGELOG_CURRENT__: JSON.stringify(readVersionSection(pkg.version)),
  };
}

/**
 * Reads this build's own `CHANGELOG.md` section, so the extension can show
 * "what's new" after an update without a network call — the build that lands on
 * the user's machine already carries its release notes.
 * @param version - The version being built, from `package.json`.
 * @returns The raw markdown of that version's section, or `""` when absent.
 * @example
 * readVersionSection("1.3.0"); // "### Added\n\n- Update prompt: …"
 * @source
 */
function readVersionSection(version) {
  try {
    return readSection(version) ?? "";
  } catch {
    // A missing or unreadable changelog must never fail the build.
    return "";
  }
}

/**
 * Reads the `## [Unreleased]` section of `CHANGELOG.md` so the debug console can
 * preview the next release's notes exactly as users will see them. The same
 * extractor drives the release workflow, so the preview and the published notes
 * can't drift.
 *
 * Only referenced by `src/utils/debugConsole.ts`, which is a lazily-imported
 * chunk, so the text doesn't weigh on the main bundle.
 * @returns The raw markdown of the Unreleased section, or `""` when absent.
 * @example
 * readUnreleasedSection(); // "### Added\n\n- Update prompt: …"
 * @source
 */
function readUnreleasedSection() {
  try {
    return readSection("Unreleased") ?? "";
  } catch {
    // A missing or unreadable changelog must never fail the build.
    return "";
  }
}
