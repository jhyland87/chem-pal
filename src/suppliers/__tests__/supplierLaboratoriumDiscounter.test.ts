import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { clearAllCaches } from "@/utils/idbCache";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import eur_to_usd_rate from "../__fixtures__/common/eur-to-usd-rate.json";
import individualProduct from "../__fixtures__/laboratoriumdiscounter/individual-product.json";
import { fixtureData } from "../__fixtures__/helpers/fixtureData";
import { SupplierLaboratoriumDiscounter as SupplierModule } from "../SupplierLaboratoriumDiscounter";
import { spyOnSupplier } from "./helpers/supplierTestUtils";

vi.mock("@/helpers/currency", async () => {
  const actual = await vi.importActual<typeof import("@/helpers/currency")>("@/helpers/currency");
  return {
    ...actual,
    toUSD: vi.fn(() => Promise.resolve(eur_to_usd_rate)),
  };
});

const collectExecuteResults = async (supplier: SupplierModule): Promise<Product[]> => {
  const results: Product[] = [];
  for await (const product of supplier.execute()) {
    results.push(product);
  }
  return results;
};

const productHTMLFixture = readFileSync(
  resolve(
    __dirname,
    "../__fixtures__/laboratoriumdiscounter/4-nitrophenyl-phosphate-disodium-salt-hexahydrate.html",
  ),
  "utf8",
);

const baseURL = "https://www.laboratoriumdiscounter.nl";

const makeBuilder = (url: string) => {
  const builder = new ProductBuilder<Product>(baseURL);
  builder.setBasicInfo("Test Product", url, "Laboratorium Discounter");
  return builder;
};

const makeSupplier = () => new SupplierModule("test", 1);

describe("SupplierLaboratoriumDiscounter", () => {
  // Get the laboratoriumdiscounter fixture data thingy
  const supplierFixtures = fixtureData("laboratoriumdiscounter");

  let supplier: SupplierModule;

  const { queryProductsWithCacheSpy, httpGetJsonMock } = spyOnSupplier(
    SupplierModule,
    supplierFixtures,
  );

  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
    // Mock the global fetch function to ensure no test accidentally hits the network.
    global.fetch = vi.fn().mockImplementation(() => {
      throw new Error("Fetch not mocked");
    });
  });

  describe("query", () => {
    beforeEach(() => {
      (queryProductsWithCacheSpy as Mock).mockClear();
      (httpGetJsonMock as Mock).mockClear();
    });

    describe("queryProductsWithCache", () => {
      beforeEach(async () => {
        await clearAllCaches();
      });

      it("issues search + per-product detail requests on first call", async () => {
        supplier = new SupplierModule("borohydride", 4);
        supplier.initCache();

        const results = await collectExecuteResults(supplier);

        expect(queryProductsWithCacheSpy).toHaveBeenCalledTimes(1);
        // The borohydride search fixture has 4 raw products that group via
        // groupVariants by stripped title — expect 1 search request plus one
        // product detail request per surviving grouped product.
        expect(results.length).toBeGreaterThan(0);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(1 + results.length);
        expect(results[0].title).toBeDefined();
        expect(results[0].supplier).toBe("Laboratorium Discounter");
        for (const product of results) {
          expect(typeof product.id).toBe("number");
        }
      });

      it("uses the cached search results on a second call with the same query", async () => {
        supplier = new SupplierModule("borohydride", 4);
        supplier.initCache();
        const firstResults = await collectExecuteResults(supplier);

        expect(queryProductsWithCacheSpy).toHaveBeenCalledTimes(1);
        const firstCallCount = (httpGetJsonMock as Mock).mock.calls.length;
        expect(firstCallCount).toBe(1 + firstResults.length);

        // A second supplier instance with the same query should hit both the
        // cached search results AND the cached per-product detail data, so no
        // additional HTTP requests are made at all.
        supplier = new SupplierModule("borohydride", 4);
        supplier.initCache();
        const secondResults = await collectExecuteResults(supplier);

        expect(queryProductsWithCacheSpy).toHaveBeenCalledTimes(2);
        expect(secondResults).toHaveLength(firstResults.length);
        expect((httpGetJsonMock as Mock).mock.calls.length).toBe(firstCallCount);
      });
    });
  });
});

// Unit tests for the getProductData methods (JSON path, HTML fallback, and the
// orchestration between them). Kept as a sibling describe with its own
// restoreAllMocks lifecycle so it doesn't interact with the integration suite's
// persistent spyOnSupplier spies above.
describe("SupplierLaboratoriumDiscounter getProductData methods", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getProductDataFromJSON", () => {
    it("populates pricing from a valid JSON product response", async () => {
      const supplier = makeSupplier() as unknown as {
        getProductDataFromJSON: (
          b: ProductBuilder<Product>,
        ) => Promise<ProductBuilder<Product> | void>;
        httpGetJson: (...args: unknown[]) => Promise<unknown>;
      };
      const httpGetJson = vi
        .spyOn(supplier, "httpGetJson" as never)
        .mockResolvedValue(individualProduct as never);

      const builder = makeBuilder("10-camphorsulfonic-acid-980t-25g.html");
      const result = await supplier.getProductDataFromJSON(
        builder as unknown as ProductBuilder<Product>,
      );

      expect(result).toBe(builder);
      expect(httpGetJson).toHaveBeenCalledTimes(1);
      const callArg = (httpGetJson.mock.calls[0]?.[0] ?? {}) as { path: string; params: unknown };
      expect(callArg.path).toBe("en/10-camphorsulfonic-acid-980t-25g.html");
      expect(callArg.params).toEqual({ format: "json" });

      const dump = builder.dump();
      expect(dump.price).toBe(individualProduct.product.price.price);
      expect(dump.currencyCode).toBe("EUR");
      expect(dump.currencySymbol).toBe("€");
    });

    it("does not double-prefix a url that already starts with en/", async () => {
      const supplier = makeSupplier() as unknown as {
        getProductDataFromJSON: (
          b: ProductBuilder<Product>,
        ) => Promise<ProductBuilder<Product> | void>;
      };
      const httpGetJson = vi
        .spyOn(supplier as never, "httpGetJson")
        .mockResolvedValue(individualProduct as never);

      const builder = makeBuilder("en/10-camphorsulfonic-acid-980t-25g.html");
      await supplier.getProductDataFromJSON(builder as unknown as ProductBuilder<Product>);

      const callArg = (httpGetJson.mock.calls[0]?.[0] ?? {}) as { path: string };
      expect(callArg.path).toBe("en/10-camphorsulfonic-acid-980t-25g.html");
    });

    it("returns void when the response fails the product typeguard", async () => {
      const supplier = makeSupplier() as unknown as {
        getProductDataFromJSON: (
          b: ProductBuilder<Product>,
        ) => Promise<ProductBuilder<Product> | void>;
      };
      vi.spyOn(supplier as never, "httpGetJson").mockResolvedValue({
        not: "a product",
      } as never);

      const builder = makeBuilder("missing.html");
      const result = await supplier.getProductDataFromJSON(
        builder as unknown as ProductBuilder<Product>,
      );

      expect(result).toBeUndefined();
      expect(builder.dump().price).toBeUndefined();
    });

    it("returns void when httpGetJson resolves to a falsy value", async () => {
      const supplier = makeSupplier() as unknown as {
        getProductDataFromJSON: (
          b: ProductBuilder<Product>,
        ) => Promise<ProductBuilder<Product> | void>;
      };
      vi.spyOn(supplier as never, "httpGetJson").mockResolvedValue(undefined as never);

      const builder = makeBuilder("missing.html");
      const result = await supplier.getProductDataFromJSON(
        builder as unknown as ProductBuilder<Product>,
      );

      expect(result).toBeUndefined();
    });
  });

  describe("getProductDataFromHTML", () => {
    it("parses meta tags from the HTML page and applies them to the builder", async () => {
      const supplier = makeSupplier() as unknown as {
        getProductDataFromHTML: (
          b: ProductBuilder<Product>,
        ) => Promise<ProductBuilder<Product> | void>;
      };
      vi.spyOn(supplier as never, "httpGetHtml").mockResolvedValue(productHTMLFixture as never);

      const builder = makeBuilder("4-nitrophenyl-phosphate-disodium-salt-hexahydrate.html");
      const result = await supplier.getProductDataFromHTML(
        builder as unknown as ProductBuilder<Product>,
      );

      expect(result).toBe(builder);
      const dump = builder.dump() as Partial<Product> & { variants?: Variant[] };
      // Description parser overwrites `title` with the first comma-separated chunk.
      expect(dump.title).toBe("4-Nitrophenyl phosphate disodium salt hexahydrate");
      expect(dump.cas).toBe("4264-83-9");
      // "min. 99%" from the description is stored as the product concentration.
      expect(dump.concentration).toBe("99%");
      expect(dump.currencyCode).toBe("EUR");
      expect(dump.currencySymbol).toBe("€");
      expect(dump.availability).toBe("in_stock");
      // Variant data is merged into the top-level product (Object.assign with variants[0]),
      // so price, sku, quantity and uom reflect the first parsed variant — not the meta price.
      expect(dump.sku).toBe("4165.1");
      expect(dump.price).toBe(27.82);
      expect(dump.quantity).toBe(2.5);
      expect(dump.uom).toBe("g");
      // Three variants are parsed; the first is hoisted to the top-level product
      // (price/sku/quantity/uom) via Object.assign + shift, leaving two in the array.
      expect(dump.variants).toHaveLength(2);
      expect(dump.variants?.map((v) => v.quantity)).toEqual([100, 25]);
    });

    it("prefixes the url with en/ when needed", async () => {
      const supplier = makeSupplier() as unknown as {
        getProductDataFromHTML: (
          b: ProductBuilder<Product>,
        ) => Promise<ProductBuilder<Product> | void>;
      };
      const httpGetHtml = vi
        .spyOn(supplier as never, "httpGetHtml")
        .mockResolvedValue(productHTMLFixture as never);

      const builder = makeBuilder("test-product.html");
      await supplier.getProductDataFromHTML(builder as unknown as ProductBuilder<Product>);

      const callArg = (httpGetHtml.mock.calls[0]?.[0] ?? {}) as { path: string };
      expect(callArg.path).toBe(`${baseURL}/en/test-product.html`);
    });

    it("returns void when the HTML fetch returns nothing", async () => {
      const supplier = makeSupplier() as unknown as {
        getProductDataFromHTML: (
          b: ProductBuilder<Product>,
        ) => Promise<ProductBuilder<Product> | void>;
      };
      vi.spyOn(supplier as never, "httpGetHtml").mockResolvedValue(undefined as never);

      const builder = makeBuilder("missing.html");
      const result = await supplier.getProductDataFromHTML(
        builder as unknown as ProductBuilder<Product>,
      );

      expect(result).toBeUndefined();
    });
  });

  describe("getProductData orchestration", () => {
    it("uses the JSON path when JSON parsing succeeds and never falls back to HTML", async () => {
      const supplier = makeSupplier() as unknown as {
        getProductData: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
        getProductDataFromJSON: (
          b: ProductBuilder<Product>,
        ) => Promise<ProductBuilder<Product> | void>;
        getProductDataFromHTML: (
          b: ProductBuilder<Product>,
        ) => Promise<ProductBuilder<Product> | void>;
        getProductDataWithCache: (
          b: ProductBuilder<Product>,
          fetcher: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>,
        ) => Promise<ProductBuilder<Product> | void>;
      };

      // Bypass cache: just invoke the callback.
      vi.spyOn(supplier as never, "getProductDataWithCache").mockImplementation((async (
        b: ProductBuilder<Product>,
        fetcher: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>,
      ) => fetcher(b)) as never);
      const fromJsonSpy = vi
        .spyOn(supplier as never, "getProductDataFromJSON")
        .mockImplementation((async (b: ProductBuilder<Product>) => b) as never);
      const fromHtmlSpy = vi.spyOn(supplier as never, "getProductDataFromHTML");

      const builder = makeBuilder("test-product.html");
      const result = await supplier.getProductData(builder as unknown as ProductBuilder<Product>);

      expect(fromJsonSpy).toHaveBeenCalledTimes(1);
      expect(fromHtmlSpy).not.toHaveBeenCalled();
      expect(result).toBe(builder);
    });

    it("falls back to HTML when JSON parsing returns void", async () => {
      const supplier = makeSupplier() as unknown as {
        getProductData: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
      };

      vi.spyOn(supplier as never, "getProductDataWithCache").mockImplementation((async (
        b: ProductBuilder<Product>,
        fetcher: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>,
      ) => fetcher(b)) as never);
      const fromJsonSpy = vi
        .spyOn(supplier as never, "getProductDataFromJSON")
        .mockImplementation((async () => undefined) as never);
      const fromHtmlSpy = vi
        .spyOn(supplier as never, "getProductDataFromHTML")
        .mockImplementation((async (b: ProductBuilder<Product>) => b) as never);

      const builder = makeBuilder("test-product.html");
      const result = await supplier.getProductData(builder as unknown as ProductBuilder<Product>);

      expect(fromJsonSpy).toHaveBeenCalledTimes(1);
      expect(fromHtmlSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe(builder);
    });
  });
});

describe("SupplierLaboratoriumDiscounter content/SDS parsing", () => {
  // Mirrors the shape of `product.content` from the detail JSON response.
  const content = [
    "<p>Empirical formula NaOH<br />Molar mass (M) 40.0 g / mol<br />CAS No. [1310-73-2]</p>",
    '<tr><td><a href="https://cdn.webshopapp.com/shops/286851/files/1/sdb-9356-nl-nl.pdf">MSDS Natriumhydroxide (NL)</a></td></tr>',
    '<tr><td><a href="https://cdn.webshopapp.com/shops/286851/files/2/sdb-9356-gb-en.pdf">MSDS Sodium hydroxide (EN)</a></td></tr>',
    '<tr><td><a href="https://cdn.webshopapp.com/shops/286851/files/3/sdb-9356-fr-fr.pdf">MSDS Hydroxide de sodium (FR)</a></td></tr>',
  ].join("\n");

  // pickSdsUrl and applyContentSpecs are private; cast to reach them in tests.
  type Internals = {
    pickSdsUrl(content: string, language: string): string | undefined;
    applyContentSpecs(builder: ProductBuilder<Product>, content: string): Promise<void>;
  };
  const internals = (): Internals => makeSupplier() as unknown as Internals;

  it("picks the SDS in the requested language", () => {
    expect(internals().pickSdsUrl(content, "nl")).toContain("sdb-9356-nl-nl.pdf");
    expect(internals().pickSdsUrl(content, "fr")).toContain("sdb-9356-fr-fr.pdf");
  });

  it("falls back to English when the language is unavailable", () => {
    expect(internals().pickSdsUrl(content, "ja")).toContain("sdb-9356-gb-en.pdf");
  });

  it("returns undefined when there are no SDS links", () => {
    expect(internals().pickSdsUrl("<p>No documents here</p>", "en")).toBeUndefined();
  });

  it("applies formula, molar mass, CAS and an SDS url to the builder", async () => {
    const builder = makeBuilder("sodium-hydroxide.html");
    await internals().applyContentSpecs(builder, content);
    expect(builder.get("formula")).toBe("NaOH");
    expect(builder.get("moleweight")).toBe(40);
    expect(builder.get("cas")).toBe("1310-73-2");
    expect(builder.get("sdsUrl")).toContain(".pdf");
  });

  it("parses a subscripted formula and a comma-decimal molar mass", async () => {
    const builder = makeBuilder("sodium-hydroxide.html");
    await internals().applyContentSpecs(
      builder,
      "<p>Empirical formula C<sub>6</sub>H<sub>15</sub>NO<sub>3</sub><br />" +
        "Molar mass (M) 149,19 g/mol<br />CAS No. [102-71-6]</p>",
    );
    expect(builder.get("formula")).toBe("C₆H₁₅NO₃");
    expect(builder.get("moleweight")).toBe(149.19);
    expect(builder.get("cas")).toBe("102-71-6");
  });

  it("parses a dot-joined salt formula and a bare 'mol :' molar mass", async () => {
    const builder = makeBuilder("sodium-hydroxide.html");
    await internals().applyContentSpecs(
      builder,
      "CAS : 10017-56-8<br>Formula : C6H15NO3.H3PO4<br>mol : 247.18<br>Melting point : 106°C",
    );
    expect(builder.get("formula")).toBe("C₆H₁₅NO₃⋅H₃PO₄");
    expect(builder.get("moleweight")).toBe(247.18);
    expect(builder.get("cas")).toBe("10017-56-8");
  });

  it("parses the purity from the product title in the search phase", () => {
    type WithInit = {
      initProductBuilders(data: unknown[]): ProductBuilder<Product>[];
    };
    const make = (title: string): ProductBuilder<Product> => {
      const product = {
        title,
        url: "product.html",
        description: "",
        id: 1,
        available: true,
        sku: "SKU1",
        code: "CODE1",
        variant: "Variant,500 g,CAS,144-55-8",
        image: 0,
      };
      return (makeSupplier() as unknown as WithInit).initProductBuilders([product])[0];
    };
    expect(make("Sodium bicarbonate 99% foodgrade").get("purity")).toBe("99%");
    expect(make("Potassium hydrogen tartrate ≥99,5 %, extra pure").get("purity")).toBe("99.5%");
    expect(make("Lithium Carbonate 99+% Extra Pure").get("purity")).toBe("99%");
  });
});
