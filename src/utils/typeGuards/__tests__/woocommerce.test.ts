import { describe, expect, it } from "vitest";
import {
  isProductVariant,
  isSearchResponse,
  isSearchResponseItem,
  isValidProductVariant,
} from "../woocommerce";

describe("WooCommerce TypeGuards", () => {
  describe("isSearchResponseItem", () => {
    const validItem = {
      id: 123,
      name: "Sodium Chloride",
      type: "simple",
      description: "High purity NaCl",
      short_description: "NaCl",
      permalink: "/product/sodium-chloride",
      is_in_stock: true,
      sold_individually: false,
      sku: "NACL-500",
      prices: {
        price: "29.99",
        regular_price: "34.99",
        sale_price: "29.99",
        currency_code: "USD",
        currency_symbol: "$",
        currency_minor_unit: 2,
        currency_decimal_separator: ".",
        currency_thousand_separator: ",",
        currency_prefix: "$",
        currency_suffix: "",
      },
    };

    it("should return true for a valid search response item", () => {
      expect(isSearchResponseItem(validItem)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSearchResponseItem(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isSearchResponseItem("not an object")).toBe(false);
      expect(isSearchResponseItem(123)).toBe(false);
      expect(isSearchResponseItem(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingId = { ...validItem };
      delete (missingId as any).id;
      expect(isSearchResponseItem(missingId)).toBe(false);

      const missingPrices = { ...validItem };
      delete (missingPrices as any).prices;
      expect(isSearchResponseItem(missingPrices)).toBe(false);
    });

    it("should return false for wrong property types", () => {
      const wrongTypes = {
        ...validItem,
        id: "123", // Should be number
        name: 456, // Should be string
        prices: "invalid", // Should be object
      };
      expect(isSearchResponseItem(wrongTypes)).toBe(false);
    });

    it("should return false for invalid prices object", () => {
      const invalidPrices = {
        ...validItem,
        prices: {
          price: 29.99, // Should be string
          regular_price: "34.99",
          sale_price: "29.99",
          currency_code: "USD",
          currency_symbol: "$",
          currency_minor_unit: "2", // Should be number
          currency_decimal_separator: ".",
          currency_thousand_separator: ",",
          currency_prefix: "$",
          currency_suffix: "",
        },
      };
      expect(isSearchResponseItem(invalidPrices)).toBe(false);
    });
  });

  describe("isSearchResponse", () => {
    const validResponse = [
      {
        id: 123,
        name: "Sodium Chloride",
        type: "simple",
        description: "High purity NaCl",
        short_description: "NaCl",
        permalink: "/product/sodium-chloride",
        is_in_stock: true,
        sold_individually: false,
        sku: "NACL-500",
        prices: {
          price: "29.99",
          regular_price: "34.99",
          sale_price: "29.99",
          currency_code: "USD",
          currency_symbol: "$",
          currency_minor_unit: 2,
          currency_decimal_separator: ".",
          currency_thousand_separator: ",",
          currency_prefix: "$",
          currency_suffix: "",
        },
      },
      {
        id: 124,
        name: "Potassium Chloride",
        type: "simple",
        description: "High purity KCl",
        short_description: "KCl",
        permalink: "/product/potassium-chloride",
        is_in_stock: true,
        sold_individually: false,
        sku: "KCL-500",
        prices: {
          price: "39.99",
          regular_price: "44.99",
          sale_price: "39.99",
          currency_code: "USD",
          currency_symbol: "$",
          currency_minor_unit: 2,
          currency_decimal_separator: ".",
          currency_thousand_separator: ",",
          currency_prefix: "$",
          currency_suffix: "",
        },
      },
    ];

    it("should return true for a valid search response", () => {
      expect(isSearchResponse(validResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSearchResponse(null)).toBe(false);
    });

    it("should return false for non-array values", () => {
      expect(isSearchResponse("not an array")).toBe(false);
      expect(isSearchResponse(123)).toBe(false);
      expect(isSearchResponse(undefined)).toBe(false);
      expect(isSearchResponse({ items: [] })).toBe(false);
    });

    it("should return false for array with invalid items", () => {
      const invalidItems = [
        { id: 123, name: "Sodium Chloride" }, // Missing required properties
        { id: 124, name: "Potassium Chloride" }, // Missing required properties
      ];
      expect(isSearchResponse(invalidItems)).toBe(false);
    });

    it("should return false for array with wrong property types", () => {
      const wrongTypes = [
        {
          ...validResponse[0],
          id: "123", // Should be number
          name: 456, // Should be string
        },
      ];
      expect(isSearchResponse(wrongTypes)).toBe(false);
    });
  });

  describe("isProductVariant", () => {
    const validVariant = {
      id: 123,
      name: "Sodium Chloride 500g",
      type: "variation",
      variation: "500g",
      description: "High purity NaCl",
      short_description: "NaCl",
      permalink: "/product/sodium-chloride-500g",
      is_in_stock: true,
      sold_individually: false,
      sku: "NACL-500",
      prices: {
        price: "29.99",
        regular_price: "34.99",
        sale_price: "29.99",
        currency_code: "USD",
        currency_symbol: "$",
        currency_minor_unit: 2,
        currency_decimal_separator: ".",
        currency_thousand_separator: ",",
        currency_prefix: "$",
        currency_suffix: "",
      },
      attributes: [
        {
          name: "Weight",
          option: "500g",
        },
      ],
      parent_id: 100,
    };

    it("should return true for a valid product variant", () => {
      expect(isProductVariant(validVariant)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isProductVariant(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isProductVariant("not an object")).toBe(false);
      expect(isProductVariant(123)).toBe(false);
      expect(isProductVariant(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingVariant = { ...validVariant };
      delete (missingVariant as any).variation;
      expect(isProductVariant(missingVariant)).toBe(false);

      const missingId = { ...validVariant };
      delete (missingId as any).id;
      expect(isProductVariant(missingId)).toBe(false);
    });

    it("should return false for wrong property types", () => {
      const wrongTypes = {
        ...validVariant,
        attributes: "invalid", // Should be array
        variation: [], // Should be number
      };
      expect(isProductVariant(wrongTypes)).toBe(false);
    });

    it.skip("should return false for invalid attributes array", () => {
      const invalidAttributes = {
        ...validVariant,
        attributes: [
          {
            variant: {}, // Should be string
            option: "500g",
          },
        ],
      };
      expect(isProductVariant(invalidAttributes)).toBe(false);
    });
  });

  describe("isValidProductVariant", () => {
    const validVariant = {
      id: 123,
      name: "Sodium Chloride 500g",
      type: "variation",
      variation: "500g",
      description: "High purity NaCl",
      short_description: "NaCl",
      permalink: "/product/sodium-chloride-500g",
      is_in_stock: true,
      sold_individually: false,
      sku: "NACL-500",
      prices: {
        price: "29.99",
        regular_price: "34.99",
        sale_price: "29.99",
        currency_code: "USD",
        currency_symbol: "$",
        currency_minor_unit: 2,
        currency_decimal_separator: ".",
        currency_thousand_separator: ",",
        currency_prefix: "$",
        currency_suffix: "",
      },
      attributes: [
        {
          name: "Weight",
          option: "500g",
        },
      ],
      parent_id: 100,
      variations: [
        {
          id: 8077,
          attributes: [
            {
              name: "Size",
              value: "1l",
            },
          ],
        },
      ],
    };

    it("should return true for a valid product variant", () => {
      expect(isValidProductVariant(validVariant)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isValidProductVariant(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isValidProductVariant("not an object")).toBe(false);
      expect(isValidProductVariant(123)).toBe(false);
      expect(isValidProductVariant(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingVariant = { ...validVariant };
      delete (missingVariant as any).variation;
      expect(isValidProductVariant(missingVariant)).toBe(false);

      const missingId = { ...validVariant };
      delete (missingId as any).id;
      expect(isValidProductVariant(missingId)).toBe(false);
    });

    it.skip("should return false for wrong property types", () => {
      const wrongTypes = {
        ...validVariant,
        variant: {}, // Should be string
        parent_id: "100", // Should be number
      };
      expect(isValidProductVariant(wrongTypes)).toBe(false);
    });

    it.skip("should return false for invalid attributes array", () => {
      const invalidAttributes = {
        ...validVariant,
        attributes: [
          {
            name: 123, // Should be string
            option: "500g",
          },
        ],
      };
      expect(isValidProductVariant(invalidAttributes)).toBe(false);
    });
  });
});
