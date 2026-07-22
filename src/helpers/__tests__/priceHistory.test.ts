import {
  buildAggregateSeries,
  describeTrend,
  getProductPriceHistory,
  productSeriesKey,
  recordProductPrices,
  variantSeriesKey,
} from '@/helpers/priceHistory';
import { clearPriceHistory, getPriceSeries } from '@/utils/idbCache';
import { beforeEach, describe, expect, it } from 'vitest';

const product = (fields: Partial<Product>): Product => fields as unknown as Product;

const baseProduct = (usdPrice: number, variants: Partial<Variant>[] = []): Product =>
  product({
    cacheKey: 'ck-1',
    supplier: 'Loudwolf',
    title: 'Acetone 500ml',
    url: 'https://loudwolf.com/acetone',
    usdPrice,
    variants: variants as Variant[],
  });

const usdValues = async (id: string | undefined): Promise<number[]> => {
  if (id === undefined) return [];
  const series = await getPriceSeries(id);
  return (series?.points ?? []).map((p) => p.usd);
};

describe('recordProductPrices', () => {
  beforeEach(async () => {
    await clearPriceHistory();
  });

  it('creates a series with one point the first time a product is seen', async () => {
    const p = baseProduct(19.99);
    await recordProductPrices([p]);
    expect(await usdValues(productSeriesKey(p))).toEqual([19.99]);
  });

  it('does not append a point when the price is unchanged (dedup)', async () => {
    const p = baseProduct(19.99);
    await recordProductPrices([p]);
    await recordProductPrices([p]);
    await recordProductPrices([p]);
    expect(await usdValues(productSeriesKey(p))).toEqual([19.99]);
  });

  it('appends a point when the price changes', async () => {
    await recordProductPrices([baseProduct(19.99)]);
    await recordProductPrices([baseProduct(21.5)]);
    expect(await usdValues(productSeriesKey(baseProduct(0)))).toEqual([19.99, 21.5]);
  });

  it('trims to the newest N points when priceHistoryMaxPoints is positive', async () => {
    for (const price of [10, 11, 12, 13, 14]) {
      await recordProductPrices([baseProduct(price)], { priceHistoryMaxPoints: 3 });
    }
    expect(await usdValues(productSeriesKey(baseProduct(0)))).toEqual([12, 13, 14]);
  });

  it('keeps every point when priceHistoryMaxPoints is 0 (unlimited)', async () => {
    for (const price of [10, 11, 12, 13, 14]) {
      await recordProductPrices([baseProduct(price)], { priceHistoryMaxPoints: 0 });
    }
    expect(await usdValues(productSeriesKey(baseProduct(0)))).toEqual([10, 11, 12, 13, 14]);
  });

  it('coerces a string max-points setting (settings persist numbers as strings)', async () => {
    for (const price of [10, 11, 12]) {
      // priceHistoryMaxPoints arrives as a string from the settings reducer.
      await recordProductPrices([baseProduct(price)], {
        priceHistoryMaxPoints: '2' as unknown as number,
      });
    }
    expect(await usdValues(productSeriesKey(baseProduct(0)))).toEqual([11, 12]);
  });

  it('tracks each variant as its own series, distinct from the base and each other', async () => {
    const p = baseProduct(20, [
      { title: 'Variant A', sku: 'A', usdPrice: 5 },
      { title: 'Variant B', sku: 'B', usdPrice: 7 },
    ]);
    await recordProductPrices([p]);

    expect(await usdValues(productSeriesKey(p))).toEqual([20]);
    expect(await usdValues(variantSeriesKey(p, p.variants![0]))).toEqual([5]);
    expect(await usdValues(variantSeriesKey(p, p.variants![1]))).toEqual([7]);
  });

  it("does not record a separate base series when a variant already has the product's price", async () => {
    // The headline product price is its default variant (same price). Recording a
    // standalone base series too would duplicate that variant's history.
    const p = baseProduct(43.09, [
      { id: 'v1', cacheKey: 'ck-1', title: 'X - 100g', quantity: 100, uom: 'g', usdPrice: 43.09 },
      { id: 'v2', cacheKey: 'ck-1', title: 'X - 500g', quantity: 500, uom: 'g', usdPrice: 109.5 },
    ]);
    await recordProductPrices([p]);

    // Base (productKey) series is NOT written; the 100g variant carries that price.
    expect(await getPriceSeries(productSeriesKey(p)!)).toBeUndefined();
    expect(await usdValues(variantSeriesKey(p, p.variants![0]))).toEqual([43.09]);
    expect(await usdValues(variantSeriesKey(p, p.variants![1]))).toEqual([109.5]);
  });

  it('still records the base series when its price matches no variant', async () => {
    const p = baseProduct(20, [
      { title: 'A', usdPrice: 5 },
      { title: 'B', usdPrice: 7 },
    ]);
    await recordProductPrices([p]);
    expect(await usdValues(productSeriesKey(p))).toEqual([20]);
  });

  it('keys a variant by its own id when it is distinct from the parent identity', async () => {
    // Wix-style: variants carry unique ids while inheriting the parent's cacheKey.
    const p = product({
      cacheKey: '96a50af4',
      supplier: 'BioFuran Chem',
      title: 'Potassium oleate',
      url: 'https://x/p',
      usdPrice: 43.09,
      variants: [
        {
          id: 'd5de5c76',
          cacheKey: '96a50af4',
          title: 'Potassium oleate - 100g',
          quantity: 100,
          uom: 'g',
          usdPrice: 43.09,
        },
        {
          id: '911ef316',
          cacheKey: '96a50af4',
          title: 'Potassium oleate - 500g',
          quantity: 500,
          uom: 'g',
          usdPrice: 109.5,
        },
      ],
    });
    await recordProductPrices([p]);

    const key0 = variantSeriesKey(p, p.variants![0]);
    expect(key0).toBe(`${productSeriesKey(p)}::d5de5c76`);
    expect(await usdValues(key0)).toEqual([43.09]);

    const entry = await getPriceSeries(key0!);
    expect(entry?.variantId).toBe('d5de5c76');
    expect(entry?.variantKey).toBe('d5de5c76');
  });

  it('ignores a variant id inherited from the parent, keeping siblings separate', async () => {
    // Both variants inherited the parent's id (id === cacheKey); it must NOT be
    // used as the key, so they fall back to their distinct titles.
    const p = product({
      cacheKey: 'pid',
      supplier: 'S',
      title: 'X',
      url: 'u',
      usdPrice: 10,
      variants: [
        { id: 'pid', cacheKey: 'pid', title: 'X - 100g', quantity: 100, uom: 'g', usdPrice: 5 },
        { id: 'pid', cacheKey: 'pid', title: 'X - 500g', quantity: 500, uom: 'g', usdPrice: 7 },
      ],
    });
    await recordProductPrices([p]);

    expect(variantSeriesKey(p, p.variants![0])).toBe(`${productSeriesKey(p)}::X - 100g`);
    expect(new Set(p.variants!.map((v) => variantSeriesKey(p, v))).size).toBe(2);
    const entry = await getPriceSeries(variantSeriesKey(p, p.variants![0])!);
    expect(entry?.variantId).toBeUndefined();
  });

  it('keeps sibling variants separate even when they share an inherited sku/id', async () => {
    // ProductBuilder.build() fills unset variant fields from the parent, so
    // real-world variants routinely share the parent's sku. They must NOT
    // collapse into one series (which would fake a trend on the first search).
    const p = baseProduct(11, [
      { title: 'Potassium oleate - 25g', sku: 'A668410', quantity: 25, uom: 'g', usdPrice: 11 },
      { title: 'Potassium oleate - 100g', sku: 'A668410', quantity: 100, uom: 'g', usdPrice: 21 },
      { title: 'Potassium oleate - 500g', sku: 'A668410', quantity: 500, uom: 'g', usdPrice: 66 },
      { title: 'Potassium oleate - 1kg', sku: 'A668410', quantity: 1, uom: 'kg', usdPrice: 110 },
    ]);
    await recordProductPrices([p]);

    // Each variant gets its own single-point series — no manufactured trend.
    for (const variant of p.variants!) {
      expect(await usdValues(variantSeriesKey(p, variant))).toEqual([variant.usdPrice]);
    }
    // Four distinct variant series ids.
    const ids = new Set(p.variants!.map((v) => variantSeriesKey(p, v)));
    expect(ids.size).toBe(4);
  });

  it('never appends two points to one series in a single pass (same-size siblings)', async () => {
    // Two variants that resolve to the same series id (identical title) must be
    // deduped within the pass, not recorded as two sequential points.
    const p = baseProduct(0, [
      { title: '500g', quantity: 500, uom: 'g', usdPrice: 60 },
      { title: '500g', quantity: 500, uom: 'g', usdPrice: 90 },
    ]);
    await recordProductPrices([p]);

    expect(await usdValues(variantSeriesKey(p, p.variants![0]))).toEqual([60]);
  });

  it('records nothing when trackPriceHistory is disabled', async () => {
    const p = baseProduct(19.99);
    await recordProductPrices([p], { trackPriceHistory: false });
    expect(await getPriceSeries(productSeriesKey(p)!)).toBeUndefined();
  });

  it('skips non-positive or missing USD prices but still records valid variants', async () => {
    const p = baseProduct(0, [
      { sku: 'A', usdPrice: 5 },
      { sku: 'B', usdPrice: undefined },
    ]);
    await recordProductPrices([p]);

    expect(await getPriceSeries(productSeriesKey(p)!)).toBeUndefined();
    expect(await usdValues(variantSeriesKey(p, p.variants![0]))).toEqual([5]);
    expect(await getPriceSeries(variantSeriesKey(p, p.variants![1])!)).toBeUndefined();
  });

  it('does not record products that cannot be keyed', async () => {
    const p = product({ supplier: '', title: '', usdPrice: 10 });
    await recordProductPrices([p]);
    expect(productSeriesKey(p)).toBeUndefined();
  });
});

describe('getProductPriceHistory', () => {
  beforeEach(async () => {
    await clearPriceHistory();
  });

  it('returns the base and variant series keyed by series id', async () => {
    const p = baseProduct(20, [{ sku: 'A', usdPrice: 5 }]);
    await recordProductPrices([p]);

    const byId = await getProductPriceHistory(p);
    expect(byId.get(productSeriesKey(p)!)?.points.map((pt) => pt.usd)).toEqual([20]);
    expect(byId.get(variantSeriesKey(p, p.variants![0])!)?.points.map((pt) => pt.usd)).toEqual([5]);
  });

  it('returns an empty map for an unkeyable product', async () => {
    const byId = await getProductPriceHistory(product({ supplier: '', title: '', usdPrice: 1 }));
    expect(byId.size).toBe(0);
  });
});

describe('describeTrend', () => {
  it('reports a flat trend for fewer than two points', () => {
    expect(describeTrend([])).toEqual({ direction: 'flat', deltaUsd: 0, pctChange: 0 });
    expect(describeTrend([{ t: 1, usd: 10 }])).toEqual({
      direction: 'flat',
      deltaUsd: 0,
      pctChange: 0,
    });
  });

  it('reports an upward trend with signed delta and percent change', () => {
    const trend = describeTrend([
      { t: 1, usd: 20 },
      { t: 2, usd: 22 },
    ]);
    expect(trend.direction).toBe('up');
    expect(trend.deltaUsd).toBe(2);
    expect(trend.pctChange).toBeCloseTo(10);
  });

  it('reports a downward trend for a price drop', () => {
    const trend = describeTrend([
      { t: 1, usd: 20 },
      { t: 2, usd: 15 },
    ]);
    expect(trend.direction).toBe('down');
    expect(trend.deltaUsd).toBe(-5);
    expect(trend.pctChange).toBeCloseTo(-25);
  });
});

describe('buildAggregateSeries', () => {
  const entry = (points: PricePoint[], id = 's'): PriceHistoryEntry => ({
    id,
    productKey: 'pk',
    supplier: 'Loudwolf',
    title: 't',
    points,
    updatedAt: 0,
  });

  it('returns an empty series for no input or point-less series', () => {
    expect(buildAggregateSeries([])).toEqual([]);
    expect(buildAggregateSeries([entry([])])).toEqual([]);
  });

  it('mirrors a single series unchanged', () => {
    const points: PricePoint[] = [
      { t: 1, usd: 10 },
      { t: 2, usd: 12 },
    ];
    expect(buildAggregateSeries([entry(points)])).toEqual(points);
  });

  it("trends down when every variant's last move is down (the reported bug)", () => {
    const aggregate = buildAggregateSeries([
      entry(
        [
          { t: 1, usd: 10 },
          { t: 2, usd: 8 },
        ],
        'a',
      ),
      entry(
        [
          { t: 1, usd: 20 },
          { t: 2, usd: 18 },
        ],
        'b',
      ),
    ]);
    expect(aggregate).toEqual([
      { t: 1, usd: 15 },
      { t: 2, usd: 13 },
    ]);
    expect(describeTrend(aggregate).direction).toBe('down');
  });

  it('forward-fills without letting a later-starting series move earlier means', () => {
    const aggregate = buildAggregateSeries([
      entry(
        [
          { t: 1, usd: 10 },
          { t: 3, usd: 10 },
        ],
        'a',
      ),
      entry([{ t: 2, usd: 30 }], 'b'),
    ]);
    // t1: only A (10). t2: mean(10, 30) = 20. t3: mean(10, 30 filled) = 20 → deduped.
    expect(aggregate).toEqual([
      { t: 1, usd: 10 },
      { t: 2, usd: 20 },
    ]);
  });

  it('dedupes consecutive-equal means', () => {
    const aggregate = buildAggregateSeries([
      entry([
        { t: 1, usd: 10 },
        { t: 2, usd: 10 },
        { t: 3, usd: 12 },
      ]),
    ]);
    expect(aggregate).toEqual([
      { t: 1, usd: 10 },
      { t: 3, usd: 12 },
    ]);
  });
});
