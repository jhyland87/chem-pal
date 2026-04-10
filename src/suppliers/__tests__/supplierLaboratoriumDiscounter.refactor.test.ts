import ProductBuilder from "@/utils/ProductBuilder";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import individualProduct from "../__fixtures__/laboratoriumdiscounter/individual-product.json";
import SupplierLaboratoriumDiscounter from "../SupplierLaboratoriumDiscounter";

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

const makeSupplier = () => new SupplierLaboratoriumDiscounter("test", 1);

describe("SupplierLaboratoriumDiscounter refactor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getProductDataFromJSON", () => {
    it("populates pricing from a valid JSON product response", async () => {
      const supplier = makeSupplier() as unknown as {
        getProductDataFromJSON: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
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
      expect(dump.currencySymbol).toBe("\u20ac");
    });

    it("does not double-prefix a url that already starts with en/", async () => {
      const supplier = makeSupplier() as unknown as {
        getProductDataFromJSON: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
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
        getProductDataFromJSON: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
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
        getProductDataFromJSON: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
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
        getProductDataFromHTML: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
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
      expect(dump.conc).toBe("99%");
      expect(dump.currencyCode).toBe("EUR");
      expect(dump.currencySymbol).toBe("\u20ac");
      expect(dump.availability).toBe("in stock");
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
        getProductDataFromHTML: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
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
        getProductDataFromHTML: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
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
        getProductDataFromJSON: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
        getProductDataFromHTML: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
        getProductDataWithCache: (
          b: ProductBuilder<Product>,
          fetcher: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>,
        ) => Promise<ProductBuilder<Product> | void>;
      };

      // Bypass cache: just invoke the callback.
      vi.spyOn(supplier as never, "getProductDataWithCache").mockImplementation(
        (async (b: ProductBuilder<Product>, fetcher: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>) =>
          fetcher(b)) as never,
      );
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

      vi.spyOn(supplier as never, "getProductDataWithCache").mockImplementation(
        (async (b: ProductBuilder<Product>, fetcher: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>) =>
          fetcher(b)) as never,
      );
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
