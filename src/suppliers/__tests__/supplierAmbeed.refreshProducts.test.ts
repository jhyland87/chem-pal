import { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { HttpStatus } from '@/constants/httpStatus';
import { HttpError } from '@/helpers/exceptions';
import { collectNativePrices } from '@/helpers/priceAlerts';
import { toProductRef } from '@/helpers/productRef';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import priceByProid from '../__fixtures__/ambeed/product-price-by-proid.json';
import searchResponse from '../__fixtures__/ambeed/search-dioxane-raw-http-response.json';

vi.mock('@/helpers/cookies', () => ({
  getCookie: vi.fn(async () => ({ value: 'xsrf-token' })),
}));
vi.mock('@/helpers/country', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/helpers/country')>()),
  getUserCountryName: vi.fn(async () => 'United States'),
}));

const { SupplierAmbeed } = await import('@/suppliers/SupplierAmbeed');

type PostCall = { path: string; body?: string };

/** Builds a supplier whose network boundary replays the fixtures. */
function makeSupplier(query = 'dioxane') {
  const supplier = new SupplierAmbeed(query, 10, new AbortController());
  const prices: Record<string, unknown> = { ...priceByProid };
  const errors: Record<string, Error> = {};
  const post = vi.fn(async ({ path, body }: PostCall) => {
    if (path === '/webapi/v1/product_price') {
      const params = new URLSearchParams(body).get('params') ?? '';
      const { proid } = JSON.parse(atob(params));
      if (proid in errors) throw errors[proid];
      return prices[proid] ?? { unexpected: true };
    }
    return { code: 200 };
  });
  const get = vi.fn(async ({ path }: { path: string }) =>
    path.includes('productlistbykeyword') ? searchResponse : { value: {} },
  );
  Object.assign(supplier, {
    httpPostJson: post,
    httpGetJson: get,
    getSdsUrls: vi.fn(async () => ({})),
  });
  return { supplier, any: supplier as any, post, get, prices, errors };
}

const priceCalls = (post: ReturnType<typeof vi.fn>) =>
  post.mock.calls.filter(([call]) => call.path === '/webapi/v1/product_price');

/** A ref captured from a searched product, as the price check stores it. */
async function searchRefs(any: any) {
  const builders: ProductBuilder<Product>[] = await any.queryProducts('dioxane');
  const products = [];
  for (const builder of builders) {
    const product = await any.finishProduct(builder);
    if (product) products.push(product);
  }
  return products;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SupplierAmbeed refreshProducts', () => {
  it('opts in to price alerts', () => {
    expect(SupplierAmbeed.supportsPriceAlerts).toBe(true);
  });

  it('prices every size from one product_price request per product, with no search or stock', async () => {
    const { supplier, any, post, get } = makeSupplier('');
    const searched = await searchRefs(makeSupplier().any);
    const ref = toProductRef(searched[0]);
    if (!ref) throw new Error('expected a ref');

    const [result] = await supplier.refreshProducts([ref]);

    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.OK);
    expect(priceCalls(post)).toHaveLength(1);
    expect(post.mock.calls.map(([call]) => call.path)).not.toContain('/webapi/product_stock');
    expect(get.mock.calls.map(([call]) => call.path)).not.toContain(
      'webapi/v1/productlistbykeyword',
    );
    expect(any.xsrfToken).toBe('xsrf-token');
  });

  it('keeps the same series, headline and prices as a search of the same products', async () => {
    const { any: searcher } = makeSupplier();
    const searched = await searchRefs(searcher);
    expect(searched.length).toBeGreaterThanOrEqual(2);
    expect(searched.some((product) => (product.variants?.length ?? 0) > 1)).toBe(true);

    const { supplier } = makeSupplier('');
    const refs = searched.map((product) => {
      const ref = toProductRef(product);
      if (!ref) throw new Error('expected a ref');
      return ref;
    });
    const results = await supplier.refreshProducts(refs);

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
      expect(result.product.currencyCode).toBe(original.currencyCode);
      expect(result.product.title).toBe(original.title);
      expect(result.product.id).toBe(original.id);
    }
  });

  it('reports a delisted product (p_status false) as UNAVAILABLE', async () => {
    const { supplier, prices } = makeSupplier('');
    const searched = await searchRefs(makeSupplier().any);
    const ref = toProductRef(searched[0]);
    if (!ref) throw new Error('expected a ref');
    prices[String(ref.id)] = {
      source: 1000,
      code: 200,
      lang: 'zh_CN',
      time: '2026',
      value: { proInfo: { p_status: false, listLength: 0, p_am: '' } },
    };

    const [result] = await supplier.refreshProducts([ref]);

    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.UNAVAILABLE);
  });

  it('fails an invalid response instead of keeping the old price', async () => {
    const { supplier, prices } = makeSupplier('');
    const searched = await searchRefs(makeSupplier().any);
    const ref = toProductRef(searched[0]);
    if (!ref) throw new Error('expected a ref');
    prices[String(ref.id)] = { nope: true };

    const [result] = await supplier.refreshProducts([ref]);

    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.FAILED);
  });

  it('fails a live product whose response has no priced size', async () => {
    const { supplier, prices } = makeSupplier('');
    const searched = await searchRefs(makeSupplier().any);
    const ref = toProductRef(searched[0]);
    if (!ref) throw new Error('expected a ref');
    prices[String(ref.id)] = {
      source: 1000,
      code: 200,
      lang: 'en',
      time: '2026',
      value: { proInfo: { p_status: true, listLength: 0 } },
    };

    const [result] = await supplier.refreshProducts([ref]);

    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.FAILED);
  });

  it('reports an HTTP 404 as UNAVAILABLE and any other error as FAILED, per product', async () => {
    const { supplier, errors } = makeSupplier('');
    const searched = await searchRefs(makeSupplier().any);
    const refs = searched.slice(0, 2).map((product) => {
      const ref = toProductRef(product);
      if (!ref) throw new Error('expected a ref');
      return ref;
    });
    errors[String(refs[0].id)] = new HttpError(HttpStatus.NOT_FOUND, 'Not Found');
    errors[String(refs[1].id)] = new HttpError(HttpStatus.INTERNAL_SERVER_ERROR, 'Server Error');

    const results = await supplier.refreshProducts(refs);

    expect(results.map((result) => result.status)).toEqual([
      PRODUCT_REFRESH_STATUS.UNAVAILABLE,
      PRODUCT_REFRESH_STATUS.FAILED,
    ]);
  });
});
