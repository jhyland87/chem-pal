/**
 * @group Constants
 * @groupDescription Application-wide constants and enumerations used throughout the codebase.
 * @source
 */

import currencyInfo from 'country-list-js/data/currency_info.json';

/**
 * Per-currency info as published by `country-list-js` (code → symbol/decimal).
 * Imported directly so the symbol data has a single source of truth.
 */
const CURRENCY_INFO: Record<string, { symbol: string; decimal: string }> = currencyInfo;

/**
 * Mapping of ISO currency codes to their corresponding currency symbols.
 * Sourced from `country-list-js`, so the symbols match the library
 * (e.g. CNY → "CN¥", JPY → "¥", INR → "Rs").
 * @example
 * ```typescript
 * CURRENCY_SYMBOL_MAP['USD'] // returns '$'
 * CURRENCY_SYMBOL_MAP['EUR'] // returns '€'
 * ```
 * @source
 */
export const CURRENCY_SYMBOL_MAP: { [key: string]: string } = Object.fromEntries(
  Object.entries(CURRENCY_INFO).map(([code, { symbol }]) => [code, symbol]),
);

/**
 * Symbol → code overrides for currencies whose `country-list-js` symbol is an ASCII
 * abbreviation (e.g. INR is "Rs"), so the common Unicode symbol still resolves when
 * parsing scraped prices. Seeded into {@link CURRENCY_CODE_MAP} so it wins over the
 * library data.
 */
const CURRENCY_CODE_OVERRIDES: { [key: string]: string } = {
  '₹': 'INR',
};

/**
 * Mapping of currency symbols to their corresponding currency codes.
 * Several currencies share a symbol (e.g. "$" → USD/SRD, "£" → GBP/GIP/…);
 * the library lists the major currency first, so we keep the first code seen for
 * each symbol ("first wins") to resolve "$" → USD, "£" → GBP, "₩" → KRW.
 * @example
 * ```typescript
 * CURRENCY_CODE_MAP['$'] // returns 'USD'
 * CURRENCY_CODE_MAP['₹'] // returns 'INR'
 * ```
 * @source
 */
export const CURRENCY_CODE_MAP: { [key: string]: string } = Object.entries(CURRENCY_INFO).reduce<{
  [key: string]: string;
}>(
  (map, [code, { symbol }]) => {
    if (!(symbol in map)) {
      map[symbol] = code;
    }
    return map;
  },
  { ...CURRENCY_CODE_OVERRIDES },
);

/**
 * Currency options (code + symbol) for selectors, sorted alphabetically by code.
 * Derived from {@link CURRENCY_SYMBOL_MAP} so the full set of currencies known to
 * `country-list-js` is available.
 * @example
 * ```typescript
 * CURRENCIES[0] // { code: 'AED', symbol: 'AED' }
 * ```
 * @source
 */
export const CURRENCIES: { code: string; symbol: string }[] = Object.entries(CURRENCY_SYMBOL_MAP)
  .map(([code, symbol]) => ({ code, symbol }))
  .sort((a, b) => a.code.localeCompare(b.code));
