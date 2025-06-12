/**
 * @group Constants
 * @groupDescription Application-wide constants and enumerations used throughout the codebase.
 */
/* eslint-disable @typescript-eslint/naming-convention */

import { currencies, locations } from "../../config.json";

/**
 * Mapping of ISO currency codes to their corresponding currency symbols
 * @example
 * ```typescript
 * CURRENCY_SYMBOL_MAP['USD'] // returns '$'
 * CURRENCY_SYMBOL_MAP['EUR'] // returns '€'
 * ```
 */
export const CURRENCY_SYMBOL_MAP: { [key: string]: string } = Object.fromEntries(
  Object.entries(currencies).map(([code, { symbol }]) => [
    code,
    symbol as string as CurrencySymbol,
  ]),
);

/**
 * Mapping of currency symbols to their corresponding currency codes
 * @example
 * ```typescript
 * CURRENCY_CODE_MAP['$'] // returns 'USD'
 * CURRENCY_CODE_MAP['€'] // returns 'EUR'
 * ```
 */
export const CURRENCY_CODE_MAP: { [key: string]: string } = Object.fromEntries(
  Object.entries(currencies).map(([code, { symbol }]) => [symbol, code as CurrencyCode]),
);

/**
 * Mapping of locations to their corresponding currency codes
 * @example
 * ```typescript
 * CURRENCY_CODE_MAP_BY_LOCATION['US'] // returns 'USD'
 * CURRENCY_CODE_MAP_BY_LOCATION['GB'] // returns 'GBP'
 * ```
 */
export const CURRENCY_CODE_MAP_BY_LOCATION: { [key: string]: string } = Object.fromEntries(
  Object.entries(locations).map(([code, { currency }]) => [code, currency as CurrencyCode]),
);
