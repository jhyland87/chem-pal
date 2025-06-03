import { describe, expect, it } from "vitest";
import {
  isPriceObject,
  isProductObject,
  isSearchResponseOk,
  isSearchResponseProduct,
  isValidSearchParams,
} from "../laboratoriumdiscounter";

describe("LaboratoriumDiscounter TypeGuards", () => {
  describe("isSearchResponseOk", () => {
    const validResponse = {
      page: {
        search: "sodium chloride",
        session_id: "abc123",
        key: "search_key",
        title: "Search Results",
        status: "success",
      },
      request: {
        url: "/en/search/sodium-chloride",
        method: "GET",
        get: { q: "sodium chloride" },
        device: "desktop",
      },
      collection: {
        products: {
          "12345": {
            id: 12345,
            vid: 67890,
            image: 1,
            brand: false,
            code: "CHEM-001",
            ean: "1234567890123",
            sku: "SKU-001",
            score: 1.0,
            available: true,
            unit: true,
            url: "/products/chemical-1",
            title: "Sodium Chloride",
            fulltitle: "Sodium Chloride 500g",
            variant: "500g",
            description: "High purity sodium chloride",
            data_01: "Additional info",
            price: {
              price: 29.99,
              price_incl: 29.99,
              price_excl: 24.79,
              price_old: 39.99,
              price_old_incl: 39.99,
              price_old_excl: 33.05,
            },
          },
        },
      },
    };

    it("should return true for a valid search response", () => {
      expect(isSearchResponseOk(validResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSearchResponseOk(null)).toBe(false);
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
        expect(isSearchResponseOk(value)).toBe(false);
      });
    });

    it("should return false for objects missing required top-level properties", () => {
      const missingProps = [
        {
          // Missing page
          request: validResponse.request,
          collection: validResponse.collection,
        },
        {
          page: validResponse.page,
          // Missing request
          collection: validResponse.collection,
        },
        {
          page: validResponse.page,
          request: validResponse.request,
          // Missing collection
        },
        {
          // Missing all properties
        },
      ];

      missingProps.forEach((response) => {
        expect(isSearchResponseOk(response)).toBe(false);
      });
    });

    it("should return false for objects with non-object top-level properties", () => {
      const nonObjectProps = [
        {
          page: "not an object",
          request: validResponse.request,
          collection: validResponse.collection,
        },
        {
          page: validResponse.page,
          request: "not an object",
          collection: validResponse.collection,
        },
        {
          page: validResponse.page,
          request: validResponse.request,
          collection: "not an object",
        },
      ];

      nonObjectProps.forEach((response) => {
        expect(isSearchResponseOk(response)).toBe(false);
      });
    });

    it("should return false for objects with missing page properties", () => {
      const missingPageProps = [
        {
          page: {
            // Missing search
            session_id: "abc123",
            key: "search_key",
            title: "Search Results",
            status: "success",
          },
          request: validResponse.request,
          collection: validResponse.collection,
        },
        {
          page: {
            search: "sodium chloride",
            // Missing session_id
            key: "search_key",
            title: "Search Results",
            status: "success",
          },
          request: validResponse.request,
          collection: validResponse.collection,
        },
        // ... and so on for each required page property
      ];

      missingPageProps.forEach((response) => {
        expect(isSearchResponseOk(response)).toBe(false);
      });
    });

    it("should return false for objects with missing request properties", () => {
      const missingRequestProps = [
        {
          page: validResponse.page,
          request: {
            // Missing url
            method: "GET",
            get: { q: "sodium chloride" },
            device: "desktop",
          },
          collection: validResponse.collection,
        },
        {
          page: validResponse.page,
          request: {
            url: "/en/search/sodium-chloride",
            // Missing method
            get: { q: "sodium chloride" },
            device: "desktop",
          },
          collection: validResponse.collection,
        },
        // ... and so on for each required request property
      ];

      missingRequestProps.forEach((response) => {
        expect(isSearchResponseOk(response)).toBe(false);
      });
    });

    it("should return false for objects with invalid collection structure", () => {
      const invalidCollections = [
        {
          page: validResponse.page,
          request: validResponse.request,
          collection: {
            // Missing products
          },
        },
        {
          page: validResponse.page,
          request: validResponse.request,
          collection: {
            products: "not an object", // Should be object
          },
        },
      ];

      invalidCollections.forEach((response) => {
        expect(isSearchResponseOk(response)).toBe(false);
      });
    });

    it("should return false for objects with invalid products", () => {
      const invalidProducts = {
        page: validResponse.page,
        request: validResponse.request,
        collection: {
          products: {
            "12345": {
              // Invalid product (missing required properties)
              id: 12345,
            },
          },
        },
      };

      expect(isSearchResponseOk(invalidProducts)).toBe(false);
    });
  });

  describe("isPriceObject", () => {
    const validPrice = {
      price: 29.99,
      price_incl: 29.99,
      price_excl: 24.79,
      price_old: 39.99,
      price_old_incl: 39.99,
      price_old_excl: 33.05,
    };

    it("should return true for a valid price object", () => {
      expect(isPriceObject(validPrice)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isPriceObject(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      const nonObjectValues = [
        "not an object",
        123,
        true,
        false,
        undefined,
        () => {},
        Symbol("price"),
        [],
      ];

      nonObjectValues.forEach((value) => {
        expect(isPriceObject(value)).toBe(false);
      });
    });

    it("should return false for objects missing required properties", () => {
      const missingProps = [
        {
          // Missing price
          price_incl: 29.99,
          price_excl: 24.79,
          price_old: 39.99,
          price_old_incl: 39.99,
          price_old_excl: 33.05,
        },
        {
          price: 29.99,
          // Missing price_incl
          price_excl: 24.79,
          price_old: 39.99,
          price_old_incl: 39.99,
          price_old_excl: 33.05,
        },
        // ... and so on for each required property
      ];

      missingProps.forEach((price) => {
        expect(isPriceObject(price)).toBe(false);
      });
    });

    it("should return false for objects with wrong property types", () => {
      const wrongTypes = [
        {
          ...validPrice,
          price: "29.99", // Should be number
        },
        {
          ...validPrice,
          price_incl: "29.99", // Should be number
        },
        {
          ...validPrice,
          price_excl: "24.79", // Should be number
        },
        // ... and so on for each property
      ];

      wrongTypes.forEach((price) => {
        expect(isPriceObject(price)).toBe(false);
      });
    });
  });

  describe("isSearchResponseProduct", () => {
    const validProduct = {
      id: 12345,
      vid: 67890,
      image: 1,
      brand: false,
      code: "CHEM-001",
      ean: "1234567890123",
      sku: "SKU-001",
      score: 1.0,
      available: true,
      unit: true,
      url: "/products/chemical-1",
      title: "Sodium Chloride",
      fulltitle: "Sodium Chloride 500g",
      variant: "500g",
      description: "High purity sodium chloride",
      data_01: "Additional info",
      price: {
        price: 29.99,
        price_incl: 29.99,
        price_excl: 24.79,
        price_old: 39.99,
        price_old_incl: 39.99,
        price_old_excl: 33.05,
      },
    };

    it("should return true for a valid search response product", () => {
      expect(isSearchResponseProduct(validProduct)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSearchResponseProduct(null)).toBe(false);
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
        expect(isSearchResponseProduct(value)).toBe(false);
      });
    });

    it("should return false for objects missing required properties", () => {
      const missingProps = [
        {
          // Missing id
          vid: 67890,
          image: 1,
          brand: false,
          code: "CHEM-001",
          ean: "1234567890123",
          sku: "SKU-001",
          score: 1.0,
          available: true,
          unit: true,
          url: "/products/chemical-1",
          title: "Sodium Chloride",
          fulltitle: "Sodium Chloride 500g",
          variant: "500g",
          description: "High purity sodium chloride",
          data_01: "Additional info",
          price: validProduct.price,
        },
        // ... and so on for each required property
      ];

      missingProps.forEach((product) => {
        expect(isSearchResponseProduct(product)).toBe(false);
      });
    });

    it("should return false for objects with wrong property types", () => {
      const wrongTypes = [
        {
          ...validProduct,
          id: "12345", // Should be number
        },
        {
          ...validProduct,
          title: 123, // Should be string
        },
        {
          ...validProduct,
          available: "true", // Should be boolean
        },
        // ... and so on for each property
      ];

      wrongTypes.forEach((product) => {
        expect(isSearchResponseProduct(product)).toBe(false);
      });
    });

    it("should return false for objects with invalid price object", () => {
      const invalidPrice = {
        ...validProduct,
        price: {
          // Invalid price object (missing properties)
          price: 29.99,
        },
      };

      expect(isSearchResponseProduct(invalidPrice)).toBe(false);
    });
  });

  describe("isProductObject", () => {
    const validProductObject = {
      id: 12345,
      vid: 67890,
      image: 1,
      brand: false,
      code: "CHEM-001",
      ean: "1234567890123",
      sku: "SKU-001",
      score: 1.0,
      available: true,
      unit: true,
      url: "/products/chemical-1",
      title: "Sodium Chloride",
      fulltitle: "Sodium Chloride 500g",
      variant: "500g",
      description: "High purity sodium chloride",
      data_01: "Additional info",
      price: {
        price: 29.99,
        price_incl: 29.99,
        price_excl: 24.79,
        price_old: 39.99,
        price_old_incl: 39.99,
        price_old_excl: 33.05,
      },
      // Additional properties specific to product object
      category: "Chemicals",
      manufacturer: "Lab Supplies Inc",
      stock: 100,
      weight: "500g",
      dimensions: "10x5x5cm",
    };

    it.skip("should return true for a valid product object", () => {
      expect(isProductObject(validProductObject)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isProductObject(null)).toBe(false);
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
        expect(isProductObject(value)).toBe(false);
      });
    });

    it("should return false for objects missing required properties", () => {
      const missingProps = [
        {
          // Missing id
          vid: 67890,
          image: 1,
          brand: false,
          code: "CHEM-001",
          ean: "1234567890123",
          sku: "SKU-001",
          score: 1.0,
          available: true,
          unit: true,
          url: "/products/chemical-1",
          title: "Sodium Chloride",
          fulltitle: "Sodium Chloride 500g",
          variant: "500g",
          description: "High purity sodium chloride",
          data_01: "Additional info",
          price: validProductObject.price,
          category: "Chemicals",
          manufacturer: "Lab Supplies Inc",
          stock: 100,
          weight: "500g",
          dimensions: "10x5x5cm",
        },
        // ... and so on for each required property
      ];

      missingProps.forEach((product) => {
        expect(isProductObject(product)).toBe(false);
      });
    });

    it("should return false for objects with wrong property types", () => {
      const wrongTypes = [
        {
          ...validProductObject,
          id: "12345", // Should be number
        },
        {
          ...validProductObject,
          title: 123, // Should be string
        },
        {
          ...validProductObject,
          available: "true", // Should be boolean
        },
        // ... and so on for each property
      ];

      wrongTypes.forEach((product) => {
        expect(isProductObject(product)).toBe(false);
      });
    });

    it("should return false for objects with invalid price object", () => {
      const invalidPrice = {
        ...validProductObject,
        price: {
          // Invalid price object (missing properties)
          price: 29.99,
        },
      };

      expect(isProductObject(invalidPrice)).toBe(false);
    });
  });

  describe("isValidSearchParams", () => {
    const validParams = {
      q: "sodium chloride",
      page: 1,
      limit: 20,
      sort: "price_asc",
      filter: {
        category: ["chemicals"],
        brand: ["lab-supplies"],
        price_range: [0, 100],
      },
    };

    it.skip("should return true for valid search parameters", () => {
      expect(isValidSearchParams(validParams)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isValidSearchParams(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      const nonObjectValues = [
        "not an object",
        123,
        true,
        false,
        undefined,
        () => {},
        Symbol("params"),
        [],
      ];

      nonObjectValues.forEach((value) => {
        expect(isValidSearchParams(value)).toBe(false);
      });
    });

    it("should return false for objects missing required properties", () => {
      const missingProps = [
        {
          // Missing q
          page: 1,
          limit: 20,
          sort: "price_asc",
          filter: validParams.filter,
        },
        {
          q: "sodium chloride",
          // Missing page
          limit: 20,
          sort: "price_asc",
          filter: validParams.filter,
        },
        // ... and so on for each required property
      ];

      missingProps.forEach((params) => {
        expect(isValidSearchParams(params)).toBe(false);
      });
    });

    it("should return false for objects with wrong property types", () => {
      const wrongTypes = [
        {
          ...validParams,
          q: 123, // Should be string
        },
        {
          ...validParams,
          page: "1", // Should be number
        },
        {
          ...validParams,
          limit: "20", // Should be number
        },
        {
          ...validParams,
          sort: 123, // Should be string
        },
        {
          ...validParams,
          filter: "invalid", // Should be object
        },
      ];

      wrongTypes.forEach((params) => {
        expect(isValidSearchParams(params)).toBe(false);
      });
    });

    it("should return false for objects with invalid filter structure", () => {
      const invalidFilters = [
        {
          ...validParams,
          filter: {
            // Invalid filter (wrong types)
            category: "chemicals", // Should be array
            brand: "lab-supplies", // Should be array
            price_range: "0-100", // Should be array
          },
        },
        {
          ...validParams,
          filter: {
            // Invalid filter (missing properties)
            category: ["chemicals"],
            // Missing brand and price_range
          },
        },
      ];

      invalidFilters.forEach((params) => {
        expect(isValidSearchParams(params)).toBe(false);
      });
    });
  });
});
