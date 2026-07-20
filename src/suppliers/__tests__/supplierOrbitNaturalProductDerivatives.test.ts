import { ProductBuilder } from "@/utils/ProductBuilder";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierOrbitNaturalProductDerivatives } from "../SupplierOrbitNaturalProductDerivatives";

const searchResponse = JSON.parse(
  readFileSync(
    resolve(__dirname, "../__fixtures__/orbitnaturalproductderivatives/get-all-products-response.json"),
    "utf8",
  ),
);
const geraniolDetail = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      "../__fixtures__/orbitnaturalproductderivatives/geraniol-60-product-details-response.json",
    ),
    "utf8",
  ),
);

const makeSupplier = () => new SupplierOrbitNaturalProductDerivatives("geraniol", 5);

type MySimpleStoreInternals = {
  initProductBuilders: (products: MySimpleStoreListProduct[]) => ProductBuilder<Product>[];
  queryProducts: (q: string, l?: number) => Promise<ProductBuilder<Product>[] | void>;
  getProductData: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
  apiHost: string;
};

describe("SupplierOrbitNaturalProductDerivatives identity", () => {
  it("targets the MySimpleStore API host derived from the store id", () => {
    const supplier = makeSupplier() as unknown as MySimpleStoreInternals;
    expect(supplier.apiHost).toBe("7692587b-61ba-4b63-b329-a6ebcdb36c13.mysimplestore.com");
  });

  it("requires both the website and the API host as permissions", () => {
    const supplier = makeSupplier();
    expect(supplier.requiredHosts).toEqual([
      "https://orbitnaturalproductderivatives.com/*",
      "https://7692587b-61ba-4b63-b329-a6ebcdb36c13.mysimplestore.com/*",
    ]);
  });

  it("declares the plain 'ebay' method with an eBay store link", () => {
    const supplier = makeSupplier();
    expect(supplier.paymentMethods).toContain("ebay");
    expect(supplier.paymentMethods).not.toContain("ebayonly");
    expect(supplier.ebayStoreURL).toBe("https://www.ebay.com/usr/orbitnaturalproductderivatives");
  });
});

describe("SupplierOrbitNaturalProductDerivatives initProductBuilders", () => {
  it("seeds product-wide fields from the search listing", () => {
    const supplier = makeSupplier() as unknown as MySimpleStoreInternals;
    const builders = supplier.initProductBuilders(searchResponse.products);

    const geraniol = builders
      .map((b) => b.dump())
      .find((p) => p.title === "Geraniol 60");

    expect(geraniol).toBeDefined();
    expect(geraniol?.url).toBe(
      "https://orbitnaturalproductderivatives.com/products/ols/products/geraniol-60",
    );
    expect(geraniol?.supplier).toBe("Orbit Natural Product Derivatives");
    expect(geraniol?.price).toBe(60);
    expect(geraniol?.currencyCode).toBe("USD");
    expect(geraniol?.cacheKey).toBe("019da697-3e40-724a-a270-dd727e651d85");
    // CAS numbers appear in the free-form description copy.
    expect(geraniol?.cas).toBe("106-24-1");
  });
});

describe("SupplierOrbitNaturalProductDerivatives getProductData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("enumerates variants and promotes the smallest to parent fields", async () => {
    const supplier = makeSupplier() as unknown as MySimpleStoreInternals;

    vi.spyOn(supplier as never, "httpGetJson").mockResolvedValue(geraniolDetail as never);
    // Bypass the cache wrapper and run the fetcher directly.
    vi.spyOn(supplier as never, "getProductDataWithCache").mockImplementation(
      ((b: ProductBuilder<Product>, fetcher: (b: ProductBuilder<Product>) => unknown) =>
        fetcher(b)) as never,
    );

    const builder = new ProductBuilder<Product>("https://orbitnaturalproductderivatives.com");
    builder.setBasicInfo(
      "Geraniol 60",
      "https://orbitnaturalproductderivatives.com/products/ols/products/geraniol-60",
      "Orbit Natural Product Derivatives",
    );

    const result = await supplier.getProductData(builder as unknown as ProductBuilder<Product>);
    expect(result).toBeDefined();

    const product = result?.dump();
    expect(product?.variants).toHaveLength(4);

    // All five product photos are captured as distinct gallery images (not just the first),
    // so the detail-panel carousel has real images to cycle through.
    const imageHrefs = product?.images?.filter((i) => i.type === "image").map((i) => i.href);
    expect(imageHrefs).toHaveLength(5);
    expect(new Set(imageHrefs).size).toBe(5);

    // Variants sorted ascending by chemical quantity: 1, 4, 5, 20 LITER.
    const quantities = product?.variants?.map((v) => v.quantity);
    expect(quantities).toEqual([1, 4, 5, 20]);
    expect(product?.variants?.map((v) => v.uom)).toEqual(["l", "l", "l", "l"]);
    expect(product?.variants?.[0].sku).toBe("GRN-60-1-LTR");
    expect(product?.variants?.[0].url).toBe(
      "https://orbitnaturalproductderivatives.com/products/ols/products/geraniol-60/v/GRN-60-1-LTR",
    );

    // Parent-level fields come from the smallest (1 LITER) variant.
    expect(product?.price).toBe(60);
    expect(product?.quantity).toBe(1);
    expect(product?.uom).toBe("l");
    expect(product?.sku).toBe("GRN-60-1-LTR");
  });
});

describe("SupplierOrbitNaturalProductDerivatives queryProducts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches, fuzzy-filters, and builds from the search listing", async () => {
    const supplier = makeSupplier() as unknown as MySimpleStoreInternals;
    vi.spyOn(supplier as never, "httpGetJson").mockResolvedValue(searchResponse as never);

    const builders = await supplier.queryProducts("geraniol", 5);
    expect(builders).toBeDefined();
    expect(builders?.length).toBeGreaterThan(0);
    expect(builders?.some((b) => String(b.dump().title).includes("Geraniol"))).toBe(true);
  });
});
