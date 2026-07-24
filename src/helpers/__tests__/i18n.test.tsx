import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { getAvailableLocales, getLocale, i18n, setLocale, useLocale } from '@/helpers/i18n';

/** The shape of a single entry in a `messages.json` table. */
interface MessageEntry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

/** The locale used as the source of truth for key/placeholder parity. */
const REFERENCE_LOCALE = 'en';

// Load every `src/_locales/<code>/messages.json` the same way the runtime does,
// keyed by locale code, so the parity checks stay in sync with what actually ships.
const localeTables: Record<string, Record<string, MessageEntry>> = {};
for (const [path, table] of Object.entries(
  import.meta.glob<Record<string, MessageEntry>>('/src/_locales/*/messages.json', {
    eager: true,
    import: 'default',
  }),
)) {
  const code = /\/_locales\/([^/]+)\/messages\.json$/.exec(path)?.[1];
  if (code) localeTables[code] = table;
}

const referenceKeys = Object.keys(localeTables[REFERENCE_LOCALE]).sort();
const otherLocales = Object.keys(localeTables)
  .filter((code) => code !== REFERENCE_LOCALE)
  .sort();

/** A component that subscribes to the locale and renders a translated string. */
function Sample() {
  useLocale();
  return <span>{i18n('results_retry')}</span>;
}

describe('reactive i18n', () => {
  afterEach(() => {
    act(() => setLocale('en'));
  });

  it('lists the locales that ship a messages.json', () => {
    expect(getAvailableLocales()).toEqual(expect.arrayContaining(['en', 'pl']));
  });

  it('resolves and substitutes in the active locale', () => {
    setLocale('en');
    expect(i18n('results_retry')).toBe('Retry');
    expect(i18n('results_error', ['boom'])).toBe('Error: boom');

    setLocale('pl');
    expect(i18n('results_retry')).toBe('Ponów');
    expect(i18n('results_error', ['boom'])).toBe('Błąd: boom');
  });

  it('re-renders subscribed components when the locale changes (no refresh)', () => {
    setLocale('en');
    render(<Sample />);
    expect(screen.getByText('Retry')).toBeInTheDocument();

    act(() => setLocale('pl'));
    expect(screen.getByText('Ponów')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('falls back to the default locale for an unknown locale', () => {
    setLocale('xx');
    expect(getLocale()).toBe('en');
  });
});

// Pure, read-only checks over the statically loaded locale tables — no rendering
// and no shared mutable state, so this block is safe to run concurrently.
describe.concurrent('locale key parity', () => {
  it('ships more than one locale to compare', ({ expect }) => {
    expect(otherLocales.length).toBeGreaterThan(0);
    expect(getAvailableLocales()).toEqual(
      expect.arrayContaining([REFERENCE_LOCALE, ...otherLocales]),
    );
  });

  // Object rows so `.for` exposes the TestContext (and its `expect`) as the
  // second arg — `.each` does not pass context, which concurrent tests need.
  const localeRows = otherLocales.map((code) => ({ code }));

  it.for(localeRows)(
    '$code defines exactly the same keys as en (no missing, no extra)',
    ({ code }, { expect }) => {
      const keys = Object.keys(localeTables[code]).sort();
      const missing = referenceKeys.filter((key) => !(key in localeTables[code]));
      const extra = keys.filter((key) => !(key in localeTables[REFERENCE_LOCALE]));

      expect({ locale: code, missing, extra }).toEqual({ locale: code, missing: [], extra: [] });
      expect(keys).toEqual(referenceKeys);
    },
  );

  it.for(localeRows)('$code has non-empty messages for every key', ({ code }, { expect }) => {
    const empty = referenceKeys.filter((key) => !localeTables[code][key]?.message?.trim());
    expect({ locale: code, empty }).toEqual({ locale: code, empty: [] });
  });

  it.for(localeRows)(
    "$code keeps each key's placeholders block identical to en",
    ({ code }, { expect }) => {
      const mismatched = referenceKeys.filter(
        (key) =>
          JSON.stringify(localeTables[REFERENCE_LOCALE][key].placeholders ?? null) !==
          JSON.stringify(localeTables[code][key].placeholders ?? null),
      );
      expect({ locale: code, mismatched }).toEqual({ locale: code, mismatched: [] });
    },
  );

  it.for(localeRows)(
    "$code only uses placeholder tokens declared in that key's placeholders",
    ({ code }, { expect }) => {
      const orphans: string[] = [];
      for (const key of referenceKeys) {
        const entry = localeTables[code][key];
        const declared = new Set(Object.keys(entry.placeholders ?? {}));
        for (const token of entry.message.match(/\$([a-zA-Z0-9_]+)\$/g) ?? []) {
          const name = token.slice(1, -1);
          if (!declared.has(name)) orphans.push(`${key}:${token}`);
        }
      }
      expect({ locale: code, orphans }).toEqual({ locale: code, orphans: [] });
    },
  );
});
