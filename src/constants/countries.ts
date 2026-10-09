/**
 * @group Constants
 * @groupDescription Country lists derived from the compact `countryData` table. Split out of
 * `constants/common.ts` so that importing app constants (e.g. `CACHE`) does not
 * pull the country table into dependency-light bundles such as the
 * background service worker.
 * @source
 */

import { COUNTRY_DATA } from '@/constants/countryData';

/**
 * Supported countries for location-based features such as currency and shipping filters.
 * Sourced from {@link COUNTRY_DATA} (full ISO 3166-1 alpha-2 list) and sorted alphabetically
 * by country name.
 * @source
 */
export const COUNTRIES = Object.entries(COUNTRY_DATA)
  .map(([code, [name]]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Supplier country options available for filtering in the drawer search panel.
 * Derived from {@link COUNTRIES} (already sorted alphabetically by name).
 * @source
 */
export const SUPPLIER_COUNTRY_OPTIONS = COUNTRIES.map(({ code, name }) => ({ code, label: name }));

/**
 * ISO 3166-1 alpha-2 codes of the 27 EU member states. The country table carries no EU
 * membership, so this legally-defined set is hardcoded.
 * Used to evaluate "EU-only" purchase restrictions: a user whose location is not in
 * this set cannot buy an EU-only product.
 * @source
 */
export const EU_COUNTRY_CODES: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);
