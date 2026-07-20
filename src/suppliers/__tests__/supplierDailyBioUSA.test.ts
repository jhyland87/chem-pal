// ProductBuilder must be imported before anything that pulls in SupplierBase (module-init cycle).
import { ProductBuilder } from "@/utils/ProductBuilder";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SupplierDailyBioUSA } from "../SupplierDailyBioUSA";

const products = JSON.parse(
  readFileSync(resolve(__dirname, "../__fixtures__/dailybiousa/products.json"), "utf8"),
);

const makeSupplier = () => new SupplierDailyBioUSA("acid", 5);

type DailyBioUSAInternals = {
  getFallbackQuantity: (product: ProductObject) => { quantity: number; uom: string } | undefined;
  initProductBuilders: (results: ProductObject[]) => ProductBuilder<Product>[];
};

describe("SupplierDailyBioUSA getFallbackQuantity", () => {
  it("reads the size out of the SKU's SIZE segment", () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;
    expect(supplier.getFallbackQuantity(products.skuSize)).toEqual({ quantity: 500, uom: "g" });
  });

  it("falls back to the product name when the SKU field holds something else", () => {
    // This listing's `sku` is literally "13.99"; the catalog code lives in the name instead.
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;
    expect(products.skuIsPrice.sku).toBe("13.99");
    expect(supplier.getFallbackQuantity(products.skuIsPrice)).toEqual({ quantity: 500, uom: "g" });
  });

  it("returns nothing when neither the SKU nor the name carries a SIZE segment", () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;
    expect(supplier.getFallbackQuantity(products.noSize)).toBeUndefined();
  });

  it.each([
    ["A992.SIZE,500G", { quantity: 500, uom: "g" }],
    ["L836.SIZE.2.5L", { quantity: 2.5, uom: "l" }],
    ["L933.SIZE.500ML", { quantity: 500, uom: "ml" }],
    ["A795.SIZE.500g", { quantity: 500, uom: "g" }],
    ["LW001", undefined],
  ])("parses the size in %s", (sku, expected) => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;
    const product = { ...products.skuSize, sku, name: "Some reagent" };
    expect(supplier.getFallbackQuantity(product)).toEqual(expected);
  });
});

describe("SupplierDailyBioUSA initProductBuilders", () => {
  it("keeps an option-less product by taking its quantity from the SKU", () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;

    const builders = supplier.initProductBuilders([products.skuSize]);

    expect(builders).toHaveLength(1);
    const product = builders[0].dump();
    expect(product.title).toBe("Sodium nitrite  A932.SIZE.500G  CAS:[7632-00-0]");
    expect(product.quantity).toBe(500);
    expect(product.uom).toBe("g");
    expect(product.price).toBe(21);
    expect(product.currencyCode).toBe("USD");
    // Grade lives in the description as a labeled "Grade:" field.
    expect(product.grade).toBe("Pure Grade");
    expect(product.cas).toBe("7632-00-0");
  });

  it("drops an option-less product whose SKU carries no size", () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;
    expect(supplier.initProductBuilders([products.noSize])).toHaveLength(0);
  });

  it("still prefers real Wix options over the SKU fallback", () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;

    const builders = supplier.initProductBuilders([products.withOptions]);

    expect(builders).toHaveLength(1);
    const product = builders[0].dump();
    expect(
      product.variants?.map((v) => ({ quantity: v.quantity, uom: v.uom, price: v.price })),
    ).toEqual([
      { quantity: 50, uom: "g", price: 38 },
      { quantity: 100, uom: "g", price: 61 },
      { quantity: 250, uom: "g", price: 90 },
    ]);
  });
});
