import { describe, expect, it } from "vitest";
import { isValidSearchResponse, isValidSearchResponseItem } from "../chemsavers";

describe("Chemsavers TypeGuards", () => {
  describe("isValidSearchResponseItem", () => {
    const validProduct = {
      document: {
        CAS: "7647-14-5",
        id: "prod_123",
        inventoryLevel: 100,
        name: "Sodium Chloride",
        product_id: 12345,
        retailPrice: 29.99,
        salePrice: 24.99,
        price: 24.99,
        sku: "SC-500G",
        upc: "123456789012",
        url: "/products/sodium-chloride",
      },
    };

    it("should return true for a valid product object", () => {
      expect(isValidSearchResponseItem(validProduct)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isValidSearchResponseItem(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      const nonObjectValues = [
        "not an object",
        123,
        true,
        false,
        undefined,
        () => {},
        Symbol("product"),
        [],
      ];

      nonObjectValues.forEach((value) => {
        expect(isValidSearchResponseItem(value)).toBe(false);
      });
    });

    it("should return false for objects missing document property", () => {
      const noDocument = {
        // Missing document property
        CAS: "7647-14-5",
        name: "Sodium Chloride",
      };

      expect(isValidSearchResponseItem(noDocument)).toBe(false);
    });

    it("should return false for objects with non-object document property", () => {
      const nonObjectDocument = {
        document: "not an object",
      };

      expect(isValidSearchResponseItem(nonObjectDocument)).toBe(false);
    });

    it("should return false for objects with undefined document property", () => {
      const undefinedDocument = {
        document: undefined,
      };

      expect(isValidSearchResponseItem(undefinedDocument)).toBe(false);
    });

    it("should return false for objects missing required document properties", () => {
      const missingProps = [
        {
          document: {
            id: "prod_123",
            inventoryLevel: 100,
            name: "Sodium Chloride",
            product_id: 12345,
            retailPrice: 29.99,
            salePrice: 24.99,
            price: 24.99,
            sku: "SC-500G",
            upc: "123456789012",
            //url: "/products/sodium-chloride",
          },
        },
        {
          document: {
            CAS: "7647-14-5",
            // Missing id
            inventoryLevel: 100,
            name: "Sodium Chloride",
            product_id: 12345,
            retailPrice: 29.99,
            salePrice: 24.99,
            //price: 24.99,
            sku: "SC-500G",
            upc: "123456789012",
            url: "/products/sodium-chloride",
          },
        },
        // ... and so on for each required property
      ];

      missingProps.forEach((product) => {
        expect(isValidSearchResponseItem(product)).toBe(false);
      });
    });

    it("should return false for objects with wrong property types", () => {
      const wrongTypes = [
        {
          document: {
            ...validProduct.document,
            //CAS: 7647145, // Should be string
            id: undefined,
          },
        },
        {
          document: {
            ...validProduct.document,
            id: 123, // Should be string
          },
        },
        {
          document: {
            ...validProduct.document,
            inventoryLevel: "100", // Should be number
          },
        },
        {
          document: {
            ...validProduct.document,
            name: 123, // Should be string
          },
        },
        {
          document: {
            ...validProduct.document,
            product_id: "12345", // Should be number
          },
        },
        {
          document: {
            ...validProduct.document,
            retailPrice: "29.99", // Should be number
          },
        },
        {
          document: {
            ...validProduct.document,
            salePrice: "24.99", // Should be number
          },
        },
        {
          document: {
            ...validProduct.document,
            price: "24.99", // Should be number
          },
        },
        {
          document: {
            ...validProduct.document,
            sku: 123, // Should be string
          },
        },
        {
          document: {
            ...validProduct.document,
            upc: 123456789012, // Should be string
          },
        },
        {
          document: {
            ...validProduct.document,
            url: 123, // Should be string
          },
        },
      ];

      wrongTypes.forEach((product) => {
        expect(isValidSearchResponseItem(product)).toBe(false);
      });
    });
  });

  describe("isValidSearchResponse", () => {
    const validResponse = {
      results: [
        {
          hits: [
            {
              document: {
                CAS: "7647-14-5",
                id: "prod_123",
                inventoryLevel: 100,
                name: "Sodium Chloride",
                product_id: 12345,
                retailPrice: 29.99,
                salePrice: 24.99,
                price: 24.99,
                sku: "SC-500G",
                upc: "123456789012",
                url: "/products/sodium-chloride",
              },
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
      const nonObjectValues = [
        "not an object",
        123,
        true,
        false,
        undefined,
        () => {},
        Symbol("response"),
        [],
      ];

      nonObjectValues.forEach((value) => {
        expect(isValidSearchResponse(value)).toBe(false);
      });
    });

    it("should return false for objects missing results property", () => {
      const noResults = {
        // Missing results property
      };

      expect(isValidSearchResponse(noResults)).toBe(false);
    });

    it("should return false for objects with non-array results", () => {
      const nonArrayResults = {
        results: "not an array",
      };

      expect(isValidSearchResponse(nonArrayResults)).toBe(false);
    });

    it("should return false for objects with empty results array", () => {
      const emptyResults = {
        results: [],
      };

      expect(isValidSearchResponse(emptyResults)).toBe(false);
    });

    it("should return false for objects with missing hits property", () => {
      const noHits = {
        results: [
          {
            // Missing hits property
          },
        ],
      };

      expect(isValidSearchResponse(noHits)).toBe(false);
    });

    it("should return false for objects with non-array hits", () => {
      const nonArrayHits = {
        results: [
          {
            hits: "not an array",
          },
        ],
      };

      expect(isValidSearchResponse(nonArrayHits)).toBe(false);
    });

    it("should return false for objects with invalid hits", () => {
      const invalidHits = [
        {
          results: [
            {
              hits: [
                {
                  // Invalid hit (missing document)
                },
              ],
            },
          ],
        },
        {
          results: [
            {
              hits: [
                {
                  document: {
                    // Invalid document (missing required properties)
                    name: "Sodium Chloride",
                  },
                },
              ],
            },
          ],
        },
        {
          results: [
            {
              hits: [
                {
                  document: {
                    // Invalid document (wrong property types)
                    CAS: 7647145,
                    id: "prod_123",
                    inventoryLevel: 100,
                    name: "Sodium Chloride",
                    productId: 12345,
                    retailPrice: 29.99,
                    salePrice: 24.99,
                    price: 24.99,
                    sku: "SC-500G",
                    upc: "123456789012",
                    url: "/products/sodium-chloride",
                  },
                },
              ],
            },
          ],
        },
      ];

      invalidHits.forEach((response) => {
        expect(isValidSearchResponse(response)).toBe(false);
      });
    });

    it("should handle multiple valid hits in the response", () => {
      const multipleHits = {
        results: [
          {
            hits: [
              {
                document: {
                  CAS: "7647-14-5",
                  id: "prod_123",
                  inventoryLevel: 100,
                  name: "Sodium Chloride",
                  product_id: 12345,
                  retailPrice: 29.99,
                  salePrice: 24.99,
                  price: 24.99,
                  sku: "SC-500G",
                  upc: "123456789012",
                  url: "/products/sodium-chloride",
                },
              },
              {
                document: {
                  CAS: "67-64-1",
                  id: "prod_456",
                  inventoryLevel: 50,
                  name: "Acetone",
                  product_id: 67890,
                  retailPrice: 19.99,
                  salePrice: 15.99,
                  price: 15.99,
                  sku: "AC-1L",
                  upc: "987654321098",
                  url: "/products/acetone",
                },
              },
            ],
          },
        ],
      };

      expect(isValidSearchResponse(multipleHits)).toBe(true);
    });

    it("should return false if any hit in the response is invalid", () => {
      const mixedHits = {
        results: [
          {
            hits: [
              {
                document: {
                  CAS: "7647-14-5",
                  id: "prod_123",
                  inventoryLevel: 100,
                  name: "Sodium Chloride",
                  product_id: 12345,
                  retailPrice: 29.99,
                  salePrice: 24.99,
                  price: 24.99,
                  sku: "SC-500G",
                  upc: "123456789012",
                  url: "/products/sodium-chloride",
                },
              },
              {
                document: {
                  // Invalid hit (missing required properties)
                  name: "Acetone",
                },
              },
            ],
          },
        ],
      };

      expect(isValidSearchResponse(mixedHits)).toBe(false);
    });
  });
});
