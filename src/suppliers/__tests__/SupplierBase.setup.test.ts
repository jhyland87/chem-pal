import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductBuilder from "@/utils/ProductBuilder";
import SupplierBase from "../SupplierBase";

// Toggle-able cache stubs so each test can simulate hits / misses.
const cacheState = {
  queryHit: false as false | { data: unknown[]; __cacheMetadata: { limit: number } },
  productHit: false as false | Record<string, unknown>,
};

vi.mock("@/utils/SupplierCache", () => {
  return {
    default: class MockSupplierCache {
      private supplierName: string;
      constructor(supplierName: string) {
        this.supplierName = supplierName;
      }
      generateCacheKey(query: string) {
        return `${this.supplierName}:${query}`;
      }
      async getCachedQueryEntry() {
        return cacheState.queryHit || null;
      }
      async cacheQueryResults() {}
      getProductDataCacheKey(url: string) {
        return `product:${url}`;
      }
      async getCachedProductData() {
        return cacheState.productHit || null;
      }
      async cacheProductData() {}
    },
  };
});

vi.mock("@/helpers/excludedProducts", () => ({
  countExcludedProductsForSupplier: async () => 0,
  getProductExclusionKey: (url: string) => url,
  loadExcludedProductKeys: async () => new Set<string>(),
  shouldExcludeProduct: async () => false,
}));

const tick = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Test double exposing the protected query / product-data entry points and
 * recording whether setup had resolved at the moment each fetcher ran. The
 * fake `setup()` carries a controllable delay so concurrency can be
 * exercised.
 */
class TestSupplier extends SupplierBase<unknown, Product> {
  public readonly supplierName = "TestSupplier";
  public readonly baseURL = "https://example.invalid";
  public readonly shipping = "worldwide" as ShippingRange;
  public readonly country = "US" as CountryCode;
  public readonly paymentMethods = [] as PaymentMethod[];

  public setupCallCount = 0;
  public setupDone = false;
  public setupDelayMs = 30;
  // Each product fetch records whether setup had resolved when it ran.
  public readonly fetchersSawSetupDone: boolean[] = [];

  protected titleSelector(): Maybe<string> {
    return "";
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
  }

  public callQueryProductsWithCache() {
    return (this as unknown as { queryProductsWithCache: (q: string) => Promise<unknown> })
      .queryProductsWithCache("potassium");
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

describe("SupplierBase phase-boundary setup gate", () => {
  beforeEach(() => {
    cacheState.queryHit = false;
    cacheState.productHit = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never invokes setup() when the query cache is hit", async () => {
    const supplier = new TestSupplier("q", 5, new AbortController());
    supplier.initCache();
    cacheState.queryHit = { data: [], __cacheMetadata: { limit: 100 } };

    await supplier.callQueryProductsWithCache();

    expect(supplier.setupCallCount).toBe(0);
  });

  it("runs setup() once before queryProducts on a cache miss", async () => {
    const supplier = new TestSupplier("q", 5, new AbortController());
    supplier.initCache();

    await supplier.callQueryProductsWithCache();

    expect(supplier.setupCallCount).toBe(1);
    expect(supplier.setupDone).toBe(true);
  });

  it("never invokes setup() when every product-detail cache lookup hits", async () => {
    const supplier = new TestSupplier("q", 5, new AbortController());
    supplier.initCache();
    cacheState.productHit = { some: "data" };

    const results = await Promise.all(
      Array.from({ length: 4 }, () => supplier.callGetProductDataWithCache()),
    );

    expect(results.every((r) => r !== undefined)).toBe(true);
    expect(supplier.setupCallCount).toBe(0);
    // No fetcher should have fired (all cache hits).
    expect(supplier.fetchersSawSetupDone).toHaveLength(0);
  });

  it("runs setup() exactly once for N concurrent product fetcher cache misses, and every fetcher sees setup as complete", async () => {
    const supplier = new TestSupplier("q", 5, new AbortController());
    supplier.initCache();

    const N = 8;
    await Promise.all(Array.from({ length: N }, () => supplier.callGetProductDataWithCache()));

    expect(supplier.setupCallCount).toBe(1);
    expect(supplier.fetchersSawSetupDone).toHaveLength(N);
    expect(supplier.fetchersSawSetupDone.every((v) => v === true)).toBe(true);
  });

  it("memoizes setup() rejection so a broken supplier does not silently retry", async () => {
    class BrokenSetup extends TestSupplier {
      public override async setup(): Promise<void> {
        this.setupCallCount++;
        await tick(5);
        throw new Error("setup failed");
      }
    }

    const supplier = new BrokenSetup("q", 5, new AbortController());
    supplier.initCache();

    await expect(supplier.callQueryProductsWithCache()).rejects.toThrow("setup failed");
    await expect(supplier.callQueryProductsWithCache()).rejects.toThrow("setup failed");
    expect(supplier.setupCallCount).toBe(1);
  });
});
