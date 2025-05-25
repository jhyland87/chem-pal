/* eslint-disable @typescript-eslint/naming-convention */
import { UOM } from "@/constants/app";
import { type Product } from "@/types";
import SupplierBase from "../supplierBase";

// Mock implementation of SupplierBase for testing
class MockSupplier extends SupplierBase<{ id: string; title: string }, Product> {
  public readonly supplierName = "Mock Supplier";
  protected _baseURL = "https://mock-supplier.com";

  protected async _queryProducts(
    query: string,
  ): Promise<Array<{ id: string; title: string }> | void> {
    return [
      { id: "1", title: "Test Product 1" },
      { id: "2", title: "Test Product 2" },
    ];
  }

  protected async _getProductData(productIndexObject: {
    id: string;
    title: string;
  }): Promise<Partial<Product> | void> {
    return {
      title: productIndexObject.title,
      price: 10.99,
      quantity: 1,
      uom: "ea" as UOM,
      url: `/products/${productIndexObject.id}`,
      currencyCode: "USD",
      currencySymbol: "$",
      supplier: this.supplierName,
    };
  }
}

describe("SupplierBase", () => {
  let mockSupplier: MockSupplier;
  let mockAbortController: AbortController;

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = jest.fn();
    mockAbortController = new AbortController();
    mockSupplier = new MockSupplier("test", 5, mockAbortController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with provided query and limit", () => {
      const supplier = new MockSupplier("test query", 10, mockAbortController);
      expect(supplier["_query"]).toBe("test query");
      expect(supplier["_limit"]).toBe(10);
    });

    it("should use default limit if not provided", () => {
      const supplier = new MockSupplier("test query", undefined, mockAbortController);
      expect(supplier["_limit"]).toBe(5);
    });
  });

  describe("_href", () => {
    it("should convert relative path to absolute URL", () => {
      const url = mockSupplier["_href"]("/products/123");
      expect(url).toBe("https://mock-supplier.com/products/123");
    });

    it("should handle absolute URLs", () => {
      const url = mockSupplier["_href"]("https://example.com/products/123");
      expect(url).toBe("https://example.com/products/123");
    });

    it("should add query parameters", () => {
      const url = mockSupplier["_href"]("/products", { page: "1", limit: "10" });
      expect(url).toBe("https://mock-supplier.com/products?page=1&limit=10");
    });

    it("should override host when provided", () => {
      const url = mockSupplier["_href"]("/products", undefined, "api.example.com");
      expect(url).toBe("https://api.example.com/products");
    });
  });

  describe("_httpGet", () => {
    it("should make GET request with correct parameters", async () => {
      const mockResponse = new Response(JSON.stringify({ data: "test" }), {
        headers: { "content-type": "application/json" },
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await mockSupplier["_httpGet"]({
        path: "/api/products",
        params: { limit: "10" },
        headers: { "Custom-Header": "value" },
      });

      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalled();

      // Get the actual request object that was passed to fetch
      const request = (global.fetch as jest.Mock).mock.calls[0][0];

      // Verify the request properties
      expect(request.url).toBe("https://mock-supplier.com/api/products?limit=10");
      expect(request.method).toBe("GET");
      expect(request.headers.get("Custom-Header")).toBe("value");
      expect(request.headers.get("accept")).toBe(
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      );
      expect(request.mode).toBe("cors");
      expect(request.credentials).toBe("include");
      expect(request.referrerPolicy).toBe("no-referrer");
    });

    it("should handle request abortion", async () => {
      // Create a new AbortController for this test
      const abortController = new AbortController();
      const supplier = new MockSupplier("test", 5, abortController);

      // Mock the signal's aborted property
      Object.defineProperty(abortController.signal, "aborted", {
        get: jest.fn().mockReturnValue(true),
      });

      await supplier["_httpGet"]({ path: "/api/products" });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("_httpPost", () => {
    it("should make POST request with correct parameters", async () => {
      const mockResponse = new Response(JSON.stringify({ data: "test" }), {
        headers: { "content-type": "application/json" },
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await mockSupplier["_httpPost"]({
        path: "/api/products",
        body: { name: "test" },
        headers: { "Content-Type": "application/json" },
      });

      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalled();

      // Get the actual request object that was passed to fetch
      const request = (global.fetch as jest.Mock).mock.calls[0][0];

      // Verify the request properties
      expect(request.url).toBe("https://mock-supplier.com/api/products");
      expect(request.method).toBe("POST");
      expect(request.headers.get("Content-Type")).toBe("application/json");
      expect(request.mode).toBe("cors");
      expect(request.credentials).toBe("same-origin");
      expect(request.referrerPolicy).toBe("strict-origin-when-cross-origin");

      // Verify the body
      const bodyText = await request.text();
      expect(bodyText).toBe('{"name":"test"}');
    });
  });

  describe("_finishProduct", () => {
    it("should complete a partial product with required fields", async () => {
      const partialProduct = {
        title: "Test Product",
        supplier: "Mock Supplier",
        price: 10.99,
        quantity: 1,
        uom: "ea" as UOM,
        url: "/products/123",
        currencyCode: "USD",
        currencySymbol: "$",
      };

      const finishedProduct = await mockSupplier["_finishProduct"](partialProduct);

      expect(finishedProduct).toEqual(
        expect.objectContaining({
          title: "Test Product",
          price: 10.99,
          supplier: "Mock Supplier",
          quantity: 1,
          uom: "ea",
          url: "https://mock-supplier.com/products/123",
          currencyCode: "USD",
          currencySymbol: "$",
          usdPrice: 10.99,
          baseQuantity: 1,
        }),
      );
    });

    it("should return undefined for invalid partial product", async () => {
      const invalidProduct = {
        title: "Test Product",
        // Missing required fields
      };

      const result = await mockSupplier["_finishProduct"](invalidProduct as Product);
      expect(result).toBeUndefined();
    });
  });

  describe("async iterator", () => {
    it("should yield products from query results", async () => {
      const products: Product[] = [];
      for await (const product of mockSupplier) {
        products.push(product);
      }

      expect(products).toHaveLength(2);
      expect(products[0]).toEqual(
        expect.objectContaining({
          title: "Test Product 1",
          price: 10.99,
          quantity: 1,
          uom: "ea",
        }),
      );
    });

    it("should handle empty query results", async () => {
      // Create a new instance with mocked _queryProducts
      const emptySupplier = new (class extends MockSupplier {
        protected async _queryProducts(): Promise<Array<{ id: string; title: string }> | void> {
          return [];
        }
      })("test", 5, mockAbortController);

      const products: Product[] = [];
      for await (const product of emptySupplier) {
        products.push(product);
      }

      expect(products).toHaveLength(0);
    });
  });
});
