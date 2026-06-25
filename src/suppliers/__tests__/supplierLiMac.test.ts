import { ProductBuilder } from "@/utils/ProductBuilder";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierLiMac } from "../SupplierLiMac";

const productHTMLFixture = readFileSync(
  resolve(__dirname, "../__fixtures__/limac/sodium-borohydride.html"),
  "utf8",
);

const baseURL = "https://www.limac.lv";
const productURL = "https://www.limac.lv/catalog/params/category/92374/item/379559/";

const makeSupplier = () => new SupplierLiMac("sodium borohydride", 1);

const makeBuilder = () => {
  const builder = new ProductBuilder<Product>(baseURL);
  builder.setBasicInfo("Hydrides - Hydrides - Catalog - LiMac Science", productURL, "LiMac");
  builder.setID("379559");
  return builder;
};

describe("SupplierLiMac getProductData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts product data from the embedded JS objects and page tables", async () => {
    const supplier = makeSupplier() as unknown as {
      getProductData: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
    };
    vi.spyOn(supplier as never, "httpGetHtml").mockResolvedValue(productHTMLFixture as never);
    // Bypass the cache/exclusion wrapper (needs IndexedDB + an initialized
    // cache) and run the fetcher directly so we exercise the extraction logic.
    vi.spyOn(supplier as never, "getProductDataWithCache").mockImplementation(
      ((builder: ProductBuilder<Product>, fetcher: (b: ProductBuilder<Product>) => unknown) =>
        fetcher(builder)) as never,
    );

    const builder = makeBuilder();
    const result = await supplier.getProductData(builder as unknown as ProductBuilder<Product>);

    expect(result).toBe(builder);

    const dump = builder.dump() as Partial<Product> & { variants?: Variant[] };

    // From mozCatItemMozApi
    expect(dump.title).toBe("Sodium borohydride, min 95%");
    expect(dump.cas).toBe("16940-66-2");
    expect(dump.price).toBe(93.68);
    expect(dump.currencyCode).toBe("EUR");
    expect(dump.currencySymbol).toBe("€");
    expect(dump.quantity).toBe(50);
    expect(dump.uom).toBe("g");

    // Purity parsed from the title ("min 95%")
    expect(dump.purity).toBe(95);

    // From the #basic properties table
    expect(dump.formula).toBe("NaBH4");
    expect(dump.moleweight).toBe(37.83);

    // Image from og:image, thumbnail from mozCatItemPictures
    expect(dump.imageURL).toContain("NaBH4");
    expect(dump.imageURL?.startsWith("https://www.limac.lv/")).toBe(true);
    expect(dump.thumbnail).toContain("/thumb/");
    expect(dump.thumbnail).toContain("NaBH4");

    // Description is intentionally skipped (og:description is too noisy)
    expect(dump.description).toBeUndefined();

    // The first variant (50g) is promoted to the parent; 100g and 10kg remain.
    expect(dump.variants).toHaveLength(2);
    expect(dump.variants?.map((v) => v.title)).toEqual(["100g", "((!)) 10kg"]);
    expect(dump.variants?.[0]?.price).toBe(172.28);
    expect(dump.variants?.[1]?.price).toBe(4235.65);

    // The product name fuzz-matches the query, so it's kept and scored.
    expect(dump.matchPercentage).toBeGreaterThanOrEqual(55);
  });

  it("drops products whose page name doesn't fuzz-match the query", async () => {
    // Query is unrelated to the fixture's product (sodium borohydride), so the
    // secondary fuzz filter on the real product name should reject it.
    const supplier = new SupplierLiMac("acetone", 1) as unknown as {
      getProductData: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
    };
    vi.spyOn(supplier as never, "httpGetHtml").mockResolvedValue(productHTMLFixture as never);
    vi.spyOn(supplier as never, "getProductDataWithCache").mockImplementation(
      ((builder: ProductBuilder<Product>, fetcher: (b: ProductBuilder<Product>) => unknown) =>
        fetcher(builder)) as never,
    );

    const result = await supplier.getProductData(makeBuilder() as unknown as ProductBuilder<Product>);

    expect(result).toBeUndefined();
  });
});

// Minimal FreeFind results page: a result-count header plus two result anchors.
const searchResultsFixture = `
<html><body>
  <table class="search-header-table"><tr>
    <td class="search-count"><font class="search-count">Found 2 items, now showing 1 - 2</font></td>
  </tr></table>
  <font class="search-results"><a href="/catalog/params/category/92374/item/379559/">Sodium borohydride - Hydrides</a></font>
  <font class="search-results"><a href="/catalog/params/category/91116/item/123456/">Sulfuric acid - Acids</a></font>
</body></html>`;

describe("SupplierLiMac queryProducts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("routes results through initProductBuilders so supplier/title/id are set", async () => {
    const supplier = makeSupplier() as unknown as {
      queryProducts: (query: string, limit?: number) => Promise<ProductBuilder<Product>[] | void>;
    };
    vi.spyOn(supplier as never, "httpGetHtml").mockResolvedValue(searchResultsFixture as never);

    const builders = await supplier.queryProducts("sodium borohydride", 10);

    expect(builders).toBeDefined();
    expect(builders).toHaveLength(2);

    const dump = builders![0].dump();
    // The bug: building inline only set `url`, leaving `supplier`/`title`/`id`
    // undefined. initProductBuilders sets them via setBasicInfo + setID.
    expect(dump.supplier).toBe("LiMac");
    expect(dump.title).toBe("Sodium borohydride - Hydrides");
    expect(dump.id).toBe("379559");
    expect(dump.url).toBe(productURL);
  });

  it("honors the limit", async () => {
    const supplier = makeSupplier() as unknown as {
      queryProducts: (query: string, limit?: number) => Promise<ProductBuilder<Product>[] | void>;
    };
    vi.spyOn(supplier as never, "httpGetHtml").mockResolvedValue(searchResultsFixture as never);

    const builders = await supplier.queryProducts("sodium borohydride", 1);
    expect(builders).toHaveLength(1);
  });
});
