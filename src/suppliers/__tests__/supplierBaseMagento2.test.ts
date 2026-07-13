// ProductBuilder must be imported before SupplierBase(Magento2) to avoid a
// module-initialization cycle; the base class is then imported dynamically.
import { ProductBuilder } from "@/utils/ProductBuilder";
import { describe, expect, it } from "vitest";

const { SupplierBaseMagento2 } = await import("@/suppliers/SupplierBaseMagento2");

/**
 * Minimal concrete Magento 2 supplier that exposes the `protected` methods
 * under test (`getProductUrl`, `initProductBuilders`) as public wrappers. No
 * network is touched — both methods are pure transforms of a product item.
 */
class TestMagento2 extends SupplierBaseMagento2 {
  public readonly supplierName = "TestMagento2";
  public readonly baseURL = "https://mag.example";
  public readonly shipping = "worldwide" as ShippingRange;
  public readonly country = "US" as CountryCode;
  public readonly paymentMethods = [] as PaymentMethod[];

  public callGetProductUrl(item: Magento2ProductItem): string {
    return this.getProductUrl(item);
  }

  public callInitProductBuilders(items: Magento2ProductItem[]): ProductBuilder<Product>[] {
    return this.initProductBuilders(items);
  }
}

/** Builds a minimal `SimpleProduct` item; override only the fields under test. */
function makeItem(overrides: Partial<Magento2ProductItem> = {}): Magento2ProductItem {
  return {
    __typename: "SimpleProduct",
    uid: "dWlkLTE=",
    sku: "SKU-1",
    name: "Test Product",
    url_rewrites: [],
    url_key: "test-product",
    url_suffix: ".html",
    price_range: {
      minimum_price: {
        regular_price: { value: 9.9, currency: "USD" },
      },
    },
    ...overrides,
  } as Magento2ProductItem;
}

const supplier = new TestMagento2("q", 10, new AbortController());

describe("SupplierBaseMagento2.getProductUrl", () => {
  it("returns the first url_rewrite's url when present, ignoring url_key", () => {
    const item = makeItem({
      url_rewrites: [{ url: "sodium-chloride.html", parameters: [] }],
      url_key: "ignored-key",
      url_suffix: ".html",
    });
    expect(supplier.callGetProductUrl(item)).toBe("sodium-chloride.html");
  });

  it("uses the first rewrite when several are present", () => {
    const item = makeItem({
      url_rewrites: [
        { url: "first.html", parameters: [] },
        { url: "second.html", parameters: [] },
      ],
    });
    expect(supplier.callGetProductUrl(item)).toBe("first.html");
  });

  it("reads a fully-shaped Magento2UrlRewrite (url + parameters)", () => {
    const rewrite: Magento2UrlRewrite = {
      url: "product/123.html",
      parameters: [{ name: "id", value: "123" }],
    };
    const item = makeItem({ url_rewrites: [rewrite] });
    expect(supplier.callGetProductUrl(item)).toBe("product/123.html");
  });

  it("falls back to url_key + url_suffix when there are no rewrites", () => {
    const item = makeItem({ url_rewrites: [], url_key: "potassium-nitrate", url_suffix: ".html" });
    expect(supplier.callGetProductUrl(item)).toBe("potassium-nitrate.html");
  });

  it("respects a non-default url_suffix", () => {
    const item = makeItem({ url_rewrites: [], url_key: "foo", url_suffix: ".htm" });
    expect(supplier.callGetProductUrl(item)).toBe("foo.htm");
  });

  it("defaults the suffix to .html when url_suffix is undefined", () => {
    const item = makeItem({ url_rewrites: [], url_key: "foo", url_suffix: undefined });
    expect(supplier.callGetProductUrl(item)).toBe("foo.html");
  });

  it("defaults the suffix to .html when url_suffix is null", () => {
    const item = makeItem({ url_rewrites: [], url_key: "foo", url_suffix: null });
    expect(supplier.callGetProductUrl(item)).toBe("foo.html");
  });

  it("falls back when the first rewrite's url is an empty string", () => {
    const item = makeItem({
      url_rewrites: [{ url: "", parameters: [] }],
      url_key: "foo",
      url_suffix: ".html",
    });
    expect(supplier.callGetProductUrl(item)).toBe("foo.html");
  });

  it("falls back when url_rewrites is missing entirely", () => {
    const item = makeItem({ url_key: "foo", url_suffix: ".html" });
    // An item whose url_rewrites field is absent exercises the optional-chaining path.
    delete (item as { url_rewrites?: unknown }).url_rewrites;
    expect(supplier.callGetProductUrl(item)).toBe("foo.html");
  });
});

describe("SupplierBaseMagento2 wires getProductUrl into the product permalink", () => {
  it("uses the url_rewrite (plus storeCode) for the permalink", () => {
    const item = makeItem({
      url_rewrites: [{ url: "sodium-chloride.html", parameters: [] }],
      url_key: "should-not-be-used",
    });

    const [builder] = supplier.callInitProductBuilders([item]);

    expect(builder).toBeInstanceOf(ProductBuilder);
    const permalink = builder.get("permalink");
    expect(typeof permalink).toBe("string");
    expect(permalink).toContain("sodium-chloride.html");
    expect(permalink).toContain("us_en"); // default storeCode
    expect(permalink).not.toContain("should-not-be-used");
  });

  it("uses url_key + url_suffix for the permalink when there is no rewrite", () => {
    const item = makeItem({ url_rewrites: [], url_key: "potassium-nitrate", url_suffix: ".html" });

    const [builder] = supplier.callInitProductBuilders([item]);

    expect(builder.get("permalink")).toContain("potassium-nitrate.html");
  });
});
