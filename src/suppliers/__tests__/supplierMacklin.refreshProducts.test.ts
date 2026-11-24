import { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { collectNativePrices } from '@/helpers/priceAlerts';
import { toProductRef } from '@/helpers/productRef';
import type { ProductRef } from '@/helpers/productRef';
import type { ProductBuilder } from '@/utils/ProductBuilder';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import listsByCode from '../__fixtures__/macklin/product-list-by-code.json';
import searchResponse from '../__fixtures__/macklin/search-borohydride-by-id-raw-http-response.json';

vi.mock('@/helpers/currency', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/helpers/currency')>()),
  toUSD: vi.fn(async (amount: number) => amount * 0.14),
}));

const { SupplierMacklin } = await import('@/suppliers/SupplierMacklin');

type GetCall = { path: string; params: Record<string, string>; headers: Record<string, string> };

const envelope = (data: unknown, code = 200) =>
  new Response(JSON.stringify({ code, message: '', data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

/** Builds a supplier whose network boundary replays the fixtures. */
function makeSupplier(query = 'borohydride') {
  const supplier = new SupplierMacklin(query, 10, new AbortController());
  const lists: Record<string, unknown> = {};
  for (const [code, response] of Object.entries(listsByCode)) lists[code] = response.data;
  const get = vi.fn(async ({ path, params }: GetCall) => {
    if (path === '/api/item/search') return envelope(searchResponse.data);
    if (path === '/api/product/list') {
      return envelope(lists[params.code] ?? { list: [], safe: '', item: [], bulk_product: [] });
    }
    return envelope([]);
  });
  const getJson = vi.fn(async () => ({
    code: 200,
    message: 'ok',
    data: { timestamp: Math.round(Date.now() / 1000) },
  }));
  const post = vi.fn(async () => envelope([]));
  Object.assign(supplier, { httpGet: get, httpGetJson: getJson, httpPost: post });
  return { supplier, any: supplier as any, get, getJson, post, lists };
}

const listCalls = (get: ReturnType<typeof vi.fn>) =>
  get.mock.calls.filter(([call]) => call.path === '/api/product/list');

/** Products as a search produces them, with the product-detail cache bypassed. */
async function searchProducts() {
  const { any } = makeSupplier();
  Object.assign(any, {
    getProductDataWithCache: async (b: ProductBuilder<Product>, f: any) => f(b),
  });
  await any.setup();
  const builders: ProductBuilder<Product>[] = (await any.queryProducts('borohydride')) ?? [];
  any.products = builders;
  const products: Product[] = [];
  for (const builder of builders) {
    const filled = await any.getProductData(builder);
    const product = filled && (await any.finishProduct(filled));
    if (product) products.push(product);
  }
  return products;
}

const refsOf = (products: Product[]): ProductRef[] =>
  products.map((product) => {
    const ref = toProductRef(product);
    if (!ref) throw new Error('expected a ref');
    return ref;
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SupplierMacklin refreshProducts', () => {
  it('opts in to price alerts', () => {
    expect(SupplierMacklin.supportsPriceAlerts).toBe(true);
  });

  it('makes one signed list request per product, with no search, info or SDS request', async () => {
    const refs = refsOf(await searchProducts());
    const { supplier, get, post } = makeSupplier('');

    const results = await supplier.refreshProducts(refs);

    expect(results.every((result) => result.status === PRODUCT_REFRESH_STATUS.OK)).toBe(true);
    expect(listCalls(get)).toHaveLength(refs.length);
    const paths = get.mock.calls.map(([call]) => call.path);
    expect(paths).not.toContain('/api/item/search');
    expect(paths).not.toContain('/api/msds/search');
    expect(post).not.toHaveBeenCalled();
    for (const [call] of listCalls(get)) {
      expect(call.headers.sign).toMatch(/^[0-9a-f]{64}$/);
      expect(call.params.timestampe).toBeDefined();
    }
  });

  it('does not reuse the first batch when a second batch is refreshed', async () => {
    const refs = refsOf(await searchProducts());
    const { supplier, get, lists } = makeSupplier('');

    await supplier.refreshProducts(refs);
    const [first] = refs;
    const rows = (lists[String(first.uuid)] as { list: { product_price: string }[] }).list;
    for (const row of rows) row.product_price = '1.00';
    const [again] = await supplier.refreshProducts([first]);

    expect(listCalls(get)).toHaveLength(refs.length + 1);
    expect(again.status === PRODUCT_REFRESH_STATUS.OK && again.product.price).toBe(1);
  });

  it('keeps the same series, headline and prices as a search of the same products', async () => {
    const searched = await searchProducts();
    expect(searched.length).toBeGreaterThanOrEqual(2);
    expect(searched.some((product) => (product.variants?.length ?? 0) > 1)).toBe(true);
    const { supplier } = makeSupplier('');

    const results = await supplier.refreshProducts(refsOf(searched));

    for (const result of results) {
      const original = searched.find((product) => product.cacheKey === result.ref.cacheKey);
      if (result.status !== PRODUCT_REFRESH_STATUS.OK || !original) {
        throw new Error(`expected both routes to produce ${result.ref.cacheKey}`);
      }
      expect(Object.keys(collectNativePrices(result.product))).toEqual(
        Object.keys(collectNativePrices(original)),
      );
      expect(collectNativePrices(result.product)).toEqual(collectNativePrices(original));
      expect(result.product.price).toBe(original.price);
      expect(result.product.quantity).toBe(original.quantity);
      expect(result.product.uom).toBe(original.uom);
      expect(result.product.currencyCode).toBe('CNY');
      expect(result.product.id).toBe(original.id);
    }
  });

  it('omits an out-of-stock size and falls back to the cheapest size left, as a search does', async () => {
    const searched = await searchProducts();
    const { supplier, lists } = makeSupplier('');
    const ref = refsOf(searched)[0];
    const rows = (lists[String(ref.uuid)] as { list: { product_stock: string }[] }).list;
    rows[0].product_stock = '0.000';

    const [result] = await supplier.refreshProducts([ref]);

    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.OK);
    expect(result.status === PRODUCT_REFRESH_STATUS.OK && result.product.variants).toHaveLength(
      rows.filter((row) => Number(row.product_stock) > 0).length,
    );
  });

  it('reports a product with no in-stock size as UNAVAILABLE', async () => {
    const [ref] = refsOf(await searchProducts());
    const { supplier, lists } = makeSupplier('');
    const rows = (lists[String(ref.uuid)] as { list: { product_stock: string }[] }).list;
    for (const row of rows) row.product_stock = '0.000';

    const [result] = await supplier.refreshProducts([ref]);

    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.UNAVAILABLE);
  });

  it('reports a product Macklin returns no rows for as UNAVAILABLE', async () => {
    const [ref] = refsOf(await searchProducts());
    const { supplier, lists } = makeSupplier('');
    delete lists[String(ref.uuid)];

    const [result] = await supplier.refreshProducts([ref]);

    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.UNAVAILABLE);
  });

  it('fails a response that is not a product list instead of keeping the old price', async () => {
    const [ref] = refsOf(await searchProducts());
    const { supplier, lists } = makeSupplier('');
    lists[String(ref.uuid)] = [];

    const [result] = await supplier.refreshProducts([ref]);

    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.FAILED);
  });
});
