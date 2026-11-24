import { patchCachedProduct } from '@/helpers/patchCachedProduct';
import { productSeriesKey } from '@/helpers/priceHistory';
import {
  clearAllCaches,
  getAllSupplierQueryCacheEntries,
  getSearchResultsRecord,
  getSupplierProductDataCacheEntry,
  putSupplierProductDataCacheEntry,
  putSupplierQueryCacheEntry,
  setSearchResults,
} from '@/utils/idbCache';
import { beforeEach, describe, expect, it } from 'vitest';

const CACHED_AT = 1_700_000_000_000;

const product = (fields: Partial<Product>): Product => fields as unknown as Product;

const meta = (supplier: string, query = 'acetone') => ({
  cachedAt: CACHED_AT,
  version: 1,
  query,
  supplier,
  supplierModule: supplier,
  resultCount: 2,
  limit: 5,
});

/** A refetched product: cheaper, with a cheaper first size. */
const fresh = (fields: Partial<Product> = {}): Product =>
  product({
    cacheKey: 'ck-1',
    supplier: 'Loudwolf',
    title: 'Acetone',
    url: 'https://loudwolf.com/acetone',
    price: 19.5,
    usdPrice: 19.5,
    localPrice: 19.5,
    currencyCode: 'USD',
    currencySymbol: '$',
    availability: 'in_stock',
    quantity: 500,
    uom: 'g',
    baseQuantity: 500,
    baseUom: 'g',
    variants: [
      variant({ id: 'v1', sku: 'S1', price: 5, usdPrice: 5, quantity: 100, uom: 'g' }),
      variant({ id: 'v2', sku: 'S2', price: 19.5, usdPrice: 19.5, quantity: 500, uom: 'g' }),
    ],
    ...fields,
  });

function variant(fields: Partial<Variant>): Variant {
  return fields as unknown as Variant;
}

/** What the caches held before the refetch. */
const stale = (fields: Partial<Product> = {}): Partial<Product> => ({
  cacheKey: 'ck-1',
  title: 'Acetone',
  cas: '67-64-1',
  formula: 'C3H6O',
  matchPercentage: 88,
  price: 24,
  usdPrice: 24,
  localPrice: 24,
  availability: 'backorder',
  quantity: 500,
  uom: 'g',
  variants: [
    variant({ id: 'v1', sku: 'S1', price: 9, usdPrice: 9, quantity: 100, uom: 'g' }),
    variant({ id: 'v2', sku: 'S2', price: 24, usdPrice: 24, quantity: 500, uom: 'g' }),
  ],
  ...fields,
});

const queryRows = async (cacheKey: string) =>
  (await getAllSupplierQueryCacheEntries()).find((entry) => entry.cacheKey === cacheKey);

describe('patchCachedProduct', () => {
  beforeEach(async () => {
    await clearAllCaches();
  });

  it('updates the product-data cache, keeping identity data and the timestamp', async () => {
    const key = productSeriesKey(fresh())!;
    await putSupplierProductDataCacheEntry(key, { data: stale(), timestamp: 42 });

    await patchCachedProduct(fresh());

    const entry = await getSupplierProductDataCacheEntry(key);
    expect(entry?.timestamp).toBe(42);
    expect(entry?.data).toMatchObject({
      cas: '67-64-1',
      formula: 'C3H6O',
      matchPercentage: 88,
      price: 19.5,
      availability: 'in_stock',
    });
    // Worked out again when the cached listing is loaded.
    expect(entry?.data).not.toHaveProperty('usdPrice');
    expect(entry?.data).not.toHaveProperty('localPrice');
  });

  it('updates only the matching supplier and cacheKey row in query caches', async () => {
    const other = stale({ cacheKey: 'ck-2', price: 7, usdPrice: 7 });
    await putSupplierQueryCacheEntry('q-hit', {
      data: [stale(), other],
      __cacheMetadata: meta('Loudwolf'),
    });
    await putSupplierQueryCacheEntry('q-other-supplier', {
      data: [stale()],
      __cacheMetadata: meta('Elsewhere'),
    });
    await putSupplierQueryCacheEntry('q-no-match', {
      data: [other],
      __cacheMetadata: meta('Loudwolf', 'benzene'),
    });

    await patchCachedProduct(fresh());

    const hit = await queryRows('q-hit');
    expect(hit?.data[0]).toMatchObject({ cas: '67-64-1', matchPercentage: 88, price: 19.5 });
    expect(hit?.data[0]).not.toHaveProperty('usdPrice');
    expect(hit?.data[1]).toEqual(other);
    expect(hit?.__cacheMetadata).toEqual(meta('Loudwolf'));
    expect((await queryRows('q-other-supplier'))?.data).toEqual([stale()]);
    expect((await queryRows('q-no-match'))?.data).toEqual([other]);
  });

  it('gives search results fresh built prices and sizes', async () => {
    const other = product({ cacheKey: 'ck-2', supplier: 'Loudwolf', title: 'Benzene', price: 3 });
    await setSearchResults(
      [product({ ...stale(), supplier: 'Loudwolf', url: 'https://loudwolf.com/acetone' }), other],
      'acetone',
    );

    await patchCachedProduct(fresh());

    const { data, query } = await getSearchResultsRecord();
    expect(query).toBe('acetone');
    expect(data[0]).toMatchObject({
      cas: '67-64-1',
      price: 19.5,
      usdPrice: 19.5,
      localPrice: 19.5,
      baseQuantity: 500,
    });
    expect(data[0].variants?.[0]).toMatchObject({ price: 5, usdPrice: 5 });
    expect(data[1]).toEqual(other);
  });

  it('follows the headline when it moves to another pack size', async () => {
    const key = productSeriesKey(fresh())!;
    await putSupplierProductDataCacheEntry(key, { data: stale(), timestamp: 1 });

    await patchCachedProduct(fresh({ quantity: 100, uom: 'g', price: 5 }));

    expect((await getSupplierProductDataCacheEntry(key))?.data).toMatchObject({
      quantity: 100,
      price: 5,
    });
  });

  it('matches sizes by id, then SKU, then pack size', async () => {
    const key = productSeriesKey(fresh())!;
    await putSupplierProductDataCacheEntry(key, {
      data: stale({
        variants: [
          variant({ id: 'v1', price: 9 }),
          variant({ sku: 'S2', price: 24 }),
          variant({ quantity: 100, uom: 'g', price: 9 }),
        ],
      }),
      timestamp: 1,
    });

    await patchCachedProduct(
      fresh({
        variants: [
          variant({ id: 'v1', sku: 'A', price: 1, quantity: 1, uom: 'kg' }),
          variant({ id: 'v9', sku: 'S2', price: 2, quantity: 2, uom: 'kg' }),
          variant({ id: 'v8', sku: 'S8', price: 3, quantity: 100, uom: 'g' }),
        ],
      }),
    );

    const variants = (await getSupplierProductDataCacheEntry(key))?.data.variants as Variant[];
    expect(variants?.map(({ price }) => price)).toEqual([1, 2, 3]);
  });

  it('leaves ambiguous and unmatched sizes untouched', async () => {
    const key = productSeriesKey(fresh())!;
    const cachedVariants = [
      variant({ sku: 'DUP', price: 10, quantity: 7, uom: 'g' }),
      variant({ id: 'gone', price: 11, quantity: 9, uom: 'kg' }),
    ];
    await putSupplierProductDataCacheEntry(key, {
      data: stale({ variants: cachedVariants }),
      timestamp: 1,
    });

    await patchCachedProduct(
      fresh({
        variants: [
          variant({ sku: 'DUP', price: 1, quantity: 1, uom: 'g' }),
          variant({ sku: 'DUP', price: 2, quantity: 2, uom: 'g' }),
        ],
      }),
    );

    expect((await getSupplierProductDataCacheEntry(key))?.data.variants).toEqual(cachedVariants);
  });

  it('writes nothing when no cache holds the product', async () => {
    const other = stale({ cacheKey: 'ck-2' });
    await putSupplierQueryCacheEntry('q', { data: [other], __cacheMetadata: meta('Loudwolf') });
    await setSearchResults([product({ cacheKey: 'ck-2', supplier: 'Loudwolf', title: 'X' })], 'x');
    const before = await getSearchResultsRecord();

    await patchCachedProduct(fresh());

    expect(await getSupplierProductDataCacheEntry(productSeriesKey(fresh())!)).toBeUndefined();
    expect((await queryRows('q'))?.data).toEqual([other]);
    expect(await getSearchResultsRecord()).toEqual(before);
  });

  it('does nothing for a product that cannot be keyed', async () => {
    await expect(patchCachedProduct(fresh({ supplier: undefined }))).resolves.toBeUndefined();
  });
});
