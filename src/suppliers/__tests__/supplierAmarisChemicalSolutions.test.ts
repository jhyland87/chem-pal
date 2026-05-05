import ProductBuilder from "@/utils/ProductBuilder";
import { describe, expect, it } from "vitest";
import { SupplierAmarisChemicalSolutions } from "..";

type AmarisInternals = {
  getAdditionalQuantityStrings: (item: WooCommerceSearchResponseItem) => string[];
  initProductBuilders: (results: WooCommerceSearchResponseItem[]) => ProductBuilder<Product>[];
};

const makeSupplier = (): InstanceType<typeof SupplierAmarisChemicalSolutions> =>
  new SupplierAmarisChemicalSolutions("test", 1);

const baseItem = (
  overrides: Partial<WooCommerceSearchResponseItem> = {},
): WooCommerceSearchResponseItem =>
  ({
    id: 30637,
    name: "Aluminium Ammonium Sulphate Extra Pure",
    type: "simple",
    description: "",
    short_description: "",
    permalink: "https://amarischemicalsolutions.com/product/aluminium-ammonium-sulphate/",
    is_in_stock: true,
    sold_individually: false,
    sku: "ACS-30637",
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

describe("SupplierAmarisChemicalSolutions", () => {
  describe("getAdditionalQuantityStrings", () => {
    it("returns every term name across all attributes", () => {
      const supplier = makeSupplier() as unknown as AmarisInternals;
      const item = baseItem({
        attributes: [
          {
            id: 3,
            name: "PACK SIZE",
            taxonomy: "pa_pack-size",
            has_variations: false,
            terms: [
              { id: 8018, name: "500 grams Plastic Tin", slug: "500-grams-plastic-tin" },
              { id: 8019, name: "1 kg Plastic Tin", slug: "1-kg-plastic-tin" },
            ],
          },
        ],
      });

      expect(supplier.getAdditionalQuantityStrings(item)).toEqual([
        "500 grams Plastic Tin",
        "1 kg Plastic Tin",
      ]);
    });

    it("returns an empty array when attributes is missing or not an array", () => {
      const supplier = makeSupplier() as unknown as AmarisInternals;
      expect(
        supplier.getAdditionalQuantityStrings(
          baseItem({ attributes: undefined as unknown as WooCommerceSearchResponseItem["attributes"] }),
        ),
      ).toEqual([]);
      expect(supplier.getAdditionalQuantityStrings(baseItem({ attributes: [] }))).toEqual([]);
    });

    it("tolerates attributes whose terms are missing", () => {
      const supplier = makeSupplier() as unknown as AmarisInternals;
      const item = baseItem({
        attributes: [
          {
            id: 1,
            name: "BRAND",
            taxonomy: "pa_brand",
            has_variations: false,
            terms: undefined as unknown as { id: number; name: string; slug: string }[],
          },
        ],
      });
      expect(supplier.getAdditionalQuantityStrings(item)).toEqual([]);
    });
  });

  describe("initProductBuilders integration", () => {
    it("derives quantity from an attribute term when name/description omit it", async () => {
      const supplier = makeSupplier() as unknown as AmarisInternals;
      const item = baseItem({
        attributes: [
          {
            id: 3,
            name: "PACK SIZE",
            taxonomy: "pa_pack-size",
            has_variations: false,
            terms: [{ id: 8018, name: "500 grams Plastic Tin", slug: "500-grams-plastic-tin" }],
          },
        ],
      });

      const [builder] = supplier.initProductBuilders([item]);
      const product = await builder.build();

      expect(product?.quantity).toBe(500);
      expect(product?.uom).toBe("g");
    });

    it("ignores non-quantity term names without throwing", async () => {
      const supplier = makeSupplier() as unknown as AmarisInternals;
      const item = baseItem({
        name: "Acetone Reagent 250ml",
        attributes: [
          {
            id: 4,
            name: "GRADE",
            taxonomy: "pa_grade",
            has_variations: false,
            terms: [{ id: 9001, name: "Reagent ACS", slug: "reagent-acs" }],
          },
        ],
      });

      const [builder] = supplier.initProductBuilders([item]);
      const product = await builder.build();

      expect(product?.quantity).toBe(250);
      expect(product?.uom).toBe("ml");
    });
  });
});
