import { ProductBuilder } from "@/utils/ProductBuilder";
import { describe, expect, it } from "vitest";

// USD pricing keeps build() from making a currency-conversion network call.
const makeBuilder = () =>
  new ProductBuilder<Product>("https://example.com")
    .setBasicInfo("Sodium chloride", "/products/sodium-chloride", "TestSupplier")
    .setPricing(10, "USD", "$")
    .setQuantity(500, "g");

describe("ProductBuilder permalink", () => {
  it("defaults permalink to the processing url when none is set", async () => {
    const product = await makeBuilder().build();

    expect(product?.url).toBe("https://example.com/products/sodium-chloride");
    expect(product?.permalink).toBe(product?.url);
  });

  it("keeps an explicitly set permalink distinct from the processing url", async () => {
    const product = await makeBuilder()
      .setURL("/api/v1/products/123")
      .setPermalink("/product-page/sodium-chloride")
      .build();

    expect(product?.url).toBe("https://example.com/api/v1/products/123");
    expect(product?.permalink).toBe("https://example.com/product-page/sodium-chloride");
    expect(product?.permalink).not.toBe(product?.url);
  });

  it("absolutizes a relative permalink against the base url", async () => {
    const product = await makeBuilder().setPermalink("/product-page/x").build();

    expect(product?.permalink).toBe("https://example.com/product-page/x");
  });
});
