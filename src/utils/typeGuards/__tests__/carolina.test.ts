import { describe, expect, it } from "vitest";
import {
  isATGResponse,
  isResponseOk,
  isSearchResultItem,
  isValidProductResponse,
  isValidSearchResponse,
} from "../carolina";

// Types are declared globally in carolina.d.ts
// No need to import them

describe("Carolina TypeGuards", () => {
  describe("isResponseOk", () => {
    const validResponse = {
      responseStatusCode: 200,
      "@type": "SearchResponse",
      contents: {},
    };

    it("should return true for a valid response object", () => {
      expect(isResponseOk(validResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isResponseOk(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isResponseOk("not an object")).toBe(false);
      expect(isResponseOk(123)).toBe(false);
      expect(isResponseOk(undefined)).toBe(false);
    });

    it("should return false for invalid status code", () => {
      const invalidStatus = { ...validResponse, responseStatusCode: 404 };
      expect(isResponseOk(invalidStatus)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingType = { ...validResponse };
      delete (missingType as any)["@type"];
      expect(isResponseOk(missingType)).toBe(false);

      const missingContents = { ...validResponse };
      delete (missingContents as any).contents;
      expect(isResponseOk(missingContents)).toBe(false);
    });
  });

  describe("isValidSearchResponse", () => {
    const validSearchResponse = {
      responseStatusCode: 200,
      "@type": "SearchResponse",
      contents: {
        ContentFolderZone: [
          {
            childRules: [{}],
          },
        ],
      },
    };

    it("should return true for a valid search response", () => {
      expect(isValidSearchResponse(validSearchResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isValidSearchResponse(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isValidSearchResponse("not an object")).toBe(false);
      expect(isValidSearchResponse(123)).toBe(false);
      expect(isValidSearchResponse(undefined)).toBe(false);
    });

    it("should return false for empty ContentFolderZone", () => {
      const emptyFolder = {
        ...validSearchResponse,
        contents: { ContentFolderZone: [] },
      };
      expect(isValidSearchResponse(emptyFolder)).toBe(false);
    });

    it("should return false for missing childRules", () => {
      const noChildRules = {
        ...validSearchResponse,
        contents: {
          ContentFolderZone: [{}],
        },
      };
      expect(isValidSearchResponse(noChildRules)).toBe(false);
    });

    it("should return false for invalid status code", () => {
      const invalidStatus = { ...validSearchResponse, responseStatusCode: 404 };
      expect(isValidSearchResponse(invalidStatus)).toBe(false);
    });
  });

  describe("isSearchResultItem", () => {
    const validSearchResult: CarolinaSearchResult = {
      "product.thumbnailImg": "https://example.com/image.jpg",
      "product.productName": "Test Product",
      "product.productId": "12345",
      "product.shortDescription": "Test Description",
      itemPrice: "29.99",
      "product.seoName": "test-product",
      productUrl: "/products/test-product",
      productName: "Test Product 500g",
      qtyDiscountAvailable: false,
      productSquence: 1,
    };

    it("should return true for a valid search result item", () => {
      expect(isSearchResultItem(validSearchResult)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSearchResultItem(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isSearchResultItem("not an object")).toBe(false);
      expect(isSearchResultItem(123)).toBe(false);
      expect(isSearchResultItem(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingProductId = { ...validSearchResult };
      delete (missingProductId as any)["product.productId"];
      expect(isSearchResultItem(missingProductId)).toBe(false);

      const missingProductName = { ...validSearchResult };
      delete (missingProductName as any)["product.productName"];
      expect(isSearchResultItem(missingProductName)).toBe(false);
    });
  });

  describe("isValidProductResponse", () => {
    const validProductResponse = {
      contents: {
        MainContent: [
          {
            atgResponse: {},
          },
        ],
      },
    };

    it("should return true for a valid product response", () => {
      expect(isValidProductResponse(validProductResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isValidProductResponse(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isValidProductResponse("not an object")).toBe(false);
      expect(isValidProductResponse(123)).toBe(false);
      expect(isValidProductResponse(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingMainContent = { contents: {} };
      expect(isValidProductResponse(missingMainContent)).toBe(false);
    });
  });

  describe("isATGResponse", () => {
    const validATGResponse = {
      result: "success",
      response: {
        response: {
          displayName: "Test Product",
          longDescription: "Detailed test description",
          shortDescription: "Test description",
          product: "{}",
          dataLayer: {},
          canonicalUrl: "/products/test-product",
        },
      },
    };

    it("should return true for a valid ATG response", () => {
      expect(isATGResponse(validATGResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isATGResponse(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isATGResponse("not an object")).toBe(false);
      expect(isATGResponse(123)).toBe(false);
      expect(isATGResponse(undefined)).toBe(false);
    });

    it("should return false for missing required properties", () => {
      const missingResult = { ...validATGResponse };
      delete (missingResult as any).result;
      expect(isATGResponse(missingResult)).toBe(false);

      const missingResponse = { ...validATGResponse };
      delete (missingResponse as any).response;
      expect(isATGResponse(missingResponse)).toBe(false);
    });
  });
});
