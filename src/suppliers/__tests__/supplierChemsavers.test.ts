// ProductBuilder must be imported before SupplierBase/SupplierChemsavers (module-init cycle).
import { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { HttpError } from '@/helpers/exceptions';
import { collectNativePrices } from '@/helpers/priceAlerts';
import { productSeriesKey, variantSeriesKey } from '@/helpers/priceHistory';
import { toProductRef, type ProductRef } from '@/helpers/productRef';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import byIdResponse from '../__fixtures__/chemsavers/by-id.json';
import searchResponse from '../__fixtures__/chemsavers/search-sodium-acetate.json';

const storageState = { data: {} as Record<string, unknown> };

vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: {
      get: vi.fn(async (keys: string[]) =>
        Object.fromEntries(
          keys.filter((k) => k in storageState.data).map((k) => [k, storageState.data[k]]),
        ),
      ),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(storageState.data, items);
      }),
      remove: vi.fn(async (key: string) => {
        delete storageState.data[key];
      }),
    },
  },
}));

vi.mock('@/utils/SupplierCache', () => ({
  SupplierCache: class {
    constructor(..._args: unknown[]) {}
    getProductIdentityCacheKey(identity: string) {
      return `id:${identity}`;
    }
  },
}));

const { SupplierChemsavers } = await import('@/suppliers/SupplierChemsavers');

type Doc = ChemsaversProductObject;
type PostArgs = { body: { searches: Array<Record<string, unknown>> }; params: unknown };

const docsOf = (response: unknown): Doc[] =>
  (response as { results: Array<{ hits: Array<{ document: Doc }> }> }).results[0].hits.map(
    (hit) => hit.document,
  );
const wrap = (docs: Doc[]) => ({ results: [{ hits: docs.map((document) => ({ document })) }] });
const byIdDocs = docsOf(byIdResponse);

/** Builds a supplier whose Typesense POST is stubbed. */
function makeSupplier(post: ReturnType<typeof vi.fn>) {
  const supplier = new SupplierChemsavers('sodium acetate', 20, new AbortController());
  const rehydrate = vi.fn(async () => undefined);
  Object.assign(supplier, { httpPostJson: post, rehydrateApiKey: rehydrate });
  vi.spyOn(supplier as never, 'fuzzyFilterAst').mockImplementation((list: unknown) => list);
  return { supplier, rehydrate, internals: supplier as never as Record<string, never> };
}

/** Runs a search over the fixture and returns the finished products. */
async function searchProducts(): Promise<Product[]> {
  const { supplier } = makeSupplier(vi.fn(async () => searchResponse));
  const builders = await (
    supplier as unknown as {
      queryProducts(q: string, l: number): Promise<ProductBuilder<Product>[]>;
    }
  ).queryProducts('sodium acetate', 20);
  const products = await Promise.all(builders.map((builder) => builder.build()));
  return products.filter((product): product is Product => product !== undefined);
}

const refsOf = (products: Product[]): ProductRef[] =>
  products.flatMap((product) => toProductRef(product) ?? []);

beforeEach(() => {
  storageState.data = {};
});

describe('SupplierChemsavers.refreshProducts', () => {
  it('is flagged as price-alert capable', () => {
    expect(SupplierChemsavers.supportsPriceAlerts).toBe(true);
  });

  it('refetches the heads and all their sizes in one id-filtered request', async () => {
    const refs = refsOf(await searchProducts());
    expect(refs.map((ref) => ref.cacheKey)).toEqual(['49171', '121410']);
    const post = vi.fn(async (_request: PostArgs) => byIdResponse);
    const { supplier } = makeSupplier(post);

    const results = await supplier.refreshProducts(refs);

    expect(post).toHaveBeenCalledTimes(1);
    const [search] = post.mock.calls[0][0].body.searches;
    expect(search.q).toBe('*');
    expect(search.per_page).toBe(6);
    expect(search.filter_by).toBe('id:[`49171`,`49170`,`49169`,`121410`,`121409`,`121408`]');
    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.OK,
      PRODUCT_REFRESH_STATUS.OK,
    ]);
  });

  it('keeps the head, its cacheKey and its sizes as the search found them', async () => {
    const searched = await searchProducts();
    const { supplier } = makeSupplier(vi.fn(async () => byIdResponse));

    const results = await supplier.refreshProducts(refsOf(searched));

    for (const result of results) {
      const before = searched.find((p) => p.cacheKey === result.ref.cacheKey);
      if (result.status !== PRODUCT_REFRESH_STATUS.OK || !before) throw new Error('missing');
      expect(result.product.id).toBe(before.id);
      expect(result.product.price).toBe(before.price);
      expect(result.product.variants?.map((v) => v.id)).toEqual(before.variants?.map((v) => v.id));
      expect(before.variants).toHaveLength(2);
    }
  });

  it('yields the same series keys and prices as a search of the same items', async () => {
    const searched = await searchProducts();
    const { supplier } = makeSupplier(vi.fn(async () => byIdResponse));

    const results = await supplier.refreshProducts(refsOf(searched));

    for (const result of results) {
      const before = searched.find((p) => p.cacheKey === result.ref.cacheKey);
      if (result.status !== PRODUCT_REFRESH_STATUS.OK || !before) throw new Error('missing');
      expect(productSeriesKey(result.product)).toBeDefined();
      expect(productSeriesKey(result.product)).toBe(productSeriesKey(before));
      const keys = (p: Product) => (p.variants ?? []).map((v) => variantSeriesKey(p, v));
      expect(keys(result.product)).toEqual(keys(before));
      expect(collectNativePrices(result.product)).toEqual(collectNativePrices(before));
      expect(Object.keys(collectNativePrices(result.product)).length).toBeGreaterThan(1);
    }
  });

  it('prices from the sale price when one is set', async () => {
    const refs = refsOf(await searchProducts());
    const docs = byIdDocs.map((doc) => (doc.id === '121408' ? { ...doc, salePrice: 100 } : doc));
    const { supplier } = makeSupplier(vi.fn(async () => wrap(docs)));

    const results = await supplier.refreshProducts(refs);

    const result = results.find((r) => r.ref.cacheKey === '121410');
    if (result?.status !== PRODUCT_REFRESH_STATUS.OK) throw new Error('expected OK');
    expect(result.product.variants?.find((v) => v.id === '121408')?.price).toBe(100);
  });

  it('reports a head that is gone or out of stock as UNAVAILABLE', async () => {
    const refs = refsOf(await searchProducts());
    const docs = byIdDocs
      .filter((doc) => doc.id !== '121410')
      .map((doc) =>
        doc.id === '49171' ? { ...doc, inventory_tracking: 'product', inventoryLevel: 0 } : doc,
      );
    const { supplier } = makeSupplier(vi.fn(async () => wrap(docs)));

    const results = await supplier.refreshProducts(refs);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.UNAVAILABLE,
      PRODUCT_REFRESH_STATUS.UNAVAILABLE,
    ]);
  });

  it('leaves out a missing or out-of-stock size and keeps the rest', async () => {
    const refs = refsOf(await searchProducts());
    const docs = byIdDocs
      .filter((doc) => doc.id !== '49169')
      .map((doc) =>
        doc.id === '121409' ? { ...doc, inventory_tracking: 'product', inventoryLevel: 0 } : doc,
      );
    const { supplier } = makeSupplier(vi.fn(async () => wrap(docs)));

    const results = await supplier.refreshProducts(refs);

    const variantIds = results.map((r) =>
      r.status === PRODUCT_REFRESH_STATUS.OK ? r.product.variants?.map((v) => v.id) : undefined,
    );
    expect(variantIds).toEqual([['49170'], ['121408']]);
  });

  it('fails the batch instead of reporting unavailable when the request fails', async () => {
    const refs = refsOf(await searchProducts());
    const post = vi.fn(async () => {
      throw new HttpError(500, 'Server Error');
    });
    const { supplier } = makeSupplier(post);

    const results = await supplier.refreshProducts(refs);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.FAILED,
      PRODUCT_REFRESH_STATUS.FAILED,
    ]);
  });

  it('fails the batch on an invalid response', async () => {
    const refs = refsOf(await searchProducts());
    const { supplier } = makeSupplier(vi.fn(async () => ({ results: [] })));

    const [result] = await supplier.refreshProducts(refs);

    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.FAILED);
  });

  it('fails a head whose title no longer parses', async () => {
    const refs = refsOf(await searchProducts());
    const docs = byIdDocs.map((doc) => (doc.id === '49171' ? { ...doc, name: 'RENAMED' } : doc));
    const { supplier } = makeSupplier(vi.fn(async () => wrap(docs)));

    const results = await supplier.refreshProducts(refs);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.FAILED,
      PRODUCT_REFRESH_STATUS.OK,
    ]);
  });

  it('rehydrates the key once on a 401 and retries the same request', async () => {
    const refs = refsOf(await searchProducts());
    const post = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(401, 'Unauthorized'))
      .mockResolvedValueOnce(byIdResponse);
    const { supplier, rehydrate } = makeSupplier(post);

    const results = await supplier.refreshProducts(refs);

    expect(rehydrate).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][0]).toEqual(post.mock.calls[0][0]);
    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.OK,
      PRODUCT_REFRESH_STATUS.OK,
    ]);
  });

  it('fails when the retry after a 401 is rejected too', async () => {
    const refs = refsOf(await searchProducts());
    const post = vi.fn(async () => {
      throw new HttpError(401, 'Unauthorized');
    });
    const { supplier, rehydrate } = makeSupplier(post);

    const [result] = await supplier.refreshProducts(refs);

    expect(rehydrate).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.FAILED);
  });

  it('splits requests so none asks for more than 250 ids', async () => {
    const [head] = refsOf(await searchProducts());
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...head,
      cacheKey: `9${i}`,
      id: `9${i}`,
      variants: Array.from({ length: 24 }, (_, j) => ({ id: `${i}${String(j).padStart(2, '0')}` })),
    }));
    const post = vi.fn(async (_request: PostArgs) => wrap([]));
    const { supplier } = makeSupplier(post);

    await supplier.refreshProducts(many);

    const sizes = post.mock.calls.map((call) => call[0].body.searches[0].per_page as number);
    expect(sizes).toHaveLength(2);
    expect(Math.max(...sizes)).toBe(250);
  });

  it('leaves the search path unchanged: a non-401 search error yields no products', async () => {
    const post = vi.fn(async () => {
      throw new HttpError(500, 'Server Error');
    });
    const { supplier } = makeSupplier(post);

    const result = await (
      supplier as unknown as { queryProducts(q: string, l: number): Promise<unknown> }
    ).queryProducts('acid', 10);

    expect(result).toBeUndefined();
  });
});
