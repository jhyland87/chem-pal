/* eslint-disable @typescript-eslint/naming-convention */
import type { UOM } from "@/constants/app";
import {
  type PriceObject,
  type ProductObject,
  type SearchResponse,
} from "@/types/laboratoriumdiscounter";
import SupplierLaboratoriumDiscounter from "../supplierLaboratoriumDiscounter";

// Mock currency conversion
jest.mock("@/helpers/currency", () => ({
  ...jest.requireActual("@/helpers/currency"),
  toUSD: jest.fn().mockImplementation((amount: number) => amount), // 1:1 conversion for testing
}));

// Shared test data
const validPriceObject: PriceObject = {
  price: 10.99,
  price_incl: 13.29,
  price_excl: 10.99,
  price_old: 15.99,
  price_old_incl: 19.35,
  price_old_excl: 15.99,
};

const validProductObject: ProductObject = {
  id: 1234,
  vid: 1,
  image: 1,
  brand: true,
  code: "ABC123",
  ean: "1234567890123",
  sku: "ABC-123",
  score: 4.5,
  price: validPriceObject,
  available: true,
  unit: true,
  url: "/product/abc123",
  title: "Test Product",
  fulltitle: "Test Product 100mL",
  variant: "100mL",
  description: "Test description",
  data_01: "Additional data",
};

describe("SupplierLaboratoriumDiscounter", () => {
  let supplier: SupplierLaboratoriumDiscounter;
  let mockAbortController: AbortController;

  beforeEach(() => {
    global.fetch = jest.fn();
    mockAbortController = new AbortController();
    supplier = new SupplierLaboratoriumDiscounter("test", 5, mockAbortController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("_isPriceObject", () => {
    it("should validate a correct price object", () => {
      expect(supplier["_isPriceObject"](validPriceObject)).toBe(true);
    });

    it("should reject null", () => {
      expect(supplier["_isPriceObject"](null)).toBe(false);
    });

    it("should reject missing properties", () => {
      const invalidPrice = { ...validPriceObject };
      delete (invalidPrice as Record<string, unknown>).price_incl;
      expect(supplier["_isPriceObject"](invalidPrice)).toBe(false);
    });

    it("should reject wrong property types", () => {
      const invalidPrice = {
        ...validPriceObject,
        price: "10.99", // Should be number
      };
      expect(supplier["_isPriceObject"](invalidPrice)).toBe(false);
    });
  });

  describe("_isProductObject", () => {
    it("should validate a correct product object", () => {
      expect(supplier["_isProductObject"](validProductObject)).toBe(true);
    });

    it("should reject null", () => {
      expect(supplier["_isProductObject"](null)).toBe(false);
    });

    it("should reject missing properties", () => {
      const invalidProduct = { ...validProductObject };
      delete (invalidProduct as Record<string, unknown>).sku;
      expect(supplier["_isProductObject"](invalidProduct)).toBe(false);
    });

    it("should reject invalid price object", () => {
      const invalidProduct = {
        ...validProductObject,
        price: { price: "10.99" }, // Invalid price object
      };
      expect(supplier["_isProductObject"](invalidProduct)).toBe(false);
    });

    it("should reject wrong property types", () => {
      const invalidProduct = {
        ...validProductObject,
        id: "1234", // Should be number
      };
      expect(supplier["_isProductObject"](invalidProduct)).toBe(false);
    });
  });

  describe("_makeQueryUrl", () => {
    it("should construct a valid search URL", () => {
      const url = supplier["_makeQueryUrl"]("acid");
      expect(url).toBe("https://www.laboratoriumdiscounter.nl/en/search/acid?limit=5&format=json");
    });

    it("should handle special characters in query", () => {
      const url = supplier["_makeQueryUrl"]("hydrochloric acid 37%");
      expect(url).toBe(
        "https://www.laboratoriumdiscounter.nl/en/search/hydrochloric%20acid%2037%25?limit=5&format=json",
      );
    });
  });

  describe("_isResponseOk", () => {
    const validResponse: SearchResponse = {
      page: {
        search: "test",
        session_id: "abc123",
        key: "key123",
        title: "Search Results",
        status: 200,
      },
      request: {
        url: "/search/test",
        method: "GET",
        get: {
          format: "json",
          limit: "5",
        },
        post: [],
        device: {
          platform: "desktop",
          type: "browser",
          mobile: false,
        },
        country: "NL",
      },
      collection: {
        products: {
          "1234": validProductObject,
        },
      },
    };

    it("should validate a correct response", () => {
      expect(supplier["_isResponseOk"](validResponse)).toBe(true);
    });

    it("should reject null", () => {
      expect(supplier["_isResponseOk"](null)).toBe(false);
    });

    it("should reject missing top-level properties", () => {
      const invalidResponse = { ...validResponse };
      delete (invalidResponse as Record<string, unknown>).collection;
      expect(supplier["_isResponseOk"](invalidResponse)).toBe(false);
    });

    it("should reject invalid page object", () => {
      const invalidResponse = {
        ...validResponse,
        page: { status: 200 }, // Missing required properties
      };
      expect(supplier["_isResponseOk"](invalidResponse)).toBe(false);
    });

    it("should reject invalid products", () => {
      const invalidResponse = {
        ...validResponse,
        collection: {
          products: {
            "1234": { ...validProductObject, id: "1234" }, // Invalid product (id should be number)
          },
        },
      };
      expect(supplier["_isResponseOk"](invalidResponse)).toBe(false);
    });
  });

  describe("_getProductData", () => {
    const productWithQuantity = {
      ...validProductObject,
      code: "ABC123 1L",
      fulltitle: "Test Product 1L",
      variant: "1L",
    };

    it("should transform a valid product object", async () => {
      const result = await supplier["_getProductData"](productWithQuantity);
      expect(result).toEqual({
        baseQuantity: 0.001,
        title: "Test Product",
        url: "https://www.laboratoriumdiscounter.nl/product/abc123",
        description: "Test description",
        price: 10.99,
        quantity: 1,
        supplier: supplier.supplierName,
        uom: "l" as UOM,
        currencyCode: "EUR",
        currencySymbol: "€",
        usdPrice: 10.99,
      });
    });

    it("should handle invalid product object", async () => {
      const invalidProduct = {
        ...productWithQuantity,
        id: "1234" as unknown as number, // Cast to unknown first to satisfy TypeScript
      };
      const result = await supplier["_getProductData"](invalidProduct as ProductObject);
      expect(result).toBeUndefined();
    });

    it("should handle missing quantity information", async () => {
      const productWithoutQuantity = {
        ...validProductObject,
        code: "ABC123",
        sku: "ABC-123",
        fulltitle: "Test Product",
        variant: "",
      };
      const result = await supplier["_getProductData"](productWithoutQuantity);
      expect(result).toBeUndefined();
    });
  });

  describe("_queryProducts", () => {
    it("should handle successful search response", async () => {
      const mockResponse = {
        page: {
          search: "test",
          session_id: "abc123",
          key: "key123",
          title: "Search Results",
          status: 200,
        },
        request: {
          url: "/search/test",
          method: "GET",
          get: { format: "json", limit: "5" },
          post: [],
          device: { platform: "desktop", type: "browser", mobile: false },
          country: "NL",
        },
        collection: {
          products: { "1234": validProductObject },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          headers: { "content-type": "application/json" },
        }),
      );

      const results = await supplier["_queryProducts"]("test");
      expect(results).toHaveLength(1);
      expect(results?.[0]).toEqual(validProductObject);
    });

    it("should handle invalid response", async () => {
      const mockResponse = { error: "Invalid response" };
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          headers: { "content-type": "application/json" },
        }),
      );

      const results = await supplier["_queryProducts"]("test");
      expect(results).toBeUndefined();
    });

    it("should handle network error", async () => {
      // Mock an error response with JSON content type
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Server Error" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );

      const results = await supplier["_queryProducts"]("test");
      expect(results).toBeUndefined();
    });
  });
});
