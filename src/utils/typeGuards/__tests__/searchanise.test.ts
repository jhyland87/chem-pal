import { describe, expect, it } from "vitest";
import { isItemListing, isSearchaniseVariant, isValidSearchResponse } from "../searchanise";

describe("Searchanise TypeGuards", () => {
  describe("isValidSearchResponse", () => {
    const validResponse = {
      totalItems: 100,
      startIndex: 0,
      itemsPerPage: 20,
      currentItemCount: 20,
      pageStartIndex: 0,
      totalPages: 5,
      suggestions: ["sodium", "chloride", "nacl"],
      pages: [1, 2, 3, 4, 5],
      items: [
        {
          title: "Sodium Chloride",
          price: "29.99",
          link: "/products/nacl",
          product_id: "12345",
          product_code: "CHEM-001",
          quantity: "500g",
          vendor: "Chemical Supplier",
          original_product_id: "12345",
          list_price: "39.99",
          shopify_variants: [
            {
              sku: "CHEM-001-500G",
              price: "29.99",
              link: "/products/nacl?variant=1",
              variant_id: "1",
              quantity_total: "100",
              options: { Model: "500g" },
            },
          ],
        },
      ],
    };

    it("should return true for a valid search response", () => {
      expect(isValidSearchResponse(validResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isValidSearchResponse(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isValidSearchResponse("not an object")).toBe(false);
      expect(isValidSearchResponse(123)).toBe(false);
      expect(isValidSearchResponse(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingTotalItems = { ...validResponse };
      delete (missingTotalItems as any).totalItems;
      expect(isValidSearchResponse(missingTotalItems)).toBe(false);

      const missingItems = { ...validResponse };
      delete (missingItems as any).items;
      expect(isValidSearchResponse(missingItems)).toBe(false);
    });

    it("should return false for wrong property types", () => {
      const wrongTypes = {
        ...validResponse,
        totalItems: "100", // Should be number
        itemsPerPage: "20", // Should be number
        items: "not an array", // Should be array
      };
      expect(isValidSearchResponse(wrongTypes)).toBe(false);
    });

    it("should return false for invalid items array", () => {
      const invalidItems = {
        ...validResponse,
        items: [
          {
            title: "Invalid Item",
            // Missing required properties
          },
        ],
      };
      expect(isValidSearchResponse(invalidItems)).toBe(false);
    });
  });

  describe("isSearchaniseVariant", () => {
    const validVariant = {
      sku: "CHEM-001-500G",
      price: "29.99",
      link: "/products/nacl?variant=1",
      variant_id: "1",
      quantity_total: "100",
      options: { Model: "500g" },
    };

    it("should return true for a valid Searchanise variant", () => {
      expect(isSearchaniseVariant(validVariant)).toBe(true);
    });

    it("should return true for variant with numeric quantity", () => {
      const numericQuantityVariant = {
        ...validVariant,
        quantity_total: 100,
      };
      expect(isSearchaniseVariant(numericQuantityVariant)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSearchaniseVariant(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isSearchaniseVariant("not an object")).toBe(false);
      expect(isSearchaniseVariant(123)).toBe(false);
      expect(isSearchaniseVariant(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingSku = { ...validVariant };
      delete (missingSku as any).sku;
      expect(isSearchaniseVariant(missingSku)).toBe(false);

      const missingOptions = { ...validVariant };
      delete (missingOptions as any).options;
      expect(isSearchaniseVariant(missingOptions)).toBe(false);
    });

    it("should return false for wrong property types", () => {
      const wrongTypes = {
        ...validVariant,
        sku: 12345, // Should be string
        price: 29.99, // Should be string
        link: 123, // Should be string
        variant_id: 1, // Should be string
        quantity_total: true, // Should be string or number
        options: "500g", // Should be object
      };
      expect(isSearchaniseVariant(wrongTypes)).toBe(false);
    });

    it("should return false when options is null", () => {
      const nullOptions = { ...validVariant, options: null };
      expect(isSearchaniseVariant(nullOptions)).toBe(false);
    });

    it("should accept quantity_total as either string or number", () => {
      expect(isSearchaniseVariant({ ...validVariant, quantity_total: "50" })).toBe(true);
      expect(isSearchaniseVariant({ ...validVariant, quantity_total: 50 })).toBe(true);
      expect(isSearchaniseVariant({ ...validVariant, quantity_total: true })).toBe(false);
      expect(isSearchaniseVariant({ ...validVariant, quantity_total: null })).toBe(false);
    });
  });

  describe("isItemListing", () => {
    const validItem = {
      title: "Sodium Chloride",
      price: "29.99",
      link: "/products/nacl",
      product_id: "12345",
      product_code: "CHEM-001",
      quantity: "500g",
      vendor: "Chemical Supplier",
      original_product_id: "12345",
      list_price: "39.99",
      shopify_variants: [
        {
          sku: "CHEM-001-500G",
          price: "29.99",
          link: "/products/nacl?variant=1",
          variant_id: "1",
          quantity_total: "100",
          options: { Model: "500g" },
        },
      ],
    };

    it("should return true for a valid item listing", () => {
      expect(isItemListing(validItem)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isItemListing(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isItemListing("not an object")).toBe(false);
      expect(isItemListing(123)).toBe(false);
      expect(isItemListing(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingTitle = { ...validItem };
      delete (missingTitle as any).title;
      expect(isItemListing(missingTitle)).toBe(false);

      const missingVariants = { ...validItem };
      delete (missingVariants as any).shopify_variants;
      expect(isItemListing(missingVariants)).toBe(false);
    });

    it("should return false for wrong property types", () => {
      const wrongTypes = {
        ...validItem,
        title: 123, // Should be string
        price: 29.99, // Should be string
        product_id: 12345, // Should be string
        shopify_variants: "invalid", // Should be array
      };
      expect(isItemListing(wrongTypes)).toBe(false);
    });

    it("should accept price as either string or number", () => {
      expect(isItemListing({ ...validItem, price: "29.99" })).toBe(true);
      expect(isItemListing({ ...validItem, price: 29.99 })).toBe(true);
      expect(isItemListing({ ...validItem, price: true })).toBe(false);
    });

    it("should return false for invalid variants array", () => {
      const invalidVariants = {
        ...validItem,
        shopify_variants: [
          {
            sku: 12345, // Should be string
            price: 29.99, // Should be string
            // Missing other required properties
          },
        ],
      };
      expect(isItemListing(invalidVariants)).toBe(false);
    });
  });
});
