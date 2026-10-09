import { COUNTRIES } from '@/constants/countries';
import { COUNTRY_DATA } from '@/constants/countryData';
import { findCountryByIso2, findCountryByName, getCountryName } from '@/helpers/country';
import { all as libraryCountries, findByIso2 } from 'country-list-js';
import { describe, expect, it } from 'vitest';

// `country-list-js` is a dev dependency kept only so this suite can fail if the compact
// table (which replaced it at runtime) drifts from the library.
const libraryRows = Object.entries(libraryCountries).map(([code, record]) => ({
  code,
  name: record.name,
  currency: findByIso2(code)?.currency?.code ?? '',
}));

describe('COUNTRY_DATA parity with country-list-js', () => {
  it('lists exactly the same countries', () => {
    expect(Object.keys(COUNTRY_DATA).sort()).toEqual(libraryRows.map((r) => r.code).sort());
  });

  it.each(libraryRows)('$code is "$name" with currency "$currency"', ({ code, name, currency }) => {
    expect(COUNTRY_DATA[code]).toEqual([name, currency]);
  });

  it('has unique names, so a name resolves to one code', () => {
    const names = Object.values(COUNTRY_DATA).map(([name]) => name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('country helpers on the compact table', () => {
  it('keeps COUNTRIES sorted by name, one per code', () => {
    const names = COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(COUNTRIES).toHaveLength(libraryRows.length);
  });

  it.each([
    ['US', 'United States', 'USD'],
    ['DE', 'Germany', 'EUR'],
    ['GB', 'United Kingdom', 'GBP'],
  ])('resolves %s to %s using %s', (code, name, currency) => {
    expect(getCountryName(code)).toBe(name);
    expect(findCountryByIso2(code)?.currency?.code).toBe(currency);
  });

  it.each([['ZZ'], ['us'], [''], ['constructor'], ['__proto__'], ['toString']])(
    'does not treat "%s" as a country code',
    (code) => {
      expect(findCountryByIso2(code)).toBeUndefined();
    },
  );

  it.each([
    ['germany', 'DE'],
    ['  GERMANY ', 'DE'],
    ['United States', 'US'],
    ['united states', 'US'],
    ['Narnia', undefined],
    ['USA', undefined],
    ['', undefined],
  ])('maps the name "%s" to %s', (name, code) => {
    expect(findCountryByName(name)).toBe(code);
  });

  it('round-trips every country name back to its code', () => {
    for (const [code, [name]] of Object.entries(COUNTRY_DATA)) {
      // Names the title-casing step can't reproduce (e.g. "Bosnia and Herzegovina") are
      // unreachable by design, exactly as they were with the library.
      const titleCased = name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
      expect(findCountryByName(name)).toBe(titleCased === name ? code : undefined);
    }
  });
});
