import { UOM } from "@/constants/common";
import { describe, expect, it } from "vitest";
import {
  isHtmlResponse,
  isHttpResponse,
  isJsonResponse,
  isMinimalProduct,
  isProduct,
  isUOM,
  isValidResult,
} from "../common";

describe("Common TypeGuards", () => {
  describe("isHttpResponse", () => {
    it("should return true for a valid Response object", () => {
      const response = new Response('{"data": "test"}', {
        headers: { "Content-Type": "application/json" },
      });
      expect(isHttpResponse(response)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isHttpResponse(null)).toBe(false);
    });

    it("should return false for an object missing required Response properties", () => {
      const invalidResponse = { status: 200, ok: true };
      expect(isHttpResponse(invalidResponse)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isHttpResponse("not a response")).toBe(false);
      expect(isHttpResponse(123)).toBe(false);
      expect(isHttpResponse(undefined)).toBe(false);
    });
  });

  describe("isUOM", () => {
    it("should return true for valid UOM values", () => {
      Object.values(UOM).forEach((uom) => {
        expect(isUOM(uom)).toBe(true);
      });
    });

    it("should return false for invalid UOM values", () => {
      expect(isUOM("invalid_uom")).toBe(false);
      expect(isUOM(123)).toBe(false);
      expect(isUOM(null)).toBe(false);
      expect(isUOM(undefined)).toBe(false);
    });
  });

  describe("isJsonResponse", () => {
    it("should return true for JSON responses", () => {
      const jsonResponse = new Response('{"data": "test"}', {
        headers: { "Content-Type": "application/json" },
      });
      expect(isJsonResponse(jsonResponse)).toBe(true);

      const jsResponse = new Response('{"data": "test"}', {
        headers: { "Content-Type": "application/javascript" },
      });
      expect(isJsonResponse(jsResponse)).toBe(true);
    });

    it("should return false for non-JSON responses", () => {
      const htmlResponse = new Response("<html></html>", {
        headers: { "Content-Type": "text/html" },
      });
      expect(isJsonResponse(htmlResponse)).toBe(false);
    });

    it("should return false for invalid Response objects", () => {
      expect(isJsonResponse({ status: 200 })).toBe(false);
      expect(isJsonResponse(null)).toBe(false);
    });
  });

  describe("isHtmlResponse", () => {
    it("should return true for HTML responses", () => {
      const htmlResponse = new Response("<html></html>", {
        headers: { "Content-Type": "text/html" },
      });
      expect(isHtmlResponse(htmlResponse)).toBe(true);

      const xhtmlResponse = new Response("<html></html>", {
        headers: { "Content-Type": "application/xhtml+xml" },
      });
      expect(isHtmlResponse(xhtmlResponse)).toBe(true);
    });

    it("should return false for non-HTML responses", () => {
      const jsonResponse = new Response('{"data": "test"}', {
        headers: { "Content-Type": "application/json" },
      });
      expect(isHtmlResponse(jsonResponse)).toBe(false);
    });

    it("should return false for invalid Response objects", () => {
      expect(isHtmlResponse({ status: 200 })).toBe(false);
      expect(isHtmlResponse(null)).toBe(false);
    });
  });

  describe("isValidResult", () => {
    const validResult: RequiredProductFields = {
      title: "Test Product",
      price: 29.99,
      quantity: 500,
      uom: "g",
      supplier: "Test Supplier",
      url: "https://example.com/product",
      currencyCode: "USD",
      currencySymbol: "$",
    };

    it("should return true for valid result objects", () => {
      expect(isValidResult(validResult)).toBe(true);
    });

    it("should return false for objects missing required fields", () => {
      const { title, ...incompleteResult } = validResult;
      expect(isValidResult(incompleteResult)).toBe(false);
    });

    it("should return false for objects with wrong field types", () => {
      const invalidResult = {
        ...validResult,
        price: "29.99", // string instead of number
      };
      expect(isValidResult(invalidResult)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isValidResult(null)).toBe(false);
      expect(isValidResult(undefined)).toBe(false);
      expect(isValidResult("not an object")).toBe(false);
    });
  });

  describe("isMinimalProduct", () => {
    const minimalProduct: RequiredProductFields = {
      title: "Test Product",
      price: 29.99,
      quantity: 500,
      uom: "g",
      supplier: "Test Supplier",
      url: "https://example.com/product",
      currencyCode: "USD",
      currencySymbol: "$",
    };

    it("should return true for valid minimal product objects", () => {
      expect(isMinimalProduct(minimalProduct)).toBe(true);
    });

    it("should return false for objects missing required fields", () => {
      const { title, ...incompleteProduct } = minimalProduct;
      expect(isMinimalProduct(incompleteProduct)).toBe(false);
    });

    it("should return false for objects with wrong field types", () => {
      const invalidProduct = {
        ...minimalProduct,
        price: "29.99", // string instead of number
      };
      expect(isMinimalProduct(invalidProduct)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isMinimalProduct(null)).toBe(false);
      expect(isMinimalProduct(undefined)).toBe(false);
      expect(isMinimalProduct("not an object")).toBe(false);
    });
  });

  describe("isProduct", () => {
    const validProduct: Product = {
      supplier: "Test Supplier",
      title: "Test Product",
      url: "https://example.com/product",
      price: 29.99,
      currencyCode: "USD",
      currencySymbol: "$",
      quantity: 500,
      uom: "g",
      description: "Test description",
      manufacturer: "Test Manufacturer",
      cas: "123-45-6",
      formula: "H2O",
      vendor: "Test Vendor",
      variants: [],
      docLinks: ["https://example.com/msds.pdf"],
      supplierCountry: "US",
      supplierShipping: "worldwide",
    };

    it("should return true for valid product objects", () => {
      expect(isProduct(validProduct)).toBe(true);
    });

    it("should return false for objects missing required fields", () => {
      const { title, ...incompleteProduct } = validProduct;
      expect(isProduct(incompleteProduct)).toBe(false);
    });

    it("should return false for objects with wrong field types", () => {
      const invalidProduct = {
        ...validProduct,
        price: "29.99", // string instead of number
      };
      expect(isProduct(invalidProduct)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isProduct(null)).toBe(false);
      expect(isProduct(undefined)).toBe(false);
      expect(isProduct("not an object")).toBe(false);
    });
  });
});
