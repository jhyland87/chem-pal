/**
 * Builds the Vite `define` map of build-time constants sourced from
 * `package.json`. Both the app build (`vite.config.ts`) and the test runner
 * (`configs/vitest.config.ts`) consume this so the `__APP_*__` globals resolve
 * identically at runtime and under test — otherwise tests hit
 * `ReferenceError: __APP_* is not defined`.
 */

/**
 * Produces the `define` object mapping each build-time global to its JSON-encoded
 * value from `package.json`.
 * @param pkg - The parsed `package.json` contents.
 * @param options - Build-mode flags that vary per environment.
 * @param options.isAggregate - Whether the `aggregate` build mode is active.
 * @returns A `define` map ready to spread into a Vite/Vitest config.
 * @example
 * buildDefines(pkg, { isAggregate: false })
 * // => { __APP_VERSION__: '"1.2.3"', __RESPONSE_AGGREGATE__: 'false', ... }
 * @source
 */
export function buildDefines(pkg, { isAggregate = false } = {}) {
  return {
    "process.env.NODE_ENV": JSON.stringify("development"),
    __RESPONSE_AGGREGATE__: JSON.stringify(isAggregate),
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_REPOSITORY__: JSON.stringify(pkg.repository.url),
    __APP_NAME__: JSON.stringify(pkg.name),
    __APP_HOMEPAGE__: JSON.stringify(pkg.homepage),
    __APP_WIKI__: JSON.stringify(pkg.config.links.wiki),
    __APP_BUGS__: JSON.stringify(pkg.bugs.url),
    __APP_CONTRIBUTORS__: JSON.stringify(pkg.contributors),
    __GITHUB_OWNER__: JSON.stringify(pkg.config.github.owner),
    __GITHUB_REPO__: JSON.stringify(pkg.config.github.repo),
  };
}
