/**
 * Build-time discovery of the extension's available UI locales.
 *
 * Uses Vite's `import.meta.glob` to enumerate every `src/_locales/<code>/messages.json`
 * at build time, so the set of translated languages is derived from the files that
 * actually exist rather than a hand-maintained list. Adding a new
 * `src/_locales/xx/messages.json` automatically makes `xx` appear.
 * @module
 */

// Keys are the matched file paths (contents are never loaded — we only need the
// folder names), e.g. "/src/_locales/en/messages.json".
const localeMessageFiles = import.meta.glob("/src/_locales/*/messages.json");

/**
 * The locale codes that ship a `messages.json`, sorted alphabetically.
 * Derived once at module load from the `import.meta.glob` result (static per build).
 * @example
 * ```ts
 * getAvailableLocales(); // => ["en", "pl"]
 * ```
 * @source
 */
export function getAvailableLocales(): string[] {
  return Object.keys(localeMessageFiles)
    .map((path) => /\/_locales\/([^/]+)\/messages\.json$/.exec(path)?.[1])
    .filter((code): code is string => code !== undefined)
    .sort();
}
