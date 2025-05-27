/* eslint-disable @typescript-eslint/naming-convention */
import { UOM } from "@/constants/app";
import { ProductBuilder } from "@/helpers/productBuilder";
import { mapDefined } from "@/helpers/utils";
import { type MaybeArray, type Product } from "@/types";
//import SupplierBase from "../supplierBase";
import SupplierBase from "../supplierBase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// Mock implementation of SupplierBase for testing
class MockSupplier extends SupplierBase<{ id: string; title: string }, Product> {
  public readonly supplierName = "Mock Supplier";
  protected _baseURL = "https://mock-supplier.com";

  protected async _queryProducts(
    query: string,
    limit: number,
  ): Promise<ProductBuilder<Product>[] | void> {
    // Generate more results than the limit
    const allResults = Array(20)
      .fill(null)
      .map((_, i) => ({
        id: String(i),
        title: `Test Product ${i} for ${query}`,
      }));
    // Return only up to the limit
    return this._initProductBuilders(allResults.slice(0, limit));
  }

  protected _initProductBuilders(
    products: MaybeArray<Partial<Product>>,
  ): ProductBuilder<Product>[] {
    const productsArray = Array.isArray(products) ? products : [products];
    return mapDefined(productsArray, (product) =>
      new ProductBuilder<Product>(this._baseURL).setData(product as Product),
    );
  }

  protected async _getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return product
      .setBasicInfo(product.get("title") as string, product.get("url") as string, this.supplierName)
      .setPricing(10.99, "USD", "$")
      .setQuantity(1, "ea" as UOM);
  }
}

describe("SupplierBase", () => {
  let mockSupplier: MockSupplier;
  let mockAbortController: AbortController;
  let mockQueryProducts: jest.SpyInstance;
  let mockInitProductBuilders: jest.SpyInstance;

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = jest.fn();
    mockAbortController = new AbortController();
    mockSupplier = new MockSupplier("test query", 5, mockAbortController);

    // Setup spies
    mockQueryProducts = jest.spyOn(MockSupplier.prototype, "_queryProducts" as Any);
    mockInitProductBuilders = jest.spyOn(MockSupplier.prototype, "_initProductBuilders" as Any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockQueryProducts.mockRestore();
    mockInitProductBuilders.mockRestore();
  });

  describe("_queryProducts", () => {
    it("does not get called until iteration starts", async () => {
      const supplier = new MockSupplier("test query", 10, mockAbortController);
      expect(supplier["_query"]).toBe("test query");
      expect(supplier["_limit"]).toBe(10);

      expect(mockQueryProducts).not.toHaveBeenCalled();

      for await (const result of supplier) {
        console.log(result);
      }

      expect(mockQueryProducts).toHaveBeenCalled();
    });
  });

  describe("_initProductBuilders", () => {
    it("gets called", async () => {
      const supplier = new MockSupplier("test query", 10, mockAbortController);
      expect(supplier["_query"]).toBe("test query");
      expect(supplier["_limit"]).toBe(10);

      for await (const result of supplier) {
        console.log(result);
      }

      expect(mockInitProductBuilders).toHaveBeenCalled();
    });

    it("should use default limit if not provided", () => {
      const supplier = new MockSupplier("test query", undefined, mockAbortController);
      expect(supplier["_limit"]).toBe(5);
    });
  });

  describe.skip("_href", () => {
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

  describe.skip("_httpGet", () => {
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

  describe.skip("_httpPost", () => {
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

  describe.skip("_finishProduct", () => {
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

  describe.skip("async iterator", () => {
    it("should yield products from query results", async () => {
      const supplier = new MockSupplier("test query", 2, mockAbortController); // Set limit to 2
      const products: Product[] = [];
      for await (const product of supplier) {
        products.push(product);
      }

      expect(products).toHaveLength(2);
      expect(products[0].title).toContain("Test Product 0");
      expect(products[1].title).toContain("Test Product 1");
    });

    it("should respect the limit parameter", async () => {
      const supplier = new MockSupplier("test query", 3, mockAbortController); // Set limit to 3
      const products: Product[] = [];
      for await (const product of supplier) {
        products.push(product);
      }

      expect(products).toHaveLength(3); // Should only get 3 products despite having 10 available
      expect(products.map((p) => p.title)).toEqual([
        "Test Product 0 for test query",
        "Test Product 1 for test query",
        "Test Product 2 for test query",
      ]); // Should get first 3 products
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
