import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { SupplierBase } from "../SupplierBase";

// Toggle-able cache stubs so each test can simulate hits / misses.
const cacheState = {
  queryHit: false as
    | false
    | { data: unknown[]; __cacheMetadata: { limit: number; supplierModule?: string } },
  productHit: false as false | Record<string, unknown>,
  // Per-cache-key product data, for tests that need some keys to hit and
  // others to miss within a single call (e.g. partitionForBatch).
  productDataByKey: undefined as undefined | Record<string, Record<string, unknown>>,
};

vi.mock("@/utils/SupplierCache", () => {
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
      async getCachedProductData(key: string) {
        if (cacheState.productDataByKey && key in cacheState.productDataByKey) {
          return cacheState.productDataByKey[key];
        }
        return cacheState.productHit || null;
      }
      async cacheProductData() {}
    },
  };
});

vi.mock("@/helpers/excludedProducts", () => ({
  countExcludedProductsForSupplier: async () => 0,
  loadExcludedProductKeys: async () => new Set<string>(),
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

  protected getUniqueProductKey(data: unknown): string {
    return String((data as { id?: unknown })?.id ?? "");
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
    // Stamp a cacheKey like real builders do (getUniqueProductKey at parse), so
    // the identity-keyed cache path is exercised.
    const id = `${Math.random()}`;
    product.setData({ url: `${this.baseURL}/p/${id}`, cacheKey: id } as Partial<Product>);
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

  // Expose protected helpers + mutable state for the batch/exclusion tests.
  public setExcludedKeys(keys: Set<string>) {
    (this as unknown as { excludedProductKeys: Set<string> }).excludedProductKeys = keys;
  }
  public setSkipProductDetailCache(value: boolean) {
    (this as unknown as { skipProductDetailCache: boolean }).skipProductDetailCache = value;
  }
  public callIsExcluded(product: ProductBuilder<Product>): boolean {
    return (
      this as unknown as { isExcluded: (p: ProductBuilder<Product>) => boolean }
    ).isExcluded(product);
  }
  public callPartitionForBatch(products: ProductBuilder<Product>[]) {
    return (
      this as unknown as {
        partitionForBatch: (p: ProductBuilder<Product>[]) => Promise<{
          survivors: ProductBuilder<Product>[];
          misses: ProductBuilder<Product>[];
        }>;
      }
    ).partitionForBatch(products);
  }
  public callBuildSearchParams(obj: Record<string, unknown>): URLSearchParams {
    return (
      this as unknown as { buildSearchParams: (o: Record<string, unknown>) => URLSearchParams }
    ).buildSearchParams(obj);
  }
  public callHref(path: string, params?: Record<string, unknown>): string {
    return (
      this as unknown as { href: (p: string, q?: Record<string, unknown>) => string }
    ).href(path, params);
  }
}

/** A ProductBuilder with a stamped identity + url, for the batch/exclusion tests. */
const builderWith = (id: string, url: string) =>
  new ProductBuilder<Product>("https://example.invalid").setData({
    url,
    cacheKey: id,
  } as Partial<Product>);

describe("SupplierBase phase-boundary setup gate", () => {
  beforeEach(() => {
    cacheState.queryHit = false;
    cacheState.productHit = false;
    cacheState.productDataByKey = undefined;
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

describe("SupplierBase identity exclusion (isExcluded)", () => {
  beforeEach(() => {
    cacheState.queryHit = false;
    cacheState.productHit = false;
    cacheState.productDataByKey = undefined;
  });
  afterEach(() => vi.restoreAllMocks());

  it("matches an ignore entry written under the identity key", () => {
    const supplier = new TestSupplier("q", 5, new AbortController());
    supplier.initCache();
    // Mock getProductIdentityCacheKey => `identity:<id>`.
    supplier.setExcludedKeys(new Set(["identity:ID1"]));

    expect(supplier.callIsExcluded(builderWith("ID1", "https://example.invalid/p/1"))).toBe(true);
    expect(supplier.callIsExcluded(builderWith("ID2", "https://example.invalid/p/2"))).toBe(false);
  });
});

describe("SupplierBase partitionForBatch", () => {
  beforeEach(() => {
    cacheState.queryHit = false;
    cacheState.productHit = false;
    cacheState.productDataByKey = undefined;
  });
  afterEach(() => vi.restoreAllMocks());

  it("drops ignored, hydrates cache hits, and returns misses to enrich", async () => {
    const supplier = new TestSupplier("q", 5, new AbortController());
    supplier.initCache();
    supplier.setExcludedKeys(new Set(["identity:A"])); // A is ignored
    cacheState.productDataByKey = { "identity:B": { title: "hydrated-B" } }; // B hits, C misses

    const a = builderWith("A", "https://example.invalid/a");
    const b = builderWith("B", "https://example.invalid/b");
    const c = builderWith("C", "https://example.invalid/c");

    const { survivors, misses } = await supplier.callPartitionForBatch([a, b, c]);

    expect(survivors).toEqual([b, c]); // A dropped
    expect(misses).toEqual([c]); // B hydrated (not a miss)
    expect(b.get("title")).toBe("hydrated-B"); // hydrated in place
  });

  it("skips the cache lookup entirely when skipProductDetailCache is true", async () => {
    const supplier = new TestSupplier("q", 5, new AbortController());
    supplier.initCache();
    supplier.setSkipProductDetailCache(true);
    cacheState.productDataByKey = { "identity:B": { title: "should-not-hydrate" } };

    const b = builderWith("B", "https://example.invalid/b");
    const { survivors, misses } = await supplier.callPartitionForBatch([b]);

    expect(survivors).toEqual([b]);
    expect(misses).toEqual([]); // no per-product enrichment for pure-search suppliers
    expect(b.get("title")).toBeUndefined(); // not hydrated
  });
});

describe("SupplierBase buildSearchParams / href", () => {
  const make = () => {
    const s = new TestSupplier("q", 5, new AbortController());
    s.initCache();
    return s;
  };

  it("serializes flat primitive params", () => {
    expect(make().callBuildSearchParams({ a: "b", c: "d" }).toString()).toBe("a=b&c=d");
  });

  it("stringifies numbers and booleans", () => {
    expect(make().callBuildSearchParams({ limit: 10, flag: true }).toString()).toBe(
      "limit=10&flag=true",
    );
  });

  it("encodes nested objects with bracket notation", () => {
    const qs = make().callBuildSearchParams({ q: "acid", filter: { size: "500g" } });
    expect(qs.get("q")).toBe("acid");
    expect(qs.get("filter[size]")).toBe("500g");
  });

  it("encodes deeply nested objects", () => {
    const qs = make().callBuildSearchParams({ a: { b: { c: "d" } } });
    expect(qs.get("a[b][c]")).toBe("d");
  });

  it("href applies nested params (regression: no [object Object])", () => {
    const url = make().callHref("/search", { q: "acid", filter: { size: "500g" } });
    expect(url).not.toContain("object%20Object");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("q")).toBe("acid");
    expect(parsed.searchParams.get("filter[size]")).toBe("500g");
  });
});
