/**
 * @group Helpers
 * @groupDescription Price formatting utilities shared by the results table and its
 * expanded detail panel so currency conversion stays consistent across both.
 * @source
 */

/** The product/variant price fields {@link formatDisplayPrice} needs to format a value. */
type PriceFields = Pick<Variant, "price" | "usdPrice" | "currencyCode">;

/** The user settings {@link formatDisplayPrice} reads for currency conversion. */
type PriceSettings = Pick<UserSettings, "currency" | "currencyRate">;

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
  if (usdPrice === undefined && rawPrice === undefined) return "";

  const currency = userSettings?.currency ?? "USD";
  const currencyRate = userSettings?.currencyRate ?? 1;

  // Non-USD product without a USD anchor: we can't convert into the user's
  // chosen currency, so render the native price as-is.
  if (currencyCode !== "USD" && usdPrice === undefined) {
    console.error("Non-USD product is missing USD price", { product });
    const fallbackCurrency = currencyCode ?? "USD";
    return new Intl.NumberFormat(fallbackCurrency, {
      style: "currency",
      currency: fallbackCurrency,
    }).format(Number(rawPrice));
  }

  const priceInUsd = usdPrice ?? Number(rawPrice);

  return new Intl.NumberFormat(currency, {
    style: "currency",
    currency,
  }).format(priceInUsd * currencyRate);
}
