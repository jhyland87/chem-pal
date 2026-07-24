/**
 * @group Helpers
 * @groupDescription Price formatting utilities shared by the results table and its
 * expanded detail panel so currency conversion stays consistent across both.
 * @source
 */

import { CURRENCY_SYMBOL_MAP } from '@/constants/currency';
import { formatUomForDisplay, toCostBaseQuantity } from '@/helpers/quantity';

/** The product/variant price fields {@link formatDisplayPrice} needs to format a value. */
type PriceFields = Pick<Variant, 'price' | 'usdPrice' | 'currencyCode'>;

/** The product/variant fields {@link getUnitPrice} and {@link formatUnitPrice} read. */
type UnitPriceFields = Pick<Variant, 'price' | 'usdPrice' | 'currencyCode' | 'quantity' | 'uom'>;

/** The user settings {@link formatDisplayPrice} reads for currency conversion. */
type PriceSettings = Pick<UserSettings, 'currency' | 'currencyRate'>;

/**
 * Formats an amount with its currency symbol (from {@link CURRENCY_SYMBOL_MAP}),
 * e.g. `"ƒ43.50"`. Uses the symbol map rather than `Intl`'s `currency` style so
 * currencies whose `Intl` symbol is their code (e.g. ANG → "ANG") still render the
 * proper glyph (ANG → "ƒ"), matching the drawer's price-range adornment. The number
 * is grouped/decimal-formatted in the runtime locale; falls back to the raw code
 * when no symbol is known.
 * @param currency - The ISO currency code (e.g. `"ANG"`).
 * @param amount - The numeric amount to format.
 * @param maximumFractionDigits - Upper bound on decimal places (default 2). Raise it
 *   for small per-unit prices so `$0.0042` doesn't collapse to `$0.00`.
 * @returns The symbol-prefixed amount, e.g. `"€18.00"`.
 * @example
 * ```ts
 * formatWithSymbol("USD", 19.99); // => "$19.99"
 * formatWithSymbol("ANG", 43.5); // => "ƒ43.50"
 * formatWithSymbol("USD", 0.0042, 4); // => "$0.0042"
 * ```
 * @source
 */
function formatWithSymbol(currency: string, amount: number, maximumFractionDigits = 2): string {
  const symbol = CURRENCY_SYMBOL_MAP[currency] ?? currency;
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(amount);
  return `${symbol}${formatted}`;
}

/**
 * Formats a product or variant price for display, converting into the user's
 * selected currency when a USD anchor is available.
 *
 * Mirrors the logic that previously lived inline in the results table's price
 * column: a non-USD product without a `usdPrice` anchor can't be converted, so
 * its native price is rendered as-is; otherwise the USD price (or raw price for
 * USD products) is multiplied by the user's `currencyRate` and formatted in the
 * user's `currency`. Returns an empty string when there is no price to show
 * (e.g. a variant whose `price` and `usdPrice` are both undefined), avoiding a
 * `NaN` render.
 * @category Helpers
 * @group Formatters
 * @param product - Price fields (`price`, `usdPrice`, `currencyCode`) of the product or variant.
 * @param userSettings - The user's `currency` and `currencyRate`; defaults to USD at rate 1 when undefined.
 * @returns A localized currency string, or `""` when no price is available.
 * @example
 * ```ts
 * formatDisplayPrice({ price: 19.99, usdPrice: 19.99, currencyCode: "USD" }, { currency: "USD", currencyRate: 1 });
 * // => "$19.99"
 * formatDisplayPrice({ price: 17, usdPrice: 20, currencyCode: "USD" }, { currency: "EUR", currencyRate: 0.9 });
 * // => "€18.00"
 * formatDisplayPrice({ currencyCode: "USD" }, undefined);
 * // => ""
 * ```
 * @source
 */
export function formatDisplayPrice(
  product: PriceFields,
  userSettings: PriceSettings | undefined,
): string {
  const { usdPrice, price: rawPrice, currencyCode } = product;

  // Nothing to format — avoid rendering "NaN" for variants missing price data.
  if (usdPrice === undefined && rawPrice === undefined) return '';

  const currency = userSettings?.currency ?? 'USD';
  const currencyRate = userSettings?.currencyRate ?? 1;

  // Non-USD product without a USD anchor: we can't convert into the user's
  // chosen currency, so render the native price as-is.
  if (currencyCode !== 'USD' && usdPrice === undefined) {
    console.error('Non-USD product is missing USD price', { product });
    const fallbackCurrency = currencyCode ?? 'USD';
    return formatWithSymbol(fallbackCurrency, Number(rawPrice));
  }

  const priceInUsd = usdPrice ?? Number(rawPrice);

  return formatWithSymbol(currency, priceInUsd * currencyRate);
}

/** Max decimal places for a per-unit price, so small values stay readable. */
const UNIT_PRICE_MAX_FRACTION_DIGITS = 4;

/**
 * Computes a product's price per base unit as a currency-stable number for
 * sorting and filtering — the USD price (or raw price when there's no USD anchor)
 * divided by the quantity normalized to its cost base unit (grams for mass,
 * millilitres for volume, pieces for countable units; see
 * {@link toCostBaseQuantity}). Returns `undefined` when there's no price, no
 * quantity, or the unit can't be converted, so the value never becomes `NaN`.
 *
 * Uses `usdPrice` (mirroring the price column's sort) so per-unit values compare
 * across currencies; {@link formatUnitPrice} handles display-currency conversion
 * separately.
 * @category Helpers
 * @group Formatters
 * @param product - The product/variant `price`, `usdPrice`, `quantity`, and `uom` fields.
 * @returns The numeric price per base unit, or `undefined` when it can't be computed.
 * @example
 * ```ts
 * getUnitPrice({ usdPrice: 40, price: 40, quantity: 500, uom: "g" }); // => 0.08
 * getUnitPrice({ usdPrice: 20, price: 20, quantity: 1, uom: "kg" });  // => 0.02
 * getUnitPrice({ price: 10, quantity: 0, uom: "g" });                 // => undefined
 * ```
 * @source
 */
export function getUnitPrice(product: UnitPriceFields): number | undefined {
  const { usdPrice, price, quantity, uom } = product;

  const priceValue = usdPrice ?? price;
  if (priceValue === undefined || quantity === undefined || uom === undefined) return undefined;

  const base = toCostBaseQuantity(quantity, uom);
  if (!base) return undefined;

  return priceValue / base.quantity;
}

/**
 * Formats a product's price per base unit for display, e.g. `"$0.08/g"` or
 * `"$19.99/pcs"`. Mirrors {@link formatDisplayPrice}'s currency handling —
 * converts the USD anchor into the user's currency (falling back to the native
 * price when a non-USD product has no anchor) — then divides by the quantity
 * normalized to its cost base unit and appends `/{unit}`. Small values keep up to
 * four decimal places so a fraction-of-a-cent unit price stays legible. Returns
 * `""` when there's no price or the quantity/unit can't be converted.
 * @category Helpers
 * @group Formatters
 * @param product - The product/variant `price`, `usdPrice`, `currencyCode`, `quantity`, and `uom` fields.
 * @param userSettings - The user's `currency` and `currencyRate`; defaults to USD at rate 1 when undefined.
 * @returns A localized `"{price}/{unit}"` string, or `""` when no unit price is available.
 * @example
 * ```ts
 * formatUnitPrice({ price: 40, usdPrice: 40, currencyCode: "USD", quantity: 500, uom: "g" }, undefined);
 * // => "$0.08/g"
 * formatUnitPrice({ price: 5, usdPrice: 5, currencyCode: "USD", quantity: 1, uom: "kg" }, { currency: "EUR", currencyRate: 0.9 });
 * // => "€0.0045/g"
 * ```
 * @source
 */
export function formatUnitPrice(
  product: UnitPriceFields,
  userSettings: PriceSettings | undefined,
): string {
  const { usdPrice, price: rawPrice, currencyCode, quantity, uom } = product;

  if (usdPrice === undefined && rawPrice === undefined) return '';
  if (quantity === undefined || uom === undefined) return '';

  const base = toCostBaseQuantity(quantity, uom);
  if (!base) return '';

  const unitLabel = formatUomForDisplay(base.uom);
  const currency = userSettings?.currency ?? 'USD';
  const currencyRate = userSettings?.currencyRate ?? 1;

  // Non-USD product without a USD anchor: render the native per-unit price as-is.
  if (currencyCode !== 'USD' && usdPrice === undefined) {
    const fallbackCurrency = currencyCode ?? 'USD';
    const perUnit = Number(rawPrice) / base.quantity;
    return `${formatWithSymbol(fallbackCurrency, perUnit, UNIT_PRICE_MAX_FRACTION_DIGITS)}/${unitLabel}`;
  }

  const priceInUsd = usdPrice ?? Number(rawPrice);
  const perUnit = (priceInUsd * currencyRate) / base.quantity;

  return `${formatWithSymbol(currency, perUnit, UNIT_PRICE_MAX_FRACTION_DIGITS)}/${unitLabel}`;
}
