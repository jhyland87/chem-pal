import { useSyncExternalStore } from 'react';

/** A single translated message plus its optional positional placeholders. */
interface MessageEntry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

/** A locale's full key → entry table (the shape of a `messages.json`). */
type MessageTable = Record<string, MessageEntry>;

// Every `src/_locales/<code>/messages.json`, bundled at build time. Keys are the
// matched paths (e.g. "/src/_locales/en/messages.json"); values are the parsed
// tables. This lets us switch locale in-memory without a network fetch or a
// browser restart — unlike `chrome.i18n`, which is fixed to the browser UI language.
const rawTables = import.meta.glob<MessageTable>('/src/_locales/*/messages.json', {
  eager: true,
  import: 'default',
});

const messageTables: Record<string, MessageTable> = {};
for (const [path, table] of Object.entries(rawTables)) {
  const code = /\/_locales\/([^/]+)\/messages\.json$/.exec(path)?.[1];
  if (code) messageTables[code] = table;
}

/** Locale used for the initial render and as the fallback when a key is missing. */
const DEFAULT_LOCALE = 'en';

let currentLocale = messageTables[DEFAULT_LOCALE]
  ? DEFAULT_LOCALE
  : (Object.keys(messageTables)[0] ?? DEFAULT_LOCALE);

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
  return Object.keys(messageTables).sort();
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
 * re-renders with the new language. A locale without a bundled `messages.json`
 * falls back to the default; a no-op when the locale is unchanged.
 * @category Helpers
 * @param locale - The target locale code (e.g. `"pl"`).
 * @returns Nothing.
 * @example
 * ```ts
 * setLocale("pl"); // UI re-renders in Polish
 * ```
 * @source
 */
export function setLocale(locale: string): void {
  const next = messageTables[locale] ? locale : DEFAULT_LOCALE;
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
