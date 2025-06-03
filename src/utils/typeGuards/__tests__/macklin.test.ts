import { describe, expect, it } from "vitest";
import {
  ApiEndpoints,
  AuthRequiredEndpoints,
  isAuthCheckEndpoint,
  isAuthRequiredEndpoint,
  isMacklinApiResponse,
  isMacklinProductDetails,
  isMacklinProductDetailsResponse,
  isMacklinSearchResult,
  isTimestampResponse,
} from "../macklin";

describe("Macklin TypeGuards", () => {
  describe("isTimestampResponse", () => {
    const validResponse = {
      timestamp: 1748793383,
    };

    it("should return true for a valid timestamp response", () => {
      expect(isTimestampResponse(validResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isTimestampResponse(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      const nonObjectValues = [
        "not an object",
        123,
        true,
        false,
        undefined,
        () => {},
        Symbol("timestamp"),
        [],
      ];

      nonObjectValues.forEach((value) => {
        expect(isTimestampResponse(value)).toBe(false);
      });
    });

    it("should return false for objects missing timestamp property", () => {
      const noTimestamp = {};
      expect(isTimestampResponse(noTimestamp)).toBe(false);
    });

    it("should return false for objects with non-numeric timestamp", () => {
      const invalidTimestamp = {
        timestamp: "1748793383", // Should be number
      };
      expect(isTimestampResponse(invalidTimestamp)).toBe(false);
    });
  });

  describe("isMacklinApiResponse", () => {
    const validResponse = {
      code: 200,
      message: "Success",
      data: {
        // Any data type is allowed
        someData: "value",
      },
    };

    it("should return true for a valid API response", () => {
      expect(isMacklinApiResponse(validResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isMacklinApiResponse(null)).toBe(false);
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
        expect(isMacklinApiResponse(value)).toBe(false);
      });
    });

    it("should return false for objects missing required properties", () => {
      const missingProps = [
        {
          // Missing code
          message: "Success",
          data: {},
        },
        {
          code: 200,
          // Missing message
          data: {},
        },
        {
          code: 200,
          message: "Success",
          // Missing data
        },
        {
          // Missing all properties
        },
      ];

      missingProps.forEach((response) => {
        expect(isMacklinApiResponse(response)).toBe(false);
      });
    });

    it("should return false for objects with wrong property types", () => {
      const wrongTypes = [
        {
          code: "200", // Should be number
          message: "Success",
          data: {},
        },
        {
          code: 200,
          message: 123, // Should be string
          data: {},
        },
      ];

      wrongTypes.forEach((response) => {
        expect(isMacklinApiResponse(response)).toBe(false);
      });
    });
  });

  describe("isAuthRequiredEndpoint", () => {
    it("should return true for auth required endpoints", () => {
      Object.values(AuthRequiredEndpoints).forEach((endpoint) => {
        expect(isAuthRequiredEndpoint(endpoint)).toBe(true);
      });
    });

    it("should return false for non-auth required endpoints", () => {
      const nonAuthEndpoints = [
        "/api/timestamp",
        "/api/item/search",
        "/api/user/info",
        "/api/fruit/head",
        "/api/favourite/add",
        "/api/fruit/add",
        "/api/quick/buy",
        "/invalid/endpoint",
        "",
        "not a url",
      ];

      nonAuthEndpoints.forEach((endpoint) => {
        expect(isAuthRequiredEndpoint(endpoint)).toBe(false);
      });
    });
  });

  describe("isAuthCheckEndpoint", () => {
    it("should return true for auth check endpoints", () => {
      const authCheckEndpoints = [
        ApiEndpoints.USER_INFO,
        ApiEndpoints.FRUIT_HEAD,
        ApiEndpoints.FAVOURITE_ADD,
        ApiEndpoints.FRUIT_ADD,
      ];

      authCheckEndpoints.forEach((endpoint) => {
        expect(isAuthCheckEndpoint(endpoint)).toBe(true);
      });
    });

    it("should return false for non-auth check endpoints", () => {
      const nonAuthCheckEndpoints = [
        ApiEndpoints.TIMESTAMP,
        ApiEndpoints.SEARCH,
        ApiEndpoints.QUICK_BUY,
        "/invalid/endpoint",
        "",
        "not a url",
      ];

      nonAuthCheckEndpoints.forEach((endpoint) => {
        expect(isAuthCheckEndpoint(endpoint)).toBe(false);
      });
    });
  });

  describe("isMacklinSearchResult", () => {
    const validSearchResult = {
      list: [
        {
          // Any item type is allowed
          id: 1,
          name: "Product 1",
        },
      ],
    };

    it("should return true for a valid search result", () => {
      expect(isMacklinSearchResult(validSearchResult)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isMacklinSearchResult(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      const nonObjectValues = [
        "not an object",
        123,
        true,
        false,
        undefined,
        () => {},
        Symbol("searchResult"),
        [],
      ];

      nonObjectValues.forEach((value) => {
        expect(isMacklinSearchResult(value)).toBe(false);
      });
    });

    it("should return false for objects missing list property", () => {
      const noList = {};
      expect(isMacklinSearchResult(noList)).toBe(false);
    });

    it("should return false for objects with non-object list", () => {
      const invalidList = {
        list: "not an object", // Should be object
      };
      expect(isMacklinSearchResult(invalidList)).toBe(false);
    });

    it("should return false for objects with null list", () => {
      const nullList = {
        list: null,
      };
      expect(isMacklinSearchResult(nullList)).toBe(false);
    });
  });

  describe("isMacklinProductDetailsResponse", () => {
    const validProductDetails = {
      item_id: 123,
      item_code: "ABC123",
      product_id: 456,
      product_code: "PROD456",
      product_price: "29.99",
      product_unit: "g",
      product_locked_stock: "0",
      product_pack: "500",
      item_en_name: "Sodium Chloride",
      product_stock: "100",
      chem_cas: "7647-14-5",
      delivery_desc_show: "In stock",
    };

    const validResponse = {
      list: [validProductDetails],
    };

    it("should return true for a valid product details response", () => {
      expect(isMacklinProductDetailsResponse(validResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isMacklinProductDetailsResponse(null)).toBe(false);
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
        expect(isMacklinProductDetailsResponse(value)).toBe(false);
      });
    });

    it("should return false for objects missing list property", () => {
      const noList = {};
      expect(isMacklinProductDetailsResponse(noList)).toBe(false);
    });

    it("should return false for objects with non-array list", () => {
      const invalidList = {
        list: "not an array", // Should be array
      };
      expect(isMacklinProductDetailsResponse(invalidList)).toBe(false);
    });

    it("should return false for objects with null list", () => {
      const nullList = {
        list: null,
      };
      expect(isMacklinProductDetailsResponse(nullList)).toBe(false);
    });

    it("should return false for objects with invalid items in list", () => {
      const invalidItems = {
        list: [
          {
            // Invalid product details
            item_id: "123", // Should be number
          },
        ],
      };
      expect(isMacklinProductDetailsResponse(invalidItems)).toBe(false);
    });
  });

  describe("isMacklinProductDetails", () => {
    const validProductDetails = {
      item_id: 123,
      item_code: "ABC123",
      product_id: 456,
      product_code: "PROD456",
      product_price: "29.99",
      product_unit: "g",
      product_locked_stock: "0",
      product_pack: "500",
      item_en_name: "Sodium Chloride",
      product_stock: "100",
      chem_cas: "7647-14-5",
      delivery_desc_show: "In stock",
    };

    it("should return true for valid product details", () => {
      expect(isMacklinProductDetails(validProductDetails)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isMacklinProductDetails(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      const nonObjectValues = [
        "not an object",
        123,
        true,
        false,
        undefined,
        () => {},
        Symbol("productDetails"),
        [],
      ];

      nonObjectValues.forEach((value) => {
        expect(isMacklinProductDetails(value)).toBe(false);
      });
    });

    it("should return false for objects missing required properties", () => {
      const missingProps = [
        {
          // Missing item_id
          item_code: "ABC123",
          product_id: 456,
          product_code: "PROD456",
          product_price: "29.99",
          product_unit: "g",
          product_locked_stock: "0",
          product_pack: "500",
          item_en_name: "Sodium Chloride",
          product_stock: "100",
          chem_cas: "7647-14-5",
          delivery_desc_show: "In stock",
        },
        {
          item_id: 123,
          // Missing item_code
          product_id: 456,
          product_code: "PROD456",
          product_price: "29.99",
          product_unit: "g",
          product_locked_stock: "0",
          product_pack: "500",
          item_en_name: "Sodium Chloride",
          product_stock: "100",
          chem_cas: "7647-14-5",
          delivery_desc_show: "In stock",
        },
        // ... and so on for each required property
      ];

      missingProps.forEach((details) => {
        expect(isMacklinProductDetails(details)).toBe(false);
      });
    });

    it("should return false for objects with wrong property types", () => {
      const wrongTypes = [
        {
          ...validProductDetails,
          item_id: "123", // Should be number
        },
        {
          ...validProductDetails,
          item_code: 123, // Should be string
        },
        {
          ...validProductDetails,
          product_id: "456", // Should be number
        },
        // ... and so on for each property
      ];

      wrongTypes.forEach((details) => {
        expect(isMacklinProductDetails(details)).toBe(false);
      });
    });

    it("should return false for objects with null or undefined property values", () => {
      const nullProps = [
        {
          ...validProductDetails,
          item_id: null,
        },
        {
          ...validProductDetails,
          item_code: undefined,
        },
        // ... and so on for each property
      ];

      nullProps.forEach((details) => {
        expect(isMacklinProductDetails(details)).toBe(false);
      });
    });
  });
});
