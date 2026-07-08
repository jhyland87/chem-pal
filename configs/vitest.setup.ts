import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { vi } from "vitest";
import enMessages from "../src/_locales/en/messages.json";

const i18nMessages = enMessages as Record<
  string,
  { message?: string; placeholders?: Record<string, { content?: string }> }
>;

/**
 * Faithful stand-in for `chrome.i18n.getMessage` placeholder substitution.
 * Resolves each `$name$` in the message from the entry's `placeholders` map,
 * whose `content` is a `$1`-style index into the substitutions array — matching
 * how Chrome fills named placeholders at runtime.
 * @param key - The message key to resolve.
 * @param substitutions - Positional substitution value(s), if any.
 * @returns The resolved message (falling back to the key when unknown).
 * @source
 */
function getMessageMock(key: string, substitutions?: string | string[]): string {
  const entry = i18nMessages[key];
  if (!entry?.message) return key;
  let message = entry.message;
  if (entry.placeholders && substitutions !== undefined) {
    const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
    for (const [name, def] of Object.entries(entry.placeholders)) {
      const match = /^\$(\d+)$/.exec(def.content ?? "");
      if (!match) continue;
      const value = subs[Number(match[1]) - 1] ?? "";
      message = message.replaceAll(`$${name}$`, value);
    }
  }
  return message;
}

// Mock specific MUI CSS file
vi.mock("@mui/x-data-grid/esm/index.css", () => ({}));

// Mock all CSS imports
vi.mock("*.css", () => ({}));
vi.mock("*.scss", () => ({}));
vi.mock("*.sass", () => ({}));
vi.mock("*.less", () => ({}));

// Suppress console methods
/**/
global.console = {
  ...global.console,
  log: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  dir: vi.fn(),
  table: vi.fn(),
  clear: vi.fn(),
};

// Replace global.fetch with a vi.fn() that throws by default
const fetchMock = vi.fn(() => {
  throw new Error(
    "All fetch calls must be mocked! Use (global.fetch as vi.Mock).mockImplementation() in your test.",
  );
});
global.fetch = fetchMock;

// Minimal chrome.i18n stub. `src/helpers/i18n.ts` binds `chrome.i18n.getMessage`
// at module-eval time, so it must exist before any component that imports it is
// loaded (jsdom has no `chrome`). getMessage resolves the real English string
// from `_locales/en/messages.json` (falling back to the key), so components
// render their true copy under test. Individual tests may still install richer
// chrome mocks (chromeStorageMock, chromeActionMock) on top of this.
const globalWithChrome = globalThis as unknown as { chrome?: typeof chrome };
globalWithChrome.chrome = {
  ...(globalWithChrome.chrome ?? {}),
  i18n: {
    getMessage: getMessageMock,
    getUILanguage: () => "en-US",
  },
} as unknown as typeof chrome;
