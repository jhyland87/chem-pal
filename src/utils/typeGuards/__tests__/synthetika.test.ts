import { describe, expect, it } from "vitest";
import {
  assertIsSynthetikaProductPrice,
  assertIsSynthetikaSearchResponse,
  isSynthetikaProduct,
  isSynthetikaProductPrice,
  isSynthetikaSearchResponse,
} from "../synthetika";

describe("Synthetika Type Guards", () => {
  describe("isSynthetikaSearchResponse", () => {
    it("should return true for valid SynthetikaSearchResponse", () => {
      const validResponse = {
        count: 10,
        pages: 2,
        page: 1,
        list: [],
      };

      expect(isSynthetikaSearchResponse(validResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSynthetikaSearchResponse(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isSynthetikaSearchResponse(undefined)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isSynthetikaSearchResponse("not an object")).toBe(false);
    });

    it("should return false when missing required fields", () => {
      const invalidResponse = {
        count: 10,
        pages: 2,
        // missing page and list
      };

      expect(isSynthetikaSearchResponse(invalidResponse)).toBe(false);
    });

    it("should return false when fields have wrong types", () => {
      const invalidResponse = {
        count: "10", // should be number
        pages: 2,
        page: 1,
        list: "not an array", // should be array
      };

      expect(isSynthetikaSearchResponse(invalidResponse)).toBe(false);
    });
  });

  describe("assertIsSynthetikaSearchResponse", () => {
    it("should not throw for valid SynthetikaSearchResponse", () => {
      const validResponse = {
        count: 10,
        pages: 2,
        page: 1,
        list: [],
      };

      expect(() => assertIsSynthetikaSearchResponse(validResponse)).not.toThrow();
    });

    it("should throw for null", () => {
      expect(() => assertIsSynthetikaSearchResponse(null)).toThrow();
    });

    it("should throw for undefined", () => {
      expect(() => assertIsSynthetikaSearchResponse(undefined)).toThrow();
    });

    it("should throw for non-object", () => {
      expect(() => assertIsSynthetikaSearchResponse("not an object")).toThrow();
    });

    it("should throw when missing required fields", () => {
      const invalidResponse = {
        count: 10,
        pages: 2,
        // missing page and list
      };

      expect(() => assertIsSynthetikaSearchResponse(invalidResponse)).toThrow();
    });
  });

  describe("isSynthetikaProduct", () => {
    it("should return true for valid SynthetikaProduct", () => {
      const validProduct = {
        id: 1,
        name: "Test Product",
        url: "https://example.com",
        category: { id: 1, name: "Test Category" },
        code: "TEST123",
        can_buy: true,
        availability: { name: "In Stock" },
        price: {
          gross: { base: "100", final: "100" },
          net: { base: "90", final: "90" },
        },
        shortDescription: "Test Description",
        producer: { id: 1, name: "Test Producer", img: "test.jpg" },
      };

      expect(isSynthetikaProduct(validProduct)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSynthetikaProduct(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isSynthetikaProduct(undefined)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isSynthetikaProduct("not an object")).toBe(false);
    });

    it("should return false when missing required fields", () => {
      const invalidProduct = {
        id: 1,
        name: "Test Product",
        // missing other required fields
      };

      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });

    it("should return false when fields have wrong types", () => {
      const invalidProduct = {
        id: "1", // should be number
        name: "Test Product",
        url: "https://example.com",
        category: { id: 1, name: "Test Category" },
        code: "TEST123",
        can_buy: "true", // should be boolean
        availability: { name: "In Stock" },
        price: {
          gross: { base: "100", final: "100" },
          net: { base: "90", final: "90" },
        },
        shortDescription: "Test Description",
        producer: { id: 1, name: "Test Producer", img: "test.jpg" },
      };

      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });
  });

  describe("isSynthetikaProductPrice", () => {
    it("should return true for valid SynthetikaProductPrice", () => {
      const validPrice = {
        base: "100",
        final: "100",
      };

      expect(isSynthetikaProductPrice(validPrice)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSynthetikaProductPrice(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isSynthetikaProductPrice(undefined)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isSynthetikaProductPrice("not an object")).toBe(false);
    });

    it("should return false when missing required fields", () => {
      const invalidPrice = {
        base: "100",
        // missing final
      };

      expect(isSynthetikaProductPrice(invalidPrice)).toBe(false);
    });
  });

  describe("assertIsSynthetikaProductPrice", () => {
    it("should not throw for valid SynthetikaProductPrice", () => {
      const validPrice = {
        base: "100",
        final: "100",
      };

      expect(() => assertIsSynthetikaProductPrice(validPrice)).not.toThrow();
    });

    it("should throw for null", () => {
      expect(() => assertIsSynthetikaProductPrice(null)).toThrow();
    });

    it("should throw for undefined", () => {
      expect(() => assertIsSynthetikaProductPrice(undefined)).toThrow();
    });

    it("should throw for non-object", () => {
      expect(() => assertIsSynthetikaProductPrice("not an object")).toThrow();
    });

    it("should throw when missing required fields", () => {
      const invalidPrice = {
        base: "100",
        // missing final
      };

      expect(() => assertIsSynthetikaProductPrice(invalidPrice)).toThrow();
    });
  });
});
