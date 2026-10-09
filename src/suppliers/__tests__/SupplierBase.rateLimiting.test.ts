// ProductBuilder must be imported before SupplierBase (module-init cycle).
import { HttpError } from '@/helpers/exceptions';
import { Logger } from '@/utils/Logger';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierBase } from '../SupplierBase';

const stats = vi.hoisted(() => ({ incrementParseError: vi.fn() }));

vi.mock('@/utils/SupplierStatsStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/SupplierStatsStore')>()),
  incrementParseError: (...args: unknown[]) => stats.incrementParseError(...args),
}));
vi.mock('@/utils/SupplierCache', () => ({
  SupplierCache: class {
    generateCacheKey(query: string) {
      return `k:${query}`;
    }
    async getCachedQueryEntry() {
      return null;
    }
    async cacheQueryResults() {}
    getProductIdentityCacheKey(identity: string) {
      return `identity:${identity}`;
    }
    async getCachedProductData() {
      return null;
    }
    async cacheProductData() {}
  },
}));
vi.mock('@/helpers/excludedProducts', () => ({
  countExcludedProductsForSupplier: async () => 0,
  loadExcludedProductKeys: async () => new Set<string>(),
}));

class TestSupplier extends SupplierBase<unknown, Product> {
  public static readonly supplierName = 'RateLimitTestSupplier';
  public static readonly baseURL = 'https://example.invalid';
  public static readonly shipping = 'worldwide' as ShippingRange;
  public static readonly country = 'US' as CountryCode;
  public static readonly paymentMethods = [] as PaymentMethod[];

  protected titleSelector(): Maybe<string> {
    return '';
  }
  protected getUniqueProductKey(data: unknown): string {
    return String((data as { id?: unknown })?.id ?? '');
  }
  protected async queryProducts(): Promise<ProductBuilder<Product>[] | void> {
    return [];
  }
}

/** The protected members these tests drive. */
type Internals = {
  fetch: (url: string, init: unknown) => Promise<unknown>;
  httpGet: (options: { path: string }) => Promise<unknown>;
  queryProductsWithCache: () => Promise<ProductBuilder<Product>[]>;
  getProductDataWithCache: (
    product: ProductBuilder<Product>,
    fetcher: (builder: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>,
  ) => Promise<unknown>;
  finishProduct: (builder: ProductBuilder<Product>) => Promise<Product | undefined>;
};

function makeSupplier() {
  const supplier = new TestSupplier('acetone', 5, new AbortController());
  supplier.initCache();
  return supplier as unknown as TestSupplier & Internals;
}

describe('SupplierBase rate-limit logging and failure counting', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let debug: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stats.incrementParseError.mockReset();
    // jsdom's AbortSignal isn't the one Node's Request accepts; httpGet only reads `.url` from it.
    vi.stubGlobal(
      'Request',
      class FakeRequest {
        constructor(
          public readonly url: string,
          public readonly init?: unknown,
        ) {}
      },
    );
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('429 responses', () => {
    /** Makes `count` requests that the supplier answers with a 429. */
    async function throttle(supplier: ReturnType<typeof makeSupplier>, count: number) {
      vi.spyOn(supplier, 'fetch').mockRejectedValue(new HttpError(429, 'Too Many Requests'));
      for (let i = 0; i < count; i += 1) {
        await supplier.httpGet({ path: '/x' });
      }
    }

    it('warns about the first rate-limited request and logs the rest at debug', async () => {
      const supplier = makeSupplier();
      await throttle(supplier, 4);

      const rateLimited = (calls: unknown[][]) =>
        calls.filter(([message]) => String(message).startsWith('Rate limited during fetch'));
      expect(rateLimited(warn.mock.calls)).toHaveLength(1);
      expect(rateLimited(debug.mock.calls)).toHaveLength(3);
      expect(error).not.toHaveBeenCalled();
    });

    it('reports the total once when the supplier finishes', async () => {
      const supplier = makeSupplier();
      vi.spyOn(supplier, 'queryProductsWithCache').mockResolvedValue([]);
      await throttle(supplier, 3);

      for await (const _product of supplier.execute()) {
        // no products: execute() just runs to its end
      }

      expect(warn).toHaveBeenCalledWith('Supplier rate limited 3 requests', {
        supplier: 'RateLimitTestSupplier',
        rateLimitedRequests: 3,
      });
    });

    it('does not add a summary for a single rate-limited request', async () => {
      const supplier = makeSupplier();
      vi.spyOn(supplier, 'queryProductsWithCache').mockResolvedValue([]);
      await throttle(supplier, 1);

      for await (const _product of supplier.execute()) {
        // no products
      }

      expect(warn.mock.calls.map(([message]) => String(message))).not.toContainEqual(
        expect.stringContaining('Supplier rate limited'),
      );
    });
  });

  describe('product detail failures', () => {
    it.each([
      ['the user stopping the search', 'user_aborted'],
      ['the time budget elapsing', 'time_budget_exceeded'],
      ['an AbortError', new DOMException('stop', 'AbortError')],
    ])('does not count %s as a parse error', async (_label, thrown) => {
      const supplier = makeSupplier();
      const product = new ProductBuilder<Product>('https://example.invalid');
      product.setData({ url: 'https://example.invalid/p/1' } as Partial<Product>);

      await supplier.getProductDataWithCache(product, async () => {
        throw thrown;
      });

      expect(stats.incrementParseError).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('still counts a real failure as a parse error and logs it', async () => {
      const supplier = makeSupplier();
      const product = new ProductBuilder<Product>('https://example.invalid');
      product.setData({ url: 'https://example.invalid/p/1' } as Partial<Product>);

      await supplier.getProductDataWithCache(product, async () => {
        throw new TypeError('bad markup');
      });

      expect(stats.incrementParseError).toHaveBeenCalledWith('RateLimitTestSupplier');
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('Error in product detail fetcher: bad markup'),
        expect.any(Object),
      );
    });
  });

  it('logs a product that cannot be finished at debug, since the missing fields are warned about already', async () => {
    const supplier = makeSupplier();
    const builder = new ProductBuilder<Product>('https://example.invalid');

    await expect(supplier.finishProduct(builder)).resolves.toBeUndefined();

    expect(debug).toHaveBeenCalledWith(
      'Unable to finish product - Minimum data not set',
      expect.any(Object),
    );
    expect(warn.mock.calls.map(([message]) => String(message))).not.toContain(
      'Unable to finish product - Minimum data not set',
    );
  });
});
