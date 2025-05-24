/* eslint-disable @typescript-eslint/naming-convention */
import { type ItemListing, type SearchResponse } from "@/types/shopify";
import SupplierBaseShopify from "../supplierBaseShopify";

// Mock implementation of SupplierBaseShopify for testing
class MockShopifySupplier extends SupplierBaseShopify {
  public readonly supplierName = "Mock Shopify Supplier";
  protected _baseURL = "https://mock-shopify-supplier.com";
  protected _apiKey = "test-api-key";
}

describe("SupplierBaseShopify", () => {
  let mockSupplier: MockShopifySupplier;
  let mockAbortController: AbortController;

  beforeEach(() => {
    global.fetch = jest.fn();
    mockAbortController = new AbortController();
    mockSupplier = new MockShopifySupplier("test", 5, mockAbortController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("_isValidSearchResponse", () => {
    it("should return true for valid Shopify search response", () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const validResponse: SearchResponse = {
        totalItems: 2,
        startIndex: 0,
        itemsPerPage: 10,
        currentItemCount: 2,
        items: [
          {
            title: "Test Product 1",
            price: "10.99",
            link: "/product-1",
            product_id: "1",
            product_code: "SKU1",
            shopify_variants: [],
            description: "Test Description 1",
            vendor: "Test Vendor",
            quantity: "1",
            original_product_id: "1",
            list_price: "12.99",
            image_link: "test1.jpg",
            discount: "15%",
            add_to_cart_id: "1",
            total_reviews: "0",
            reviews_average_score: "0",
            shopify_images: ["test1.jpg"],
            tags: "chemical",
          },
          {
            title: "Test Product 2",
            price: "20.99",
            link: "/product-2",
            product_id: "2",
            product_code: "SKU2",
            shopify_variants: [],
            description: "Test Description 2",
            vendor: "Test Vendor",
            quantity: "1",
            original_product_id: "2",
            list_price: "22.99",
            image_link: "test2.jpg",
            discount: "15%",
            add_to_cart_id: "2",
            total_reviews: "0",
            reviews_average_score: "0",
            shopify_images: ["test2.jpg"],
            tags: "chemical",
          },
        ],
        categoryStartIndex: 0,
        totalCategories: 0,
        pageStartIndex: 0,
        totalPages: 0,
        suggestions: [],
        categories: [],
        pages: [],
      };

      expect(mockSupplier["_isValidSearchResponse"](validResponse)).toBe(true);
    });

    it("should return false for invalid response", () => {
      const invalidResponse = {
        items: [],
      };

      expect(mockSupplier["_isValidSearchResponse"](invalidResponse)).toBe(false);
    });

    it("should return false for null response", () => {
      expect(mockSupplier["_isValidSearchResponse"](null)).toBe(false);
    });
  });

  describe("_queryProducts", () => {
    it("should return products from valid API response", async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const mockItems: ItemListing[] = [
        {
          title: "Test Product 1",
          price: "10.99",
          link: "/product-1",
          product_id: "1",
          product_code: "SKU1",
          shopify_variants: [],
          description: "Test Description 1",
          vendor: "Test Vendor",
          quantity: "1",
          original_product_id: "1",
          list_price: "12.99",
          image_link: "test1.jpg",
          discount: "15%",
          add_to_cart_id: "1",
          total_reviews: "0",
          reviews_average_score: "0",
          shopify_images: ["test1.jpg"],
          tags: "chemical",
        },
        {
          title: "Test Product 2",
          price: "20.99",
          link: "/product-2",
          product_id: "2",
          product_code: "SKU2",
          shopify_variants: [],
          description: "Test Description 2",
          vendor: "Test Vendor",
          quantity: "1",
          original_product_id: "2",
          list_price: "22.99",
          image_link: "test2.jpg",
          discount: "15%",
          add_to_cart_id: "2",
          total_reviews: "0",
          reviews_average_score: "0",
          shopify_images: ["test2.jpg"],
          tags: "chemical",
        },
      ];

      const mockResponse: SearchResponse = {
        totalItems: mockItems.length,
        startIndex: 0,
        itemsPerPage: 10,
        currentItemCount: mockItems.length,
        items: mockItems,
        categoryStartIndex: 0,
        totalCategories: 0,
        pageStartIndex: 0,
        totalPages: 0,
        suggestions: [],
        categories: [],
        pages: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          headers: { "content-type": "application/json" },
        }),
      );

      const products = await mockSupplier["_queryProducts"]("test");
      expect(products).toEqual(mockItems);

      // Verify the API call parameters
      const request = (global.fetch as jest.Mock).mock.calls[0][0] as Request;
      expect(request.url).toMatch(/^https:\/\/searchserverapi\.com\/getresults\?/);
      expect(request.url).toMatch(/api_key=test-api-key/);
      expect(request.url).toMatch(/q=test/);
      expect(request.url).toMatch(/maxResults=10/); // Using the limit from constructor
    });

    it("should throw error for invalid API response", async () => {
      const invalidResponse = {
        totalItems: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(invalidResponse), {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          headers: { "content-type": "application/json" },
        }),
      );

      await expect(mockSupplier["_queryProducts"]("test")).rejects.toThrow(
        "Invalid search response",
      );
    });
  });

  describe("_getProductData", () => {
    it("should return undefined for product without price", async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const product: ItemListing = {
        title: "Test Product",
        price: "",
        link: "/test-product",
        product_id: "1",
        product_code: "SKU1",
        shopify_variants: [],
        description: "Test Description",
        vendor: "Test Vendor",
        quantity: "1",
        original_product_id: "1",
        list_price: "12.99",
        image_link: "test.jpg",
        discount: "15%",
        add_to_cart_id: "1",
        total_reviews: "0",
        reviews_average_score: "0",
        shopify_images: ["test.jpg"],
        tags: "chemical",
      };

      const result = await mockSupplier["_getProductData"](product);
      expect(result).toBeUndefined();
    });

    it("should process product with variants and quantity in SKU", async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const product: ItemListing = {
        title: "Test Product",
        price: "10.99",
        link: "/test-product",
        product_id: "1",
        product_code: "100g",
        shopify_variants: [
          {
            sku: "100g",
            price: 10.99,
            link: "/test-product?variant=1",
            variant_id: "1",
            quantity_total: "100",
            options: {
              Model: "100g",
            },
            barcode: "",
            list_price: "12.99",
            taxable: "true",
            available: "true",
            search_variant_metafields_data: [],
            filter_variant_metafields_data: [],
            image_link: "test.jpg",
            image_alt: "Test Product 100g",
          },
          {
            sku: "250g",
            price: 24.99,
            link: "/test-product?variant=2",
            variant_id: "2",
            quantity_total: "250",
            options: {
              Model: "250g",
            },
            barcode: "",
            list_price: "27.99",
            taxable: "true",
            available: "true",
            search_variant_metafields_data: [],
            filter_variant_metafields_data: [],
            image_link: "test.jpg",
            image_alt: "Test Product 250g",
          },
        ],
        description: "Test Description",
        vendor: "Test Vendor",
        quantity: "100g",
        original_product_id: "1",
        list_price: "12.99",
        image_link: "test.jpg",
        discount: "15%",
        add_to_cart_id: "1",
        total_reviews: "0",
        reviews_average_score: "0",
        shopify_images: ["test.jpg"],
        tags: "chemical",
      };

      const result = await mockSupplier["_getProductData"](product);

      expect(result).toBeDefined();
      if (result) {
        expect(result.title).toBe("Test Product");
        expect(result.price).toBe(10.99);
        expect(result.description).toBe("Test Description");
        expect(result.url).toBe("https://mock-shopify-supplier.com/test-product");
        expect(result.quantity).toBe(100);
        expect(result.uom).toBe("g");
        expect(Array.isArray(result.variants)).toBe(true);
        expect(result.variants).toHaveLength(2);
        expect(result.variants?.[0]).toEqual(
          expect.objectContaining({
            quantity: 100,
            uom: "g",
            price: 10.99,
          }),
        );
      }
    });

    it("should process product with quantity in title", async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const product: ItemListing = {
        title: "Test Product 500mg",
        price: "10.99",
        link: "/test-product",
        product_id: "1",
        product_code: "SKU1",
        shopify_variants: [],
        description: "Test Description",
        vendor: "Test Vendor",
        quantity: "",
        original_product_id: "1",
        list_price: "12.99",
        image_link: "test.jpg",
        discount: "15%",
        add_to_cart_id: "1",
        total_reviews: "0",
        reviews_average_score: "0",
        shopify_images: ["test.jpg"],
        tags: "chemical",
      };

      const result = await mockSupplier["_getProductData"](product);

      expect(result).toBeDefined();
      if (result) {
        expect(result.title).toBe("Test Product 500mg");
        expect(result.quantity).toBe(500);
        expect(result.uom).toBe("mg");
      }
    });

    it("should process product with quantity in description", async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const product: ItemListing = {
        title: "Test Product",
        price: "10.99",
        link: "/test-product",
        product_id: "1",
        product_code: "SKU1",
        shopify_variants: [],
        description: "High quality chemical, 250mL bottle",
        vendor: "Test Vendor",
        quantity: "",
        original_product_id: "1",
        list_price: "12.99",
        image_link: "test.jpg",
        discount: "15%",
        add_to_cart_id: "1",
        total_reviews: "0",
        reviews_average_score: "0",
        shopify_images: ["test.jpg"],
        tags: "chemical",
      };

      const result = await mockSupplier["_getProductData"](product);

      expect(result).toBeDefined();
      if (result) {
        expect(result.quantity).toBe(250);
        expect(result.uom).toBe("ml");
      }
    });
  });
});
