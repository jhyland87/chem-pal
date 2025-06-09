/**
 * @group Constants
 * @groupDescription Application-wide constants and enumerations used throughout the codebase.
 */
/* eslint-disable @typescript-eslint/naming-convention */

import { currencies } from "../../config.json";

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

export const CURRENCY_CODE_MAP: { [key: string]: string } = Object.fromEntries(
  Object.entries(currencies).map(([code, { symbol }]) => [symbol, code as CurrencyCode]),
);
