import { CACHE } from '@/constants/common';
import { COUNTRY_DATA } from '@/constants/countryData';
import { cstorage } from '@/utils/storage';

/**
 * @category Country Helpers
 * @categoryDescription Country lookups backed by the compact `COUNTRY_DATA` table
 * (ISO 3166-1 alpha-2 code to English name and primary currency).
 * @showCategories
 * @source
 */

/**
 * Currency details attached to a country record.
 * @category Country Helpers
 */
interface CountryCurrency {
  code: string;
}

/**
 * The subset of country data that this app consumes.
 * @category Country Helpers
 */
interface CountryRecord {
  name: string;
  currency?: CountryCurrency;
}

/**
 * Looks up a country record by its two-letter ISO 3166-1 alpha-2 code. Codes are
 * case-sensitive and upper-case, as in {@link COUNTRY_DATA}.
 *
 * @category Country Helpers
 * @param iso2 - Two-letter country code (e.g. `"US"`, `"GB"`)
 * @returns The matching country record, or undefined if the code is unknown
 * @example
 * ```typescript
 * findCountryByIso2("US")?.name // "United States"
 * findCountryByIso2("US")?.currency?.code // "USD"
 * findCountryByIso2("ZZ") // undefined
 * ```
 * @source
 */
export function findCountryByIso2(iso2: string): CountryRecord | undefined {
  if (!Object.hasOwn(COUNTRY_DATA, iso2)) {
    return undefined;
  }
  const [name, currency] = COUNTRY_DATA[iso2];
  return { name, currency: currency ? { code: currency } : undefined };
}

/**
 * Narrows a string to a {@link CountryCode} by confirming {@link COUNTRY_DATA} lists it. Kept local to
 * this module (rather than importing `isCountryCode` from typeGuards) to avoid a module cycle.
 *
 * @category Country Helpers
 * @param value - The candidate ISO 3166-1 alpha-2 code
 * @returns Whether `value` is a known country code
 * @example
 * ```typescript
 * isKnownCountryCode("US") // true
 * isKnownCountryCode("ZZ") // false
 * ```
 * @source
 */
function isKnownCountryCode(value: string): value is CountryCode {
  return findCountryByIso2(value) !== undefined;
}

/**
 * Resolves the full country name for a two-letter location code.
 *
 * @category Country Helpers
 * @param location - Two-letter country code (e.g. `"US"`); undefined yields undefined
 * @returns The full country name, or undefined when the code is missing/unknown
 * @example
 * ```typescript
 * getCountryName("US") // "United States"
 * getCountryName("GB") // "United Kingdom"
 * getCountryName(undefined) // undefined
 * ```
 * @source
 */
export function getCountryName(location?: string): string | undefined {
  if (!location) {
    return undefined;
  }
  return findCountryByIso2(location)?.name;
}

/** Reverse index of {@link COUNTRY_DATA}, English name to ISO code; built on first use. */
let isoByName: ReadonlyMap<string, string> | undefined;

/**
 * Resolves a country's ISO 3166-1 alpha-2 code from its full English name. The input is
 * title-cased first, and the match is exact against the table's names, so short aliases
 * like "USA" are unknown (callers handle those separately).
 *
 * @category Country Helpers
 * @param name - A country name (any casing), e.g. `"germany"`, `"United States"`
 * @returns The matching ISO alpha-2 code, or undefined if the name is unknown
 * @example
 * ```typescript
 * findCountryByName("germany") // "DE"
 * findCountryByName("United States") // "US"
 * findCountryByName("Narnia") // undefined
 * ```
 * @source
 */
export function findCountryByName(name: string): CountryCode | undefined {
  const titleCased = name
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
  isoByName ??= new Map(
    Object.entries(COUNTRY_DATA).map(([iso2, [countryName]]) => [countryName, iso2]),
  );
  const iso2 = isoByName.get(titleCased);
  return iso2 !== undefined && isKnownCountryCode(iso2) ? iso2 : undefined;
}

/**
 * Reads the user's selected country (full name) from persisted user settings.
 * The `country` field is kept in sync with the `location` code by the settings
 * reducer, so consumers that need a full country name can read it directly.
 *
 * @category Country Helpers
 * @returns The stored country name, or undefined if unset/invalid
 * @example
 * ```typescript
 * await getUserCountryName() // "United States"
 * ```
 * @source
 */
export async function getUserCountryName(): Promise<string | undefined> {
  const stored = await cstorage.local.get([CACHE.USER_SETTINGS]);
  const settings: unknown = stored[CACHE.USER_SETTINGS];
  if (typeof settings !== 'object' || settings === null) {
    return undefined;
  }
  const country = (settings as Record<string, unknown>).country;
  return typeof country === 'string' ? country : undefined;
}
