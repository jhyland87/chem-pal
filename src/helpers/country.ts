import { CACHE } from "@/constants/common";
import { cstorage } from "@/utils/storage";
import { findByIso2, findByName } from "country-list-js";

/**
 * @category Country Helpers
 * @categoryDescription Country lookups backed by the `country-list-js` library,
 * wrapped so callers get typed results instead of the library's `any`.
 * @showCategories
 * @source
 */

/**
 * @category Country Helpers
 * Currency details attached to a country record from `country-list-js`.
 */
interface CountryCurrency {
  code: string;
  symbol: string;
  decimal: string;
}

/**
 * The subset of a `country-list-js` country record that this app consumes.
 */
interface CountryRecord {
  name: string;
  currency?: CountryCurrency;
}

/**
 * Narrows the untyped `country-list-js` lookup result to the
 * {@link CountryRecord} shape we rely on.
 *
 * @category Country Helpers
 * @param value - The raw value returned by `country-list-js`
 * @returns Whether the value is a usable country record
 * @example
 * ```typescript
 * isCountryRecord({ name: "United States" }) // true
 * isCountryRecord(undefined) // false
 * ```
 * @source
 */
function isCountryRecord(value: unknown): value is CountryRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.name === "string";
}

/**
 * Looks up a country record by its two-letter ISO 3166-1 alpha-2 code.
 * Wraps the untyped `country-list-js` `findByIso2` in a type guard so callers
 * get a typed result instead of `any`.
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
  const result: unknown = findByIso2(iso2);
  return isCountryRecord(result) ? result : undefined;
}

/**
 * Narrows a string to a {@link CountryCode} by confirming `country-list-js` knows it. Kept local to
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

/**
 * Resolves a country's ISO 3166-1 alpha-2 code from its full English name.
 * Wraps the untyped `country-list-js` `findByName` (whose record nests the code as
 * `{ code: { iso2 } }`), title-casing the input first since the library matches only
 * Title Case. Returns undefined for unknown names (including short aliases like "USA"
 * that the library doesn't index — callers handle those separately).
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
  const result: unknown = findByName(titleCased);
  if (typeof result !== "object" || result === null || !("code" in result)) {
    return undefined;
  }
  const code: unknown = result.code;
  if (typeof code !== "object" || code === null || !("iso2" in code)) {
    return undefined;
  }
  const iso2: unknown = code.iso2;
  return typeof iso2 === "string" && isKnownCountryCode(iso2) ? iso2 : undefined;
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
  if (typeof settings !== "object" || settings === null) {
    return undefined;
  }
  const country = (settings as Record<string, unknown>).country;
  return typeof country === "string" ? country : undefined;
}
