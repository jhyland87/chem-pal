import { describe, expect, it } from "vitest";

/**
 * Guards locale parity: `en` is the source of truth, and every other
 * `src/_locales/<code>/messages.json` must carry the same keys. Adding a key to `en` alone
 * silently ships an untranslated (or, for a missing key, blank) string to every non-English
 * user, which nothing else in the build catches.
 *
 * The glob mirrors the one in `helpers/i18n.ts`, so this covers exactly the set of tables
 * that get bundled — a new locale directory is picked up automatically, no edit needed here.
 */

interface Message {
  message: string;
  description?: string;
  placeholders?: Record<string, { content: string; example?: string }>;
}
type MessageTable = Record<string, Message>;

const rawTables = import.meta.glob<MessageTable>("/src/_locales/*/messages.json", {
  eager: true,
  import: "default",
});

const tables = new Map<string, MessageTable>();
for (const [path, table] of Object.entries(rawTables)) {
  const code = /\/_locales\/([^/]+)\/messages\.json$/.exec(path)?.[1];
  if (code) tables.set(code, table);
}

const SOURCE_LOCALE = "en";
const source = tables.get(SOURCE_LOCALE);
const translations = [...tables.entries()].filter(([code]) => code !== SOURCE_LOCALE);

/** Placeholder tokens (`$count$`) referenced inside a message's own text. */
function messageTokens(message: string): string[] {
  return [...message.matchAll(/\$(\w+)\$/g)].map((m) => m[1].toLowerCase()).sort();
}

describe("locale message tables", () => {
  it("loads the source locale and at least one translation", () => {
    // Guards the glob itself: if the path or bundler behavior changed, every
    // it.each below would silently register zero cases and the suite would pass.
    expect(source).toBeDefined();
    expect(Object.keys(source ?? {}).length).toBeGreaterThan(0);
    expect(translations.length).toBeGreaterThan(0);
  });

  describe.each(translations)("%s", (code, table) => {
    const sourceKeys = Object.keys(source ?? {});

    it("has no keys missing from en", () => {
      const missing = sourceKeys.filter((key) => !(key in table));
      expect(missing, `${code} is missing ${missing.length} key(s) present in en`).toEqual([]);
    });

    it("has no keys that en does not", () => {
      // Catches a key that was renamed in en but left behind here, which would
      // otherwise linger as dead weight forever.
      const orphaned = Object.keys(table).filter((key) => !(key in (source ?? {})));
      expect(orphaned, `${code} has ${orphaned.length} key(s) not in en`).toEqual([]);
    });

    it("has a non-empty message for every key", () => {
      const blank = Object.entries(table)
        .filter(([, entry]) => typeof entry?.message !== "string" || entry.message.trim() === "")
        .map(([key]) => key);
      expect(blank, `${code} has ${blank.length} blank message(s)`).toEqual([]);
    });

    it("declares the same placeholders as en", () => {
      // A translation that drops a placeholder declaration breaks substitution at
      // runtime — the value renders as a literal "$count$" or vanishes.
      const mismatched = sourceKeys
        .filter((key) => key in table)
        .filter((key) => {
          const expected = Object.keys(source?.[key]?.placeholders ?? {}).sort();
          const actual = Object.keys(table[key]?.placeholders ?? {}).sort();
          return expected.join() !== actual.join();
        });
      expect(mismatched, `${code} placeholder declarations differ from en`).toEqual([]);
    });

    it("references the same placeholder tokens in its message text", () => {
      // Declaring a placeholder isn't enough — the translated string has to actually
      // use it, or the interpolated value never appears.
      const mismatched = sourceKeys
        .filter((key) => key in table)
        .filter((key) => {
          const expected = messageTokens(source?.[key]?.message ?? "");
          const actual = messageTokens(table[key]?.message ?? "");
          return expected.join() !== actual.join();
        });
      expect(mismatched, `${code} message text uses different $tokens$ than en`).toEqual([]);
    });
  });
});
