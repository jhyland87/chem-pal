/**
 * @group Helpers
 * @groupDescription Price formatting utilities shared by the results table and its
 * expanded detail panel so currency conversion stays consistent across both.
 * @source
 */

import { unitPriceExactFractionDigits, unitPriceMinDisplay } from '@/../config.json';
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

/**
 * Formats a single per-base-unit price with its `/{unit}` suffix, keeping the
 * column narrow: a positive value below one cent collapses to `"<$0.01/{unit}"`
 * (the threshold is run through {@link formatWithSymbol} so the currency symbol
 * and locale decimal separator match), and everything else is rendered at the
 * default two decimal places.
 * @category Helpers
 * @group Formatters
 * @param currency - The display currency code, used to pick the symbol.
 * @param perUnit - The price per base unit, already converted into `currency`.
 * @param unitLabel - The base-unit label to append, e.g. `"g"`, `"mL"`, `"pcs"`.
 * @returns A `"{price}/{unit}"` string, using `"<$0.01"` for sub-cent values.
 * @example
 * ```ts
 * formatPerUnitPrice("USD", 0.08, "g");   // => "$0.08/g"
 * formatPerUnitPrice("USD", 0.0035, "g"); // => "<$0.01/g"
 * formatPerUnitPrice("EUR", 0.004, "g");  // => "<€0.01/g"
 * ```
 * @source
 */
function formatPerUnitPrice(currency: string, perUnit: number, unitLabel: string): string {
  if (perUnit > 0 && perUnit < unitPriceMinDisplay) {
    return `<${formatWithSymbol(currency, unitPriceMinDisplay)}/${unitLabel}`;
  }
  return `${formatWithSymbol(currency, perUnit)}/${unitLabel}`;
}

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
 * The pieces needed to format a per-unit price: the display currency, the amount
 * per base unit already converted into that currency, and the base-unit label.
 * @category Helpers
 * @group Formatters
 */
interface ResolvedUnitPrice {
  currency: string;
  perUnit: number;
  unitLabel: string;
}

/**
 * Resolves a product's per-base-unit price and display currency, mirroring
 * {@link formatDisplayPrice}'s currency handling: converts the USD anchor into the
 * user's currency (falling back to the native price when a non-USD product has no
 * anchor) and divides by the quantity normalized to its cost base unit. Shared by
 * {@link formatUnitPrice} (rounded display) and {@link formatUnitPriceExact}
 * (full-precision hover value) so both agree on the underlying number. Returns
 * `undefined` when there's no price or the quantity/unit can't be converted.
 * @category Helpers
 * @group Formatters
 * @param product - The product/variant `price`, `usdPrice`, `currencyCode`, `quantity`, and `uom` fields.
 * @param userSettings - The user's `currency` and `currencyRate`; defaults to USD at rate 1 when undefined.
 * @returns The resolved currency, per-unit amount, and unit label, or `undefined` when unavailable.
 * @example
 * ```ts
 * resolveUnitPrice({ price: 40, usdPrice: 40, currencyCode: "USD", quantity: 500, uom: "g" }, undefined);
 * // => { currency: "USD", perUnit: 0.08, unitLabel: "g" }
 * ```
 * @source
 */
function resolveUnitPrice(
  product: UnitPriceFields,
  userSettings: PriceSettings | undefined,
): ResolvedUnitPrice | undefined {
  const { usdPrice, price: rawPrice, currencyCode, quantity, uom } = product;

  if (usdPrice === undefined && rawPrice === undefined) return undefined;
  if (quantity === undefined || uom === undefined) return undefined;

  const base = toCostBaseQuantity(quantity, uom);
  if (!base) return undefined;

  const unitLabel = formatUomForDisplay(base.uom);
  const currencyRate = userSettings?.currencyRate ?? 1;

  // Non-USD product without a USD anchor: use the native per-unit price as-is.
  if (currencyCode !== 'USD' && usdPrice === undefined) {
    const fallbackCurrency = currencyCode ?? 'USD';
    return { currency: fallbackCurrency, perUnit: Number(rawPrice) / base.quantity, unitLabel };
  }

  const currency = userSettings?.currency ?? 'USD';
  const priceInUsd = usdPrice ?? Number(rawPrice);
  return { currency, perUnit: (priceInUsd * currencyRate) / base.quantity, unitLabel };
}

/**
 * Formats a product's price per base unit for display, e.g. `"$0.08/g"` or
 * `"$19.99/pcs"`. Resolves the per-unit amount via `resolveUnitPrice`, then
 * renders it at two decimal places, collapsing any positive unit price below one
 * cent to `"<$0.01/{unit}"` (see `formatPerUnitPrice`) to keep the column
 * narrow. The unrounded value is available via {@link formatUnitPriceExact} for a
 * hover tooltip. Returns `""` when there's no price or the quantity/unit can't be
 * converted.
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
 * // => "<€0.01/g"
 * ```
 * @source
 */
export function formatUnitPrice(
  product: UnitPriceFields,
  userSettings: PriceSettings | undefined,
): string {
  const resolved = resolveUnitPrice(product, userSettings);
  if (!resolved) return '';

  return formatPerUnitPrice(resolved.currency, resolved.perUnit, resolved.unitLabel);
}

/**
 * Formats a product's price per base unit at full precision — up to four decimal
 * places, with no sub-cent collapse — for use as the hover tooltip behind the
 * rounded {@link formatUnitPrice} display, so a value shown as `"<$0.01/g"` or
 * `"$0.07/g"` reveals its actual `"$0.0035/g"` / `"$0.072/g"` on hover. Uses the
 * same resolved amount as the display formatter (see `resolveUnitPrice`).
 * Returns `""` when there's no price or the quantity/unit can't be converted.
 * @category Helpers
 * @group Formatters
 * @param product - The product/variant `price`, `usdPrice`, `currencyCode`, `quantity`, and `uom` fields.
 * @param userSettings - The user's `currency` and `currencyRate`; defaults to USD at rate 1 when undefined.
 * @returns A localized full-precision `"{price}/{unit}"` string, or `""` when unavailable.
 * @example
 * ```ts
 * formatUnitPriceExact({ price: 5, usdPrice: 5, currencyCode: "USD", quantity: 1, uom: "kg" }, undefined);
 * // => "$0.005/g"
 * formatUnitPriceExact({ price: 40, usdPrice: 40, currencyCode: "USD", quantity: 500, uom: "g" }, { currency: "EUR", currencyRate: 0.9 });
 * // => "€0.072/g"
 * ```
 * @source
 */
export function formatUnitPriceExact(
  product: UnitPriceFields,
  userSettings: PriceSettings | undefined,
): string {
  const resolved = resolveUnitPrice(product, userSettings);
  if (!resolved) return '';

  const { currency, perUnit, unitLabel } = resolved;
  return `${formatWithSymbol(currency, perUnit, unitPriceExactFractionDigits)}/${unitLabel}`;
}
