import { useSyncExternalStore } from 'react';

import { i18n as i18nConfig } from '@/../config.json';
import { Logger } from '@/utils/Logger';

/** A single translated message plus its optional positional placeholders. */
interface MessageEntry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

/** A locale's full key → entry table (the shape of a `messages.json`). */
type MessageTable = Record<string, MessageEntry>;

const logger = new Logger('i18n');

// Locale used for the initial render and as the fallback when a key is missing;
// sourced from `config.json` (i18n.defaultLocale). Its table is bundled eagerly (below).
const DEFAULT_LOCALE = i18nConfig.defaultLocale;

// The default locale's table, bundled with the app because every other locale falls
// back to it and the first render needs it synchronously. `import.meta.glob` patterns
// must be literals, so this names `en` directly; a unit test pins it to
// `i18n.defaultLocale` in config.json.
const defaultTables = import.meta.glob<MessageTable>('/src/_locales/en/messages.json', {
  eager: true,
  import: 'default',
});

// Every other `src/_locales/<code>/messages.json` as a lazy loader, so each locale is its
// own chunk fetched from the extension package only when selected — instead of all of
// them sitting in the startup bundle. Keys are the matched paths (e.g.
// "/src/_locales/pl/messages.json"). Locale switching stays in-memory, unlike
// `chrome.i18n`, which is fixed to the browser UI language.
const lazyTables = import.meta.glob<MessageTable>(
  ['/src/_locales/*/messages.json', '!/src/_locales/en/messages.json'],
  { import: 'default' },
);

/**
 * Extracts the locale code from a `_locales` glob path.
 * @param path - A glob key such as `"/src/_locales/pl/messages.json"`.
 * @returns The locale code (`"pl"`), or `undefined` if the path doesn't match.
 * @example
 * ```ts
 * localeCodeFromPath('/src/_locales/pl/messages.json'); // => "pl"
 * ```
 * @source
 */
function localeCodeFromPath(path: string): string | undefined {
  return /\/_locales\/([^/]+)\/messages\.json$/.exec(path)?.[1];
}

// Tables available synchronously: the default locale up front, others as they load.
const messageTables: Record<string, MessageTable> = {};
for (const [path, table] of Object.entries(defaultTables)) {
  const code = localeCodeFromPath(path);
  if (code) messageTables[code] = table;
}

// Loader per lazily-bundled locale code.
const localeLoaders: Record<string, () => Promise<MessageTable>> = {};
for (const [path, load] of Object.entries(lazyTables)) {
  const code = localeCodeFromPath(path);
  if (code) localeLoaders[code] = load;
}

// Every shipped locale, loaded or not.
const availableLocales = [
  ...new Set([...Object.keys(messageTables), ...Object.keys(localeLoaders)]),
].sort();

let currentLocale = DEFAULT_LOCALE;

// The most recent locale `setLocale` was asked for; lets a slow load be discarded when a
// newer request has superseded it.
let requestedLocale = DEFAULT_LOCALE;

const listeners = new Set<() => void>();

/**
 * Substitutes `$name$` placeholders in a message using the entry's `placeholders`
 * map, whose `content` is a `$1`-style index into the substitutions array —
 * mirroring how `chrome.i18n.getMessage` fills named placeholders.
 * @param entry - The message entry to render.
 * @param substitutions - Positional substitution value(s), if any.
 * @returns The message with placeholders replaced.
 * @example
 * ```ts
 * applySubstitutions({ message: "Error: $error$", placeholders: { error: { content: "$1" } } }, ["boom"]);
 * // => "Error: boom"
 * ```
 * @source
 */
function applySubstitutions(entry: MessageEntry, substitutions?: string | string[]): string {
  if (!entry.placeholders || substitutions === undefined) return entry.message;
  const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
  let message = entry.message;
  for (const [name, def] of Object.entries(entry.placeholders)) {
    const match = /^\$(\d+)$/.exec(def.content ?? '');
    if (!match) continue;
    message = message.replaceAll(`$${name}$`, subs[Number(match[1]) - 1] ?? '');
  }
  return message;
}

/**
 * Resolves a message key against a locale, falling back to the default locale,
 * then to `chrome.i18n` (for keys only present at runtime), then the raw key.
 * @param locale - The locale to resolve against.
 * @param key - The message key.
 * @param substitutions - Positional substitution value(s), if any.
 * @returns The resolved, substituted message.
 * @example
 * ```ts
 * resolveMessage("pl", "results_retry"); // => "Ponów"
 * ```
 * @source
 */
function resolveMessage(locale: string, key: string, substitutions?: string | string[]): string {
  const entry = messageTables[locale]?.[key] ?? messageTables[DEFAULT_LOCALE]?.[key];
  if (entry) return applySubstitutions(entry, substitutions);
  if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
    return chrome.i18n.getMessage(key, substitutions);
  }
  return key;
}

/**
 * Translates a message key into the currently-active locale. Drop-in replacement
 * for `chrome.i18n.getMessage(key, subs)`, but reads the app's own locale so the
 * UI can switch language live (see {@link setLocale}).
 * @category Helpers
 * @param key - The message key, e.g. `"results_retry"`.
 * @param substitutions - Positional substitution value(s) for `$name$` placeholders.
 * @returns The translated, substituted string (or the key if unknown).
 * @example
 * ```ts
 * i18n("results_error", ["timeout"]); // => "Error: timeout" (en) / "Błąd: timeout" (pl)
 * ```
 * @source
 */
export function i18n(key: string, substitutions?: string | string[]): string {
  return resolveMessage(currentLocale, key, substitutions);
}

/**
 * The locale codes that ship a `messages.json`, sorted alphabetically.
 * @category Helpers
 * @returns The available locale codes, e.g. `["en", "pl"]`.
 * @example
 * ```ts
 * getAvailableLocales(); // => ["en", "pl"]
 * ```
 * @source
 */
export function getAvailableLocales(): string[] {
  return [...availableLocales];
}

/**
 * The currently-active locale code that {@link i18n} resolves against.
 * @category Helpers
 * @returns The active locale code, e.g. `"en"`.
 * @example
 * ```ts
 * getLocale(); // => "en"
 * ```
 * @source
 */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Switches the active UI locale and notifies subscribers so the React tree
 * re-renders with the new language. A locale that doesn't ship a `messages.json`
 * falls back to the default; a no-op when the locale is unchanged. Non-default locales
 * are loaded on demand, so the switch happens once the table has loaded; if another
 * `setLocale` call arrives meanwhile, the older one is dropped.
 * @category Helpers
 * @param locale - The target locale code (e.g. `"pl"`).
 * @returns A promise that resolves once the locale has been applied (or dropped).
 * @example
 * ```ts
 * await setLocale("pl"); // UI re-renders in Polish
 * ```
 * @source
 */
export async function setLocale(locale: string): Promise<void> {
  const next = availableLocales.includes(locale) ? locale : DEFAULT_LOCALE;
  requestedLocale = next;
  if (!messageTables[next]) {
    try {
      messageTables[next] = await localeLoaders[next]();
    } catch (error) {
      // A locale that can't load leaves the UI in its current language.
      logger.warn(`Failed to load locale "${next}":`, error);
      return;
    }
  }
  // A newer setLocale call superseded this one while the table was loading.
  if (requestedLocale !== next) return;
  if (next === currentLocale) return;
  currentLocale = next;
  for (const listener of listeners) listener();
}

/**
 * Subscribes a listener to locale changes.
 * @param listener - Called whenever the active locale changes.
 * @returns An unsubscribe function.
 * @source
 */
function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React hook that re-renders the calling component whenever the active locale
 * changes. Subscribe near the app root so a language switch cascades to the
 * whole tree; bare `i18n()` calls in descendants then resolve to the new locale.
 * @category Helpers
 * @returns The active locale code.
 * @example
 * ```tsx
 * const locale = useLocale(); // re-renders on setLocale(...)
 * ```
 * @source
 */
export function useLocale(): string {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}
