import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { SupplierBase } from '../SupplierBase';

// Toggle-able cache stubs so each test can simulate hits / misses.
const cacheState = {
  queryHit: false as
    | false
    | { data: unknown[]; __cacheMetadata: { limit: number; supplierModule?: string } },
  productHit: false as false | Record<string, unknown>,
};

vi.mock('@/utils/SupplierCache', () => {
  return {
    SupplierCache: class MockSupplierCache {
      private supplierName: string;
      constructor(
        supplierName: string,
        _supplierModule: string,
        _enabled: boolean = true,
        _doNotCacheEmptyResults: boolean = false,
        _cacheTtlMinutes: number = 0,
      ) {
        this.supplierName = supplierName;
      }
      generateCacheKey(query: string) {
        return `${this.supplierName}:${query}`;
      }
      async getCachedQueryEntry() {
        return cacheState.queryHit || null;
      }
      async cacheQueryResults() {}
      getProductIdentityCacheKey(identity: string) {
        return `identity:${identity}`;
      }
      async getCachedProductData() {
        return cacheState.productHit || null;
      }
      async cacheProductData() {}
    },
  };
});

vi.mock('@/helpers/excludedProducts', () => ({
  countExcludedProductsForSupplier: async () => 0,
  loadExcludedProductKeys: async () => new Set<string>(),
}));

const tick = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Records cookie-seed vs setup order so we can assert seeding runs first.
const callOrder: string[] = [];

// Stub for chrome.cookies.set, which the real setCookie helper calls. Pushing
// "seed" here lets us assert seeding happened and ran before setup().
const cookieSetMock = vi.fn(async () => {
  callOrder.push('seed');
  return null;
});

/**
 * Test double exposing the protected query / product-data entry points and
 * recording whether setup had resolved at the moment each fetcher ran. The
 * fake `setup()` carries a controllable delay so concurrency can be
 * exercised.
 */
class TestSupplier extends SupplierBase<unknown, Product> {
  public readonly supplierName = 'TestSupplier';
  public readonly baseURL = 'https://example.invalid';
  public readonly shipping = 'worldwide' as ShippingRange;
  public readonly country = 'US' as CountryCode;
  public readonly paymentMethods = [] as PaymentMethod[];

  public setupCallCount = 0;
  public setupDone = false;
  public setupDelayMs = 30;
  // Each product fetch records whether setup had resolved when it ran.
  public readonly fetchersSawSetupDone: boolean[] = [];

  public override readonly requiredCookies: SupplierCookieSeed[] = [
    { name: 'currency', value: '2' },
  ];

  // The last Request httpPost handed to fetch — inspected for credentials.
  public lastRequest?: Request;

  protected titleSelector(): Maybe<string> {
    return '';
  }

  protected getUniqueProductKey(data: unknown): string {
    return String((data as { id?: unknown })?.id ?? '');
  }

  // Capture the Request httpPost builds; return a minimal ok JSON response so
  // httpPost's response checks pass without hitting the network.
  protected override async fetch(
    input: RequestInfo | URL,
  ): Promise<Response & { data: unknown; requestHash: string }> {
    this.lastRequest = input as Request;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }) as Response & { data: unknown; requestHash: string };
  }

  public callHttpPost() {
    return (this as unknown as { httpPost: (o: RequestOptions) => Promise<unknown> }).httpPost({
      path: '/products',
      body: { q: 'x' },
    });
  }

  protected async queryProducts(): Promise<ProductBuilder<Product>[] | void> {
    // queryProducts represents the "real" (cache-miss) code path. Its
    // return isn't important for these tests; the gate should have run by
    // now and subclasses whose queryProducts reads setup state would find
    // it populated.
    return [];
  }

  protected async setup(): Promise<void> {
    this.setupCallCount++;
    await tick(this.setupDelayMs);
    this.setupDone = true;
    callOrder.push('setup');
  }

  public callQueryProductsWithCache() {
    return (
      this as unknown as { queryProductsWithCache: (q: string) => Promise<unknown> }
    ).queryProductsWithCache('potassium');
  }

  public callGetProductDataWithCache() {
    const product = new ProductBuilder<Product>(this.baseURL);
    product.setData({ url: `${this.baseURL}/p/${Math.random()}` } as Partial<Product>);
    return (
      this as unknown as {
        getProductDataWithCache: (
          p: ProductBuilder<Product>,
          f: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>,
        ) => Promise<ProductBuilder<Product> | void>;
      }
    ).getProductDataWithCache(product, async (builder) => {
      this.fetchersSawSetupDone.push(this.setupDone);
      return builder;
    });
  }
}

// Exercises the real fetch -> fetchDecorator -> global fetch path (it does NOT
// override fetch), so the 403 retry loop runs end to end. challengeRetryLimit
// is configurable per test; the delay is 0 to keep tests fast.
class RetryTestSupplier extends SupplierBase<unknown, Product> {
  public readonly supplierName = 'RetryTestSupplier';
  public readonly baseURL = 'https://example.invalid';
  public readonly shipping = 'worldwide' as ShippingRange;
  public readonly country = 'US' as CountryCode;
  public readonly paymentMethods = [] as PaymentMethod[];

  protected override readonly challengeRetryLimit: number;
  protected override readonly challengeRetryDelayMs = 0;

  constructor(retryLimit: number) {
    super('q', 5, new AbortController());
    this.challengeRetryLimit = retryLimit;
  }

  protected titleSelector(): Maybe<string> {
    return '';
  }

  protected getUniqueProductKey(data: unknown): string {
    return String((data as { id?: unknown })?.id ?? '');
  }

  protected async queryProducts(): Promise<ProductBuilder<Product>[] | void> {
    return [];
  }

  public callFetch() {
    return (this as unknown as { fetch: (url: string) => Promise<Response> }).fetch(
      `${this.baseURL}/wp-json/wc/store/v1/products`,
    );
  }
}

// Builds a global-fetch stub that returns `403` for the first `forbiddenCount`
// calls, then a 200 JSON response.
function makeFlakyFetch(forbiddenCount: number) {
  let call = 0;
  return vi.fn(async () => {
    call++;
    if (call <= forbiddenCount) {
      return new Response('<html>reload</html>', {
        status: 403,
        statusText: 'Forbidden',
        headers: { 'content-type': 'text/html' },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

describe('SupplierBase 403 challenge retry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries a 403 and succeeds once the cookie-handshake clears', async () => {
    const fetchMock = makeFlakyFetch(1);
    vi.stubGlobal('fetch', fetchMock);

    const supplier = new RetryTestSupplier(2);
    supplier.initCache();

    const response = await supplier.callFetch();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after exhausting challengeRetryLimit and throws', async () => {
    const fetchMock = makeFlakyFetch(Infinity);
    vi.stubGlobal('fetch', fetchMock);

    const supplier = new RetryTestSupplier(2);
    supplier.initCache();

    await expect(supplier.callFetch()).rejects.toThrow('403');
    // 1 initial attempt + 2 retries.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry when challengeRetryLimit is 0', async () => {
    const fetchMock = makeFlakyFetch(Infinity);
    vi.stubGlobal('fetch', fetchMock);

    const supplier = new RetryTestSupplier(0);
    supplier.initCache();

    await expect(supplier.callFetch()).rejects.toThrow('403');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('SupplierBase cookie handling', () => {
  beforeEach(() => {
    cacheState.queryHit = false;
    cacheState.productHit = false;
    callOrder.length = 0;
    cookieSetMock.mockClear();
    vi.stubGlobal('chrome', { cookies: { set: cookieSetMock } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends credentials: "include" on POST requests so cookies are stored/sent', async () => {
    // Under the vmThreads + jsdom env, jsdom's AbortSignal isn't an instanceof
    // Node/undici's AbortSignal, so the real `new Request(url, { signal })` in
    // httpPost throws a cross-realm error. Stub Request with a capturing fake —
    // we only need to assert httpPost built the init with credentials:"include".
    class FakeRequest {
      url: string;
      credentials?: string;
      constructor(url: string, init: RequestInit = {}) {
        this.url = url;
        Object.assign(this, init);
      }
    }
    vi.stubGlobal('Request', FakeRequest);

    const supplier = new TestSupplier('q', 5, new AbortController());
    supplier.initCache();

    await supplier.callHttpPost();

    expect(supplier.lastRequest?.credentials).toBe('include');
  });

  it('seeds requiredCookies into the jar before setup() on a cache miss', async () => {
    const supplier = new TestSupplier('q', 5, new AbortController());
    supplier.initCache();

    await supplier.callQueryProductsWithCache();

    expect(cookieSetMock).toHaveBeenCalledWith({
      url: 'https://example.invalid',
      name: 'currency',
      value: '2',
    });
    // Seeding must complete before setup runs.
    expect(callOrder).toEqual(['seed', 'setup']);
  });

  it('does not seed cookies when the query cache is hit', async () => {
    const supplier = new TestSupplier('q', 5, new AbortController());
    supplier.initCache();
    cacheState.queryHit = { data: [], __cacheMetadata: { limit: 100 } };

    await supplier.callQueryProductsWithCache();

    expect(cookieSetMock).not.toHaveBeenCalled();
  });
});
