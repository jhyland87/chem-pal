/* eslint-disable @typescript-eslint/naming-convention */
import { type ProductObject, type SearchResponse } from "@/types/chemsavers";
import SupplierChemsavers from "../supplierChemsavers";

// Mock product data
const validProductObject: ProductObject = {
  CAS: "7647-14-5",
  calculatedPrice: 29.99,
  categories: ["Chemicals", "Salts"],
  description: "High purity sodium chloride",
  hasOptions: false,
  id: "12345",
  images: ["image1.jpg", "image2.jpg"],
  inventoryLevel: 100,
  inventoryTracking: "product",
  mapPrice: 34.99,
  metaDescription: "Pure NaCl for laboratory use",
  metaKeywords: ["sodium chloride", "NaCl", "salt"],
  name: "Sodium Chloride 500g",
  price: 29.99,
  product_id: 12345,
  retailPrice: 39.99,
  salePrice: 29.99,
  sku: "NACL-500G",
  sortOrder: 1,
  upc: "123456789012",
  url: "/products/sodium-chloride-500g",
};

// Mock search response
const validSearchResponse: SearchResponse = {
  results: [
    {
      fascet_counts: [],
      found: 1,
      hits: [[{ document: validProductObject }]],
      out_of: 1000,
      page: 1,
      request_params: {
        collection_name: "products",
        first_q: "sodium chloride",
        per_page: 10,
        q: "sodium chloride",
      },
    },
  ],
};

// Mock the API key and host
jest.mock("../supplierChemsavers", () => {
  const originalModule = jest.requireActual("../supplierChemsavers");
  return {
    __esModule: true,
    default: class extends originalModule.default {
      protected _apiKey = "test-api-key";
      protected _apiURL = "test-api-host.com";
    },
  };
});

describe("SupplierChemsavers", () => {
  let supplier: SupplierChemsavers;
  let mockAbortController: AbortController;

  beforeEach(() => {
    global.fetch = jest.fn();
    mockAbortController = new AbortController();
    supplier = new SupplierChemsavers("test", 5, mockAbortController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("_isValidSearchResponseItem", () => {
    it("should validate a correct product object", () => {
      expect(supplier["_isValidSearchResponseItem"]({ document: validProductObject })).toBe(true);
    });

    it("should reject null", () => {
      expect(supplier["_isValidSearchResponseItem"](null)).toBe(false);
    });

    it("should reject missing document property", () => {
      expect(supplier["_isValidSearchResponseItem"]({ other: "data" })).toBe(false);
    });

    it("should reject invalid document type", () => {
      expect(supplier["_isValidSearchResponseItem"]({ document: "not an object" })).toBe(false);
    });

    it("should reject missing required properties", () => {
      const invalidProduct = { ...validProductObject };
      delete (invalidProduct as Record<string, unknown>).CAS;
      expect(supplier["_isValidSearchResponseItem"]({ document: invalidProduct })).toBe(false);
    });

    it("should reject wrong property types", () => {
      const invalidProduct = {
        ...validProductObject,
        inventoryLevel: "100", // Should be number
      };
      expect(supplier["_isValidSearchResponseItem"]({ document: invalidProduct })).toBe(false);
    });
  });

  describe("_isValidSearchResponse", () => {
    it("should validate a correct search response", () => {
      expect(supplier["_isValidSearchResponse"](validSearchResponse)).toBe(true);
    });

    it("should reject null", () => {
      expect(supplier["_isValidSearchResponse"](null)).toBe(false);
    });

    it("should reject missing results property", () => {
      expect(supplier["_isValidSearchResponse"]({ other: "data" })).toBe(false);
    });

    it("should reject empty results array", () => {
      expect(supplier["_isValidSearchResponse"]({ results: [] })).toBe(false);
    });

    it("should reject missing hits property", () => {
      const invalidResponse = {
        results: [{ found: 1, page: 1 }],
      };
      expect(supplier["_isValidSearchResponse"](invalidResponse)).toBe(false);
    });

    it("should reject invalid product objects in hits", () => {
      const invalidResponse = {
        ...validSearchResponse,
        results: [
          {
            ...validSearchResponse.results[0],
            hits: [[{ document: { invalid: "data" } }]],
          },
        ],
      };
      expect(supplier["_isValidSearchResponse"](invalidResponse)).toBe(false);
    });

    it("should handle errors gracefully", () => {
      const malformedResponse = {
        results: [{ hits: [undefined] }],
      };
      expect(supplier["_isValidSearchResponse"](malformedResponse)).toBe(false);
    });
  });

  describe("_queryProducts", () => {
    it("should handle successful search", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(validSearchResponse), {
          headers: { "content-type": "application/json" },
        }),
      );

      const results = await supplier["_queryProducts"]("sodium chloride");
      expect(results).toHaveLength(1);
      expect(results?.[0]).toEqual(validProductObject);

      // Verify the API call
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const request = (global.fetch as jest.Mock).mock.calls[0][0] as Request;
      expect(request.url).toContain("test-api-host.com/multi_search");
      expect(request.url).toContain("x-typesense-api-key=test-api-key");
      expect(request.method).toBe("POST");
    });

    it("should handle invalid response", async () => {
      const invalidResponse = { error: "Invalid response" };
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(invalidResponse), {
          headers: { "content-type": "application/json" },
        }),
      );

      const results = await supplier["_queryProducts"]("test");
      expect(results).toBeUndefined();
    });

    it("should handle network error", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Server Error" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );

      const results = await supplier["_queryProducts"]("test");
      expect(results).toBeUndefined();
    });

    it("should handle fetch rejection", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const results = await supplier["_queryProducts"]("test");
      expect(results).toBeUndefined();
    });
  });

  describe("_getProductData", () => {
    it("should transform a valid product object", async () => {
      const result = await supplier["_getProductData"](validProductObject);
      expect(result).toEqual({
        title: "Sodium Chloride 500g",
        supplier: supplier.supplierName,
        cas: "7647-14-5",
        price: 29.99,
        currencySymbol: "$",
        currencyCode: "USD",
        description: "High purity sodium chloride",
        url: "/products/sodium-chloride-500g",
        id: "12345",
        sku: "NACL-500G",
        quantity: 500,
        uom: "g",
      });
    });

    it("should handle missing quantity information", async () => {
      const productWithoutQuantity = {
        ...validProductObject,
        name: "Sodium Chloride", // No quantity info
      };
      const result = await supplier["_getProductData"](productWithoutQuantity);
      expect(result).toBeUndefined();
    });

    it("should handle invalid CAS number", async () => {
      const productWithInvalidCAS = {
        ...validProductObject,
        CAS: "invalid-cas",
      };
      const result = await supplier["_getProductData"](productWithInvalidCAS);
      expect(result?.cas).toBeUndefined();
    });
  });

  describe("_makeRequestBody", () => {
    it("should create correct request body", () => {
      const body = supplier["_makeRequestBody"]("test query", 10);
      expect(body).toEqual({
        searches: [
          {
            query_by: "name, CAS, sku",
            highlight_full_fields: "name, CAS, sku",
            collection: "products",
            q: "test query",
            page: 0,
            per_page: 10,
          },
        ],
      });
    });

    it("should use default limit if not provided", () => {
      const body = supplier["_makeRequestBody"]("test query");
      expect(body).toEqual({
        searches: [
          {
            query_by: "name, CAS, sku",
            highlight_full_fields: "name, CAS, sku",
            collection: "products",
            q: "test query",
            page: 0,
            per_page: 5, // Default limit from constructor
          },
        ],
      });
    });
  });
});
