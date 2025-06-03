import { describe, expect, it } from "vitest";
import { isProductItem, isProductSelection, isValidSearchResponse, isWixProduct } from "../wix";

describe("Wix TypeGuards", () => {
  describe("isValidSearchResponse", () => {
    const validResponse = {
      data: {
        catalog: {
          category: {
            productsWithMetaData: {
              totalCount: 1,
              list: [
                {
                  price: 29.99,
                  formattedPrice: "$29.99",
                  name: "Sodium Chloride",
                  urlPart: "sodium-chloride",
                  productItems: [
                    {
                      id: "item_123",
                      formattedPrice: "$29.99",
                      price: 29.99,
                      optionsSelections: [
                        {
                          id: "opt_1",
                          value: "500g",
                          description: "500g Bottle",
                          key: "size",
                          inStock: true,
                        },
                      ],
                    },
                  ],
                  options: [
                    {
                      selections: [
                        {
                          id: "opt_1",
                          value: "500g",
                          description: "500g Bottle",
                          key: "size",
                          inStock: true,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
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

    it("should return false for missing data property", () => {
      const noData = {};
      expect(isValidSearchResponse(noData)).toBe(false);
    });

    it("should return false for missing catalog property", () => {
      const noCatalog = {
        data: {},
      };
      expect(isValidSearchResponse(noCatalog)).toBe(false);
    });

    it("should return false for missing category property", () => {
      const noCategory = {
        data: {
          catalog: {},
        },
      };
      expect(isValidSearchResponse(noCategory)).toBe(false);
    });

    it("should return false for missing productsWithMetaData property", () => {
      const noProducts = {
        data: {
          catalog: {
            category: {},
          },
        },
      };
      expect(isValidSearchResponse(noProducts)).toBe(false);
    });

    it("should return false for missing required properties in productsWithMetaData", () => {
      const missingProps = {
        data: {
          catalog: {
            category: {
              productsWithMetaData: {
                // Missing totalCount and list
              },
            },
          },
        },
      };
      expect(isValidSearchResponse(missingProps)).toBe(false);
    });

    it("should return false for invalid product list", () => {
      const invalidList = {
        data: {
          catalog: {
            category: {
              productsWithMetaData: {
                totalCount: 1,
                list: [
                  {
                    // Invalid product object
                    name: "Invalid Product",
                  },
                ],
              },
            },
          },
        },
      };
      expect(isValidSearchResponse(invalidList)).toBe(false);
    });
  });

  describe("isWixProduct", () => {
    const validProduct = {
      price: 29.99,
      formattedPrice: "$29.99",
      name: "Sodium Chloride",
      urlPart: "sodium-chloride",
      productItems: [
        {
          id: "item_123",
          formattedPrice: "$29.99",
          price: 29.99,
          optionsSelections: [
            {
              id: "opt_1",
              value: "500g",
              description: "500g Bottle",
              key: "size",
              inStock: true,
            },
          ],
        },
      ],
      options: [
        {
          selections: [
            {
              id: "opt_1",
              value: "500g",
              description: "500g Bottle",
              key: "size",
              inStock: true,
            },
          ],
        },
      ],
    };

    it("should return true for a valid product object", () => {
      expect(isWixProduct(validProduct)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isWixProduct(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isWixProduct("not an object")).toBe(false);
      expect(isWixProduct(123)).toBe(false);
      expect(isWixProduct(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingName = { ...validProduct };
      delete (missingName as any).name;
      expect(isWixProduct(missingName)).toBe(false);

      const missingProductItems = { ...validProduct };
      delete (missingProductItems as any).productItems;
      expect(isWixProduct(missingProductItems)).toBe(false);
    });

    it("should return false for wrong property types", () => {
      const wrongTypes = {
        ...validProduct,
        price: "29.99", // Should be number
        name: 123, // Should be string
        productItems: "invalid", // Should be array
      };
      expect(isWixProduct(wrongTypes)).toBe(false);
    });

    it("should return false for invalid product items array", () => {
      const invalidItems = {
        ...validProduct,
        productItems: [
          {
            // Invalid product item
            id: 123, // Should be string
          },
        ],
      };
      expect(isWixProduct(invalidItems)).toBe(false);
    });
  });

  describe("isProductItem", () => {
    const validItem = {
      id: "item_123",
      formattedPrice: "$29.99",
      price: 29.99,
      optionsSelections: [
        {
          id: "opt_1",
          value: "500g",
          description: "500g Bottle",
          key: "size",
          inStock: true,
        },
      ],
    };

    it("should return true for a valid product item", () => {
      expect(isProductItem(validItem)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isProductItem(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isProductItem("not an object")).toBe(false);
      expect(isProductItem(123)).toBe(false);
      expect(isProductItem(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingId = { ...validItem };
      delete (missingId as any).id;
      expect(isProductItem(missingId)).toBe(false);

      const missingOptionsSelections = { ...validItem };
      delete (missingOptionsSelections as any).optionsSelections;
      expect(isProductItem(missingOptionsSelections)).toBe(false);
    });

    it("should return false for wrong property types", () => {
      const wrongTypes = {
        ...validItem,
        id: 123, // Should be string
        price: "29.99", // Should be number
        optionsSelections: "invalid", // Should be array
      };
      expect(isProductItem(wrongTypes)).toBe(false);
    });

    it.skip("should return false for invalid options selections array", () => {
      const invalidSelections = {
        ...validItem,
        optionsSelections: [
          {
            // Invalid selection
            id: 123, // Should be string
          },
        ],
      };
      expect(isProductItem(invalidSelections)).toBe(false);
    });
  });

  describe("isProductSelection", () => {
    const validSelection = {
      id: "opt_1",
      value: "500g",
      description: "500g Bottle",
      key: "size",
      inStock: true,
    };

    it("should return true for a valid product selection", () => {
      expect(isProductSelection(validSelection)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isProductSelection(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isProductSelection("not an object")).toBe(false);
      expect(isProductSelection(123)).toBe(false);
      expect(isProductSelection(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingId = { ...validSelection };
      delete (missingId as any).id;
      expect(isProductSelection(missingId)).toBe(false);

      const missingValue = { ...validSelection };
      delete (missingValue as any).value;
      expect(isProductSelection(missingValue)).toBe(false);
    });

    it("should return false for wrong property types", () => {
      const wrongTypes = {
        ...validSelection,
        id: 123, // Should be string
        value: 500, // Should be string
        inStock: "true", // Should be boolean
      };
      expect(isProductSelection(wrongTypes)).toBe(false);
    });
  });
});
