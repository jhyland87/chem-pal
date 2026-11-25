import { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { productSeriesKey, variantSeriesKey } from '@/helpers/priceHistory';
import type { ProductRef } from '@/helpers/productRef';
import { getSupplierColor, SUPPLIER_COLORS } from '@/theme/colors';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { type JsonValue } from 'type-fest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import outOfStock from '../__fixtures__/albochemicals/out-of-stock-product.json';
import byIdProducts from '../__fixtures__/consolidatedchemical/products-by-id.json';
import variations from '../__fixtures__/consolidatedchemical/variations.json';

// Per-identity product-data cache, so one product can hit and another miss.
const cacheState = { productDataByKey: {} as Record<string, Record<string, unknown>> };

vi.mock('@/utils/SupplierCache', () => ({
  SupplierCache: class MockSupplierCache {
    private supplierName: string;
    constructor(supplierName: string) {
      this.supplierName = supplierName;
    }
    generateCacheKey(query: string) {
      return `${this.supplierName}:${query}`;
    }
    async getCachedQueryEntry() {
      return null;
    }
    async cacheQueryResults() {}
    getProductIdentityCacheKey(identity: string) {
      return `id:${identity}`;
    }
    async getCachedProductData(key: string) {
      return cacheState.productDataByKey[key] ?? null;
    }
    cacheProductData = vi.fn(async () => {});
  },
}));

// Bypass the search-response schema check unless a test turns it on; we feed builders directly.
const schema = vi.hoisted(() => ({ bypass: true }));
vi.mock('@/utils/typeGuards/woocommerce', async () => {
  const actual = await vi.importActual<typeof import('@/utils/typeGuards/woocommerce')>(
    '@/utils/typeGuards/woocommerce',
  );
  return {
    ...actual,
    isSearchResponse: (response: unknown) => schema.bypass || actual.isSearchResponse(response),
  };
});

const { SupplierBaseWoocommerce } = await import('@/suppliers/SupplierBaseWoocommerce');

/**
 * Concrete WooCommerce supplier that stubs the network + parse boundaries so we
 * can exercise the real queryProducts → partitionForBatch → enrichVariants
 * wiring. `initProductBuilders` returns two pre-stamped builders (ids "1", "2"),
 * each carrying one variant; `fetchVariantData` records which variant ids were
 * requested.
 */
class TestWoo extends SupplierBaseWoocommerce {
  public static readonly supplierName = 'TestWoo';
  public static readonly baseURL = 'https://woo.example';
  public static readonly shipping = 'worldwide' as ShippingRange;
  public static readonly country = 'US' as CountryCode;
  public static readonly paymentMethods = [] as PaymentMethod[];

  public requestedVariantIds: number[] = [];

  protected override async httpGetJson(): Promise<Maybe<JsonValue>> {
    // Two dummy items; isSearchResponse is mocked to accept them.
    return [{ id: 1 }, { id: 2 }] as unknown as Maybe<JsonValue>;
  }

  protected override stripInvalidResults(results: unknown[]): never[] {
    return results as never[];
  }

  protected override fuzzyFilterAst<X>(results: X[]): X[] {
    return results;
  }

  protected override initProductBuilders(): ProductBuilder<Product>[] {
    const make = (id: string, variantId: number) => {
      const b = new ProductBuilder<Product>(this.baseURL);
      b.setData({
        url: `${this.baseURL}/wp-json/wc/store/v1/products/${id}`,
        cacheKey: id,
        variants: [{ id: variantId }],
      } as Partial<Product>);
      return b;
    };
    return [make('1', 101), make('2', 202)];
  }

  protected override async fetchVariantData(variantIds: number[]) {
    this.requestedVariantIds.push(...variantIds);
    return new Map();
  }

  public callQueryProducts(query: string, limit: number) {
    return (
      this as unknown as {
        queryProducts: (q: string, l: number) => Promise<ProductBuilder<Product>[] | void>;
      }
    ).queryProducts(query, limit);
  }
}

describe('SupplierBaseWoocommerce cross-query hydration', () => {
  beforeEach(() => {
    cacheState.productDataByKey = {};
  });
  afterEach(() => vi.restoreAllMocks());

  it('hydrates a cached product and skips its variant fetch on a different query', async () => {
    const supplier = new TestWoo('q', 10, new AbortController());
    supplier.initCache();
    // Product id "1" was enriched under a prior (different) search.
    cacheState.productDataByKey['id:1'] = { description: 'cached-desc-1' };

    const result = await supplier.callQueryProducts('anything', 10);

    // Both products survive; product 1 came from cache, product 2 was enriched.
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    // Only product 2's variant id entered the bulk fetch — product 1 was hydrated.
    expect(supplier.requestedVariantIds).toEqual([202]);
    // Product 1 carries the hydrated cache data.
    const hydrated = (result as ProductBuilder<Product>[]).find((b) => b.get('cacheKey') === '1');
    expect(hydrated?.get('description')).toBe('cached-desc-1');
  });

  it('enriches every product when nothing is cached', async () => {
    const supplier = new TestWoo('q', 10, new AbortController());
    supplier.initCache();

    const result = await supplier.callQueryProducts('anything', 10);

    expect(result).toHaveLength(2);
    expect(supplier.requestedVariantIds.sort()).toEqual([101, 202]);
  });

  it('defaults color to a stable palette color derived from the class name', () => {
    const supplier = new TestWoo('q', 10, new AbortController());
    expect(SUPPLIER_COLORS).toContain(supplier.color);
    expect(supplier.color).toBe(getSupplierColor('TestWoo'));
    // Same class → same color on a second instance.
    expect(new TestWoo('other', 5, new AbortController()).color).toBe(supplier.color);
  });
});

describe('SupplierBaseWoocommerce queryProductsById', () => {
  beforeEach(() => {
    cacheState.productDataByKey = {};
    schema.bypass = false;
  });
  afterEach(() => {
    schema.bypass = true;
    vi.restoreAllMocks();
  });

  /** Real parsing; only the HTTP boundary is replaced. */
  class RealWoo extends SupplierBaseWoocommerce {
    public static readonly supplierName = 'RealWoo';
    public static readonly baseURL = 'https://woo.example';
    public static readonly shipping = 'worldwide' as ShippingRange;
    public static readonly country = 'US' as CountryCode;
    public static readonly paymentMethods = [] as PaymentMethod[];

    protected override fuzzyFilterAst<X>(results: X[]): X[] {
      return results;
    }
  }

  type Call = { path: string; params: Record<string, unknown> };

  /** A supplier whose Store API serves `products` and `variations` by their `include` param. */
  const makeSupplier = (
    products: unknown[] | unknown = byIdProducts,
    variationItems: unknown[] = variations,
  ) => {
    const supplier = new RealWoo('', 5, new AbortController());
    supplier.initCache();
    const get = vi.spyOn(supplier as never, 'httpGetJson').mockImplementation((async (
      call: Call,
    ) => {
      if (call.params.type !== 'variation') return products;
      const wanted = String(call.params.include).split(',').map(Number);
      return variationItems.filter((item) => wanted.includes((item as { id: number }).id));
    }) as never);
    return { supplier, get };
  };

  const ref = (id: number | string): ProductRef => ({
    cacheKey: String(id),
    title: String(id),
    url: `https://woo.example/wp-json/wc/store/v1/products/${id}`,
    variants: [],
  });

  it('requests the products in one call with an include param', async () => {
    const { supplier, get } = makeSupplier();

    await supplier.refreshProducts([ref(16118), ref(15449)]);

    const first = get.mock.calls[0][0] as unknown as Call;
    expect(first.path).toBe('/wp-json/wc/store/v1/products');
    expect(first.params.include).toBe('16118,15449');
    expect(first.params.type).toBeUndefined();
  });

  it('returns OK products with their variants enriched from a variation request', async () => {
    const { supplier, get } = makeSupplier();

    const results = await supplier.refreshProducts([ref(16118), ref(15449)]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.OK,
      PRODUCT_REFRESH_STATUS.OK,
    ]);
    const variationCall = get.mock.calls
      .map(([call]) => call as unknown as Call)
      .find((call) => call.params.type === 'variation');
    expect(variationCall?.params.include).toBe('16122,16123,15451,15452');

    const [pinene] = results;
    if (pinene.status !== PRODUCT_REFRESH_STATUS.OK) throw new Error('expected OK');
    expect(pinene.product.variants).toHaveLength(2);
    expect(pinene.product.variants?.map((v) => v.id)).toEqual([16122, 16123]);
    expect(pinene.product.variants?.every((v) => v.url?.endsWith(`/products/${v.id}`))).toBe(true);
    expect(pinene.product.variants?.every((v) => typeof v.price === 'number')).toBe(true);
  });

  it('reports an out-of-stock product as UNAVAILABLE, not FAILED', async () => {
    const { supplier } = makeSupplier(outOfStock);

    const [result] = await supplier.refreshProducts([ref(37837)]);

    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.UNAVAILABLE);
  });

  it('reports a non-purchasable product as UNAVAILABLE', async () => {
    const [first] = byIdProducts;
    const { supplier } = makeSupplier([{ ...first, is_purchasable: false }]);

    const [result] = await supplier.refreshProducts([ref(first.id)]);

    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.UNAVAILABLE);
  });

  it('treats an empty list, which is how the API answers all-missing ids, as UNAVAILABLE', async () => {
    const { supplier } = makeSupplier([]);

    const results = await supplier.refreshProducts([ref(999991), ref(999992)]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.UNAVAILABLE,
      PRODUCT_REFRESH_STATUS.UNAVAILABLE,
    ]);
  });

  it('marks only the missing id UNAVAILABLE when the others are found', async () => {
    const { supplier } = makeSupplier();

    const results = await supplier.refreshProducts([ref(16118), ref(999991), ref(15449)]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.OK,
      PRODUCT_REFRESH_STATUS.UNAVAILABLE,
      PRODUCT_REFRESH_STATUS.OK,
    ]);
  });

  it.each([
    ['an error object', { code: 'rest_no_route', message: 'No route' }],
    ['a string', 'Service Unavailable'],
    ['items missing prices', [{ id: 1 }]],
  ])('fails every ref when the response is invalid (%s)', async (_label, response) => {
    const { supplier } = makeSupplier(response);

    const results = await supplier.refreshProducts([ref(16118), ref(15449)]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.FAILED,
      PRODUCT_REFRESH_STATUS.FAILED,
    ]);
    expect(results[0]).toMatchObject({ reason: 'Invalid WooCommerce products response' });
  });

  it('keeps the same product and variant series as a search of the same items', async () => {
    const { supplier: searcher } = makeSupplier();
    const searched = await (
      searcher as unknown as {
        queryProducts: (q: string, l: number) => Promise<ProductBuilder<Product>[]>;
      }
    ).queryProducts('pinene', 5);
    const searchedProducts = await Promise.all(searched.map((builder) => builder.build()));

    const { supplier } = makeSupplier();
    const results = await supplier.refreshProducts([ref(16118), ref(15449)]);

    expect(results).toHaveLength(2);
    results.forEach((result, index) => {
      const searchedProduct = searchedProducts.find((p) => p?.cacheKey === result.ref.cacheKey);
      if (result.status !== PRODUCT_REFRESH_STATUS.OK || !searchedProduct) {
        throw new Error(`expected both routes to produce product ${index}`);
      }
      expect(productSeriesKey(result.product)).toBeDefined();
      expect(productSeriesKey(result.product)).toBe(productSeriesKey(searchedProduct));
      const keys = (product: Product) =>
        (product.variants ?? []).map((variant) => variantSeriesKey(product, variant));
      expect(keys(result.product)).toEqual(keys(searchedProduct));
      expect(keys(result.product).length).toBeGreaterThan(1);
      expect(keys(result.product).every((key) => key !== undefined)).toBe(true);
    });
  });
});
