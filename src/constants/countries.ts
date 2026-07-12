/**
 * @group Constants
 * @groupDescription Country lists derived from `country-list-js`. Split out of
 * `constants/common.ts` so that importing app constants (e.g. `CACHE`) does not
 * pull the full country dataset into dependency-light bundles such as the
 * background service worker.
 * @source
 */

import { all as countriesByIso2 } from "country-list-js";

/**
 * Supported countries for location-based features such as currency and shipping filters.
 * Sourced from `country-list-js` (full ISO 3166-1 alpha-2 list) and sorted alphabetically
 * by country name. Codes that the library can't name fall back to the raw code.
 * @source
 */
export const COUNTRIES = Object.entries(countriesByIso2)
  .map(([code, record]) => ({ code, name: record?.name ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Supplier country options available for filtering in the drawer search panel.
 * Derived from {@link COUNTRIES} (already sorted alphabetically by name).
 * @source
 */
export const SUPPLIER_COUNTRY_OPTIONS = COUNTRIES.map(({ code, name }) => ({ code, label: name }));

/**
 * ISO 3166-1 alpha-2 codes of the 27 EU member states. `country-list-js` exposes
 * geographic continent, not EU membership, so this legally-defined set is hardcoded.
 * Used to evaluate "EU-only" purchase restrictions: a user whose location is not in
 * this set cannot buy an EU-only product.
 * @source
 */
export const EU_COUNTRY_CODES: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);
