import { getSupplierColor, SUPPLIER_COLORS } from "@/theme/colors";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { type JsonValue } from "type-fest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per-identity product-data cache, so one product can hit and another miss.
const cacheState = { productDataByKey: {} as Record<string, Record<string, unknown>> };

vi.mock("@/utils/SupplierCache", () => ({
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

// Bypass the search-response schema check; we feed builders directly.
vi.mock("@/utils/typeGuards/woocommerce", async () => {
  const actual =
    await vi.importActual<typeof import("@/utils/typeGuards/woocommerce")>(
      "@/utils/typeGuards/woocommerce",
    );
  return { ...actual, isSearchResponse: () => true };
});

const { SupplierBaseWoocommerce } = await import("@/suppliers/SupplierBaseWoocommerce");

/**
 * Concrete WooCommerce supplier that stubs the network + parse boundaries so we
 * can exercise the real queryProducts → partitionForBatch → enrichVariants
 * wiring. `initProductBuilders` returns two pre-stamped builders (ids "1", "2"),
 * each carrying one variant; `fetchVariantData` records which variant ids were
 * requested.
 */
class TestWoo extends SupplierBaseWoocommerce {
  public readonly supplierName = "TestWoo";
  public readonly baseURL = "https://woo.example";
  public readonly shipping = "worldwide" as ShippingRange;
  public readonly country = "US" as CountryCode;
  public readonly paymentMethods = [] as PaymentMethod[];

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
    return [make("1", 101), make("2", 202)];
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

describe("SupplierBaseWoocommerce cross-query hydration", () => {
  beforeEach(() => {
    cacheState.productDataByKey = {};
  });
  afterEach(() => vi.restoreAllMocks());

  it("hydrates a cached product and skips its variant fetch on a different query", async () => {
    const supplier = new TestWoo("q", 10, new AbortController());
    supplier.initCache();
    // Product id "1" was enriched under a prior (different) search.
    cacheState.productDataByKey["id:1"] = { description: "cached-desc-1" };

    const result = await supplier.callQueryProducts("anything", 10);

    // Both products survive; product 1 came from cache, product 2 was enriched.
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    // Only product 2's variant id entered the bulk fetch — product 1 was hydrated.
    expect(supplier.requestedVariantIds).toEqual([202]);
    // Product 1 carries the hydrated cache data.
    const hydrated = (result as ProductBuilder<Product>[]).find((b) => b.get("cacheKey") === "1");
    expect(hydrated?.get("description")).toBe("cached-desc-1");
  });

  it("enriches every product when nothing is cached", async () => {
    const supplier = new TestWoo("q", 10, new AbortController());
    supplier.initCache();

    const result = await supplier.callQueryProducts("anything", 10);

    expect(result).toHaveLength(2);
    expect(supplier.requestedVariantIds.sort()).toEqual([101, 202]);
  });

  it("defaults color to a stable palette color derived from the class name", () => {
    const supplier = new TestWoo("q", 10, new AbortController());
    expect(SUPPLIER_COLORS).toContain(supplier.color);
    expect(supplier.color).toBe(getSupplierColor("TestWoo"));
    // Same class → same color on a second instance.
    expect(new TestWoo("other", 5, new AbortController()).color).toBe(supplier.color);
  });
});
