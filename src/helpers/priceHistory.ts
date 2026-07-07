/**
 * @group Helpers
 * @groupDescription Records and reads per-product/per-variant price history in
 * IndexedDB. Prices are stored in standardized USD (the `usdPrice` anchor
 * computed at build time) so points stay comparable across time and convert to
 * the user's currency at display time. A new point is appended only when the
 * USD price changes, so re-running a search never adds redundant rows.
 * @source
 */

import { getProductIdentityKey } from "@/helpers/productIdentity";
import {
  getPriceSeries,
  getPriceSeriesByProduct,
  putPriceSeries,
} from "@/utils/idbCache";

/** The user settings that gate and bound price-history recording. */
type PriceHistorySettings = Pick<UserSettings, "trackPriceHistory" | "priceHistoryMaxPoints">;

/** Direction of the most recent price move, from {@link describeTrend}. */
type TrendDirection = "up" | "down" | "flat";

/** Summary of the last price move for a series, from {@link describeTrend}. */
interface PriceTrend {
  /** Whether the latest point is higher, lower, or equal to the one before it. */
  direction: TrendDirection;
  /** Signed USD change between the last two points (0 when fewer than two). */
  deltaUsd: number;
  /** Percent change between the last two points (0 when fewer than two, or prior is 0). */
  pctChange: number;
}

/** A resolved series to record: its id, identity, labels and current USD price. */
interface SeriesInput {
  id: string;
  productKey: string;
  variantKey?: string;
  variantId?: string;
  supplier: string;
  title: string;
  permalink?: string;
  usd: number;
}

/**
 * Whether a value is a usable USD price: a finite, strictly-positive number.
 * Guards against `undefined`, `NaN`, and zero/negative anchors that would make
 * a meaningless history point.
 * @param value - The candidate price.
 * @returns True when the value can be recorded as a price point.
 * @example
 * ```ts
 * isRecordablePrice(19.99); // true
 * isRecordablePrice(0);     // false
 * ```
 * @source
 */
function isRecordablePrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Round a USD amount to 2 decimals so equality checks (dedup) aren't defeated
 * by floating-point noise.
 * @param usd - The amount to round.
 * @returns The amount rounded to 2 decimal places.
 * @example
 * ```ts
 * round2(19.990000001); // 19.99
 * ```
 * @source
 */
function round2(usd: number): number {
  return Number(usd.toFixed(2));
}

/**
 * Normalize the configured max-points cap to a non-negative integer. The
 * numeric settings inputs persist their value as a string, so this coerces via
 * `Number()` (not `parseInt`, which would swallow trailing junk). Any invalid
 * or non-positive value falls back to `0` (unlimited).
 * @param maxPoints - The raw `priceHistoryMaxPoints` setting (number or string).
 * @returns A safe cap: `0` means unlimited, otherwise the integer count to keep.
 * @example
 * ```ts
 * normalizeMaxPoints(undefined); // 0
 * normalizeMaxPoints("3");       // 3
 * normalizeMaxPoints(3.7);       // 3
 * ```
 * @source
 */
function normalizeMaxPoints(maxPoints: unknown): number {
  const value = Number(maxPoints);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

/**
 * Derive the product's stable identity key — shared by its base series and
 * every variant series. Prefers the stamped `cacheKey`, falling back to the
 * URL then the title so scraped products without a stamped key still track.
 * @param product - The product to key.
 * @returns The identity key, or `undefined` when neither an identity nor a
 *   supplier is available to key against.
 * @example
 * ```ts
 * productSeriesKey({ cacheKey: "889460", supplier: "Carolina", … }); // "3f9c2a…"
 * ```
 * @source
 */
export function productSeriesKey(product: Product): string | undefined {
  const identity = product.cacheKey ?? product.url ?? product.title;
  if (identity == null || String(identity).length === 0 || !product.supplier) {
    return undefined;
  }
  return getProductIdentityKey(String(identity), product.supplier);
}

/**
 * The variant's own supplier id, but only when it is genuinely per-variant.
 * `ProductBuilder.build()` fills unset variant fields from the parent, so a
 * variant that had no id of its own inherits the parent's — which equals its
 * `cacheKey` (the parent identity). We treat an id that matches that parent
 * identity as inherited and ignore it; anything else is the variant's real id
 * (e.g. Wix's per-selection `item.id`).
 * @param product - The parent product (source of the fallback parent identity).
 * @param variant - The variant to inspect.
 * @returns The variant's own id, or `undefined` when absent or inherited.
 * @example
 * ```ts
 * genuineVariantId(product, { id: "d5de5c76", cacheKey: "96a50af4" }); // "d5de5c76"
 * genuineVariantId(product, { id: "96a50af4", cacheKey: "96a50af4" }); // undefined
 * ```
 * @source
 */
function genuineVariantId(product: Product, variant: Variant): string | undefined {
  if (variant.id == null) {
    return undefined;
  }
  const id = String(variant.id);
  if (id.length === 0) {
    return undefined;
  }
  const parentIdentity = String(
    variant.cacheKey ?? product.cacheKey ?? product.url ?? product.title ?? "",
  );
  return id === parentIdentity ? undefined : id;
}

/**
 * Derive the discriminator that distinguishes a variant from its siblings within
 * a product. Prefers the variant's own id (the most stable, precise identity),
 * then the (post-build, size/grade-bearing) title, the pack size (quantity+uom),
 * and finally the sku. `sku`/inherited `id` are avoided as primary keys because
 * `ProductBuilder.build()` fills them from the parent, so siblings often share
 * them and would collapse into one series.
 * @param product - The parent product.
 * @param variant - The variant to discriminate.
 * @returns The discriminator string, or `undefined` when none is available.
 * @example
 * ```ts
 * variantDiscriminator(product, { id: "d5de5c76", cacheKey: "96a50af4" }); // "d5de5c76"
 * variantDiscriminator(product, { title: "X - 500g" }); // "X - 500g"
 * ```
 * @source
 */
function variantDiscriminator(product: Product, variant: Variant): string | undefined {
  const size = variant.quantity == null ? undefined : `${variant.quantity}${variant.uom ?? ""}`;
  const value = genuineVariantId(product, variant) ?? variant.title ?? size ?? variant.sku;
  if (value == null || String(value).length === 0) {
    return undefined;
  }
  return String(value);
}

/**
 * Derive the series id for one of a product's variants: the product key joined
 * with the variant's discriminator (see `variantDiscriminator`).
 * @param product - The parent product (provides the shared product key).
 * @param variant - The variant to key.
 * @returns The variant series id, or `undefined` when the product can't be
 *   keyed or the variant has no discriminator.
 * @example
 * ```ts
 * variantSeriesKey(product, { id: "d5de5c76", cacheKey: "96a50af4" }); // "3f9c2a…::d5de5c76"
 * ```
 * @source
 */
export function variantSeriesKey(product: Product, variant: Variant): string | undefined {
  const productKey = productSeriesKey(product);
  if (productKey === undefined) {
    return undefined;
  }
  const discriminator = variantDiscriminator(product, variant);
  if (discriminator === undefined) {
    return undefined;
  }
  return `${productKey}::${discriminator}`;
}

/**
 * Resolve the list of series (base product plus each valid variant) to record
 * for a single product. Entries with a non-recordable USD price are skipped.
 * @param product - The product to resolve series for.
 * @returns The recordable series inputs; empty when the product can't be keyed
 *   or has no recordable price.
 * @example
 * ```ts
 * collectSeriesInputs(product); // [{ id: "3f9c2a…", usd: 19.99, … }, …]
 * ```
 * @source
 */
function collectSeriesInputs(product: Product): SeriesInput[] {
  const productKey = productSeriesKey(product);
  if (productKey === undefined) {
    return [];
  }

  const inputs: SeriesInput[] = [];
  // Guard against sibling entries that resolve to the same series id (e.g. two
  // same-size variants): recording both in one pass would append two points to
  // one series and manufacture a fake trend on the very first search.
  const seen = new Set<string>();

  // Variants first — they are the granular, per-purchasable-unit price points.
  for (const variant of product.variants ?? []) {
    const id = variantSeriesKey(product, variant);
    if (id === undefined || seen.has(id) || !isRecordablePrice(variant.usdPrice)) {
      continue;
    }
    seen.add(id);
    inputs.push({
      id,
      productKey,
      variantKey: id.slice(productKey.length + 2),
      variantId: genuineVariantId(product, variant),
      supplier: product.supplier,
      title: variant.title ?? product.title,
      permalink: variant.permalink ?? variant.url ?? product.permalink ?? product.url,
      usd: variant.usdPrice,
    });
  }

  // Base product: record a standalone series only when its price isn't already
  // captured by a variant. A product's headline price is usually its default
  // (first) variant, which often shares the same id/sku/price — recording both
  // would duplicate that variant's history under the product key.
  if (isRecordablePrice(product.usdPrice)) {
    const baseUsd = round2(product.usdPrice);
    const duplicated = inputs.some((input) => round2(input.usd) === baseUsd);
    if (!duplicated) {
      inputs.push({
        id: productKey,
        productKey,
        supplier: product.supplier,
        title: product.title,
        permalink: product.permalink ?? product.url,
        usd: product.usdPrice,
      });
    }
  }

  return inputs;
}

/**
 * Record one series input: create the series on first sight, or append a new
 * point only when the USD price differs from the last recorded one (dedup).
 * When a positive cap is set, the series is trimmed to its newest N points.
 * @param input - The resolved series to record.
 * @param maxPoints - Normalized cap; `0` means unlimited.
 * @param now - Epoch ms timestamp to stamp on a new point.
 * @returns Resolves once any needed write completes.
 * @example
 * ```ts
 * await recordSeries(input, 0, Date.now());
 * ```
 * @source
 */
async function recordSeries(input: SeriesInput, maxPoints: number, now: number): Promise<void> {
  const usd = round2(input.usd);
  const existing = await getPriceSeries(input.id);

  if (existing === undefined) {
    await putPriceSeries({
      id: input.id,
      productKey: input.productKey,
      variantKey: input.variantKey,
      variantId: input.variantId,
      supplier: input.supplier,
      title: input.title,
      permalink: input.permalink,
      points: [{ t: now, usd }],
      updatedAt: now,
    });
    return;
  }

  const last = existing.points.at(-1);
  if (last?.usd === usd) {
    return;
  }

  let points = [...existing.points, { t: now, usd }];
  if (maxPoints > 0 && points.length > maxPoints) {
    points = points.slice(points.length - maxPoints);
  }

  await putPriceSeries({
    ...existing,
    // Refresh display fields in case the title/permalink changed since first seen.
    title: input.title,
    permalink: input.permalink,
    points,
    updatedAt: now,
  });
}

/**
 * Record the current USD price of each product (and its variants) into the
 * price-history store. A no-op when tracking is disabled. Fire-and-forget: the
 * caller wraps this in `void` from the search flow. Only writes when a price
 * changes, so repeated searches over cached results add nothing.
 * @param products - The products to record; each may carry variants.
 * @param settings - The user's price-history settings (`trackPriceHistory`,
 *   `priceHistoryMaxPoints`). Tracking is on unless explicitly disabled.
 * @returns Resolves once all series have been processed.
 * @example
 * ```ts
 * void recordProductPrices(finalResults, appContext.userSettings);
 * ```
 * @source
 */
export async function recordProductPrices(
  products: Product[],
  settings?: PriceHistorySettings,
): Promise<void> {
  if (settings?.trackPriceHistory === false) {
    return;
  }

  const maxPoints = normalizeMaxPoints(settings?.priceHistoryMaxPoints);
  const now = Date.now();

  for (const product of products) {
    for (const input of collectSeriesInputs(product)) {
      await recordSeries(input, maxPoints, now);
    }
  }
}

/**
 * Read all recorded price-history series for a product — its base row plus any
 * variant rows — keyed by series id for direct lookup from the detail UI.
 * @param product - The product whose history to load.
 * @returns A map of series id → {@link PriceHistoryEntry}; empty when the
 *   product can't be keyed or has no recorded history.
 * @example
 * ```ts
 * const byId = await getProductPriceHistory(product);
 * const base = byId.get(productSeriesKey(product) ?? "");
 * ```
 * @source
 */
export async function getProductPriceHistory(
  product: Product,
): Promise<Map<string, PriceHistoryEntry>> {
  const productKey = productSeriesKey(product);
  if (productKey === undefined) {
    return new Map();
  }
  const series = await getPriceSeriesByProduct(productKey);
  return new Map(series.map((entry) => [entry.id, entry]));
}

/**
 * Summarize the latest price move for a series from its last two points.
 * Returns a flat, zero-delta trend when there are fewer than two points.
 * @param points - The series points, ascending by time.
 * @returns The direction, signed USD delta, and percent change of the last move.
 * @example
 * ```ts
 * describeTrend([{ t: 1, usd: 20 }, { t: 2, usd: 22 }]);
 * // => { direction: "up", deltaUsd: 2, pctChange: 10 }
 * ```
 * @source
 */
export function describeTrend(points: readonly PricePoint[]): PriceTrend {
  if (points.length < 2) {
    return { direction: "flat", deltaUsd: 0, pctChange: 0 };
  }
  const last = points[points.length - 1].usd;
  const prev = points[points.length - 2].usd;
  const deltaUsd = round2(last - prev);
  const pctChange = prev !== 0 ? (deltaUsd / prev) * 100 : 0;
  const direction: TrendDirection = deltaUsd > 0 ? "up" : deltaUsd < 0 ? "down" : "flat";
  return { direction, deltaUsd, pctChange };
}
