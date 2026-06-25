import { CACHE } from "@/constants/common";
import { cstorage } from "@/utils/storage";
import { findByIso2 } from "country-list-js";

/**
 * @group Helpers
 * @groupDescription Country lookups backed by the `country-list-js` library,
 * wrapped so callers get typed results instead of the library's `any`.
 * @source
 */

/**
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
 * @category Helpers
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
 * @category Helpers
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
 * Resolves the full country name for a two-letter location code.
 *
 * @category Helpers
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
 * Reads the user's selected country (full name) from persisted user settings.
 * The `country` field is kept in sync with the `location` code by the settings
 * reducer, so consumers that need a full country name can read it directly.
 *
 * @category Helpers
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
