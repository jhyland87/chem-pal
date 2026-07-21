import { ProductBuilder } from "@/utils/ProductBuilder";
import { describe, expect, it } from "vitest";
import { SupplierLibertySci } from "../SupplierLibertySci";

type LibertySciInternals = {
  initProductBuilders: (results: WooCommerceSearchResponseItem[]) => ProductBuilder<Product>[];
};

const makeSupplier = (): InstanceType<typeof SupplierLibertySci> =>
  new SupplierLibertySci("test", 1);

const baseItem = (
  overrides: Partial<WooCommerceSearchResponseItem> = {},
): WooCommerceSearchResponseItem =>
  ({
    id: 30637,
    name: "Sodium Hydroxide, granular, 500 g",
    type: "simple",
    description: "",
    short_description: "",
    permalink: "https://libertysci.com/product/sodium-hydroxide/",
    is_in_stock: true,
    sold_individually: false,
    sku: "S10522",
    prices: {
      price: "1783",
      regular_price: "1800",
      sale_price: "1783",
      currency_code: "USD",
      currency_symbol: "$",
      currency_minor_unit: 2,
      currency_decimal_separator: ".",
      currency_thousand_separator: ",",
      currency_prefix: "$ ",
      currency_suffix: "",
    },
    attributes: [],
    variations: [],
    ...overrides,
  }) as unknown as WooCommerceSearchResponseItem;

// The real-world shape: "<formula>, F.W. <value>" sits amid marketing prose, shipping
// codes (UN1823), and hazard text — all of which the old whole-description scan mistook
// for a formula.
const naohDescription =
  "<p>Sodium Hydroxide<br />\ncaustic soda, soda lye<br />\nNaOH, F.W. 40.00<br />\n" +
  "CAS No.: <em>1310-73-2</em></p>\n<p>Shipping: <strong>LQ</strong> " +
  "<em>Sodium hydroxide, solid, UN1823, 8, PG II</em></p>";

describe("SupplierLibertySci initProductBuilders", () => {
  it("reads the formula sitting just before the F.W. label, not the label itself", () => {
    const supplier = makeSupplier() as unknown as LibertySciInternals;

    const [builder] = supplier.initProductBuilders([baseItem({ description: naohDescription })]);

    // "F.W" parses as F·W (fluorine + tungsten); the fix must pick NaOH instead.
    expect(builder.get("formula")).toBe("NaOH");
    expect(builder.get("moleweight")).toBe(40);
  });

  it("renders a tagged formula before the F.W. label to glyphs", () => {
    const supplier = makeSupplier() as unknown as LibertySciInternals;
    const description = "<p>Potassium Chlorate<br />\nKClO<sub>3</sub>, F.W. 122.55</p>";

    const [builder] = supplier.initProductBuilders([baseItem({ description })]);

    expect(builder.get("formula")).toBe("KClO₃");
    expect(builder.get("moleweight")).toBe(122.55);
  });

  it("leaves the formula unset when there is no weight label (e.g. a solution)", () => {
    const supplier = makeSupplier() as unknown as LibertySciInternals;
    // No F.W./M.W. label; a shipping code like UN1824 must not be read as a formula.
    const description =
      "<p>Sodium Hydroxide Solution<br />\n6 Molar</p>\n<p>Shipping: <strong>LQ</strong> " +
      "<em>Sodium hydroxide, solution, UN1824, 8, PG II</em></p>";

    const [builder] = supplier.initProductBuilders([baseItem({ description })]);

    expect(builder.get("formula")).toBeUndefined();
  });
});
