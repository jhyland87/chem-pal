/* eslint-disable @typescript-eslint/naming-convention */
import { type Product } from "@/types";
import SupplierLoudwolf from "../supplierLoudwolf";

describe("SupplierLoudwolf", () => {
  let supplier: SupplierLoudwolf;
  let mockAbortController: AbortController;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    mockAbortController = new AbortController();
    supplier = new SupplierLoudwolf("test query", 5, mockAbortController);
    global.fetch = jest.fn();

    // Save original localStorage
    originalLocalStorage = global.localStorage;

    // Create a minimal mock for localStorage
    Object.defineProperty(global, "localStorage", {
      value: {
        setItem: jest.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore original localStorage
    Object.defineProperty(global, "localStorage", {
      value: originalLocalStorage,
      writable: true,
    });
  });

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      expect(supplier.supplierName).toBe("Loudwolf");
      expect(supplier["_baseURL"]).toBe("https://www.loudwolf.com/");
      expect(supplier["_limit"]).toBe(15);
    });
  });

  describe("_queryProducts", () => {
    const mockSearchHtml = `
      <div class="product-layout product-list">
        <div class="caption">
          <h4><a href="/storefront/index.php?route=product/product&product_id=123">Test Chemical</a></h4>
          <p class="price">$29.99</p>
          <p>Product description here</p>
        </div>
      </div>
    `;

    it("should parse search results correctly", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(mockSearchHtml, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );

      const results = await supplier["_queryProducts"]("test");
      expect(results).toBeDefined();
      expect(results?.length).toBe(1);
      expect(results?.[0]).toMatchObject({
        title: "Test Chemical",
        price: 29.99,
        currencyCode: "USD",
        currencySymbol: "$",
        url: "/storefront/index.php?route=product/product&product_id=123",
        id: "123",
      });
    });

    it("should handle empty search results", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response("<div></div>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );

      const results = await supplier["_queryProducts"]("test");
      expect(results).toBeDefined();
      expect(results?.length).toBe(0);
    });

    it("should set display mode in localStorage", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(mockSearchHtml, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );

      await supplier["_queryProducts"]("test");
      expect(localStorage.setItem).toHaveBeenCalledWith("display", "list");
    });
  });

  describe("_getProductData", () => {
    const mockProductHtml = `
      <div id="content">
        <div id="tab-description">
          <div>
            <table class="MsoTableGrid">
              <tbody>
                <tr>
                  <td>
                    <p>CAS</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p>7647-14-5</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p>TOTAL WEIGHT OF PRODUCT</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p>500g</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p>GRADE</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p>ACS</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const partialProduct = {
      title: "Test Chemical",
      url: "/storefront/index.php?route=product/product&product_id=123",
      price: 29.99,
      currencyCode: "USD",
      currencySymbol: "$",
      id: "123",
    };

    it("should parse product details correctly", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(mockProductHtml, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );

      const result = await supplier["_getProductData"](partialProduct);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        ...partialProduct,
        cas: "7647-14-5",
        quantity: 500,
        uom: "g",
        grade: "ACS",
        supplier: "Loudwolf",
      });
    });

    it("should handle missing product URL", async () => {
      const invalidProduct = { title: "Test" };
      const result = await supplier["_getProductData"](invalidProduct);
      expect(result).toBeUndefined();
    });

    it("should handle missing product title", async () => {
      const invalidProduct = { url: "/product/123" };
      const result = await supplier["_getProductData"](invalidProduct);
      expect(result).toBeUndefined();
    });

    it("should handle invalid product page HTML", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response("<div>Invalid HTML</div>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );

      const result = await supplier["_getProductData"](partialProduct);
      expect(result).toMatchObject({
        ...partialProduct,
        supplier: "Loudwolf",
      });
    });
  });

  describe("product iteration", () => {
    const mockSearchHtml = `
      <div class="product-layout product-list">
        <div class="caption">
          <h4><a href="/storefront/index.php?route=product/product&product_id=123">Test Chemical</a></h4>
          <p class="price">$29.99</p>
          <p>Product description here</p>
        </div>
      </div>
    `;

    const mockProductHtml = `
      <div id="content">
        <div id="tab-description">
          <div>
            <table class="MsoTableGrid">
              <tbody>
                <tr>
                  <td>
                    <p>CAS</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p>7647-14-5</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p>TOTAL WEIGHT OF PRODUCT</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p>500g</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p>GRADE</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p>ACS</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    it("should yield complete products", async () => {
      // Mock the search results page
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(mockSearchHtml, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );

      // Mock the product detail page
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(mockProductHtml, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );

      const products: Product[] = [];
      for await (const product of supplier) {
        products.push(product);
      }

      expect(products).toHaveLength(1);
      expect(products[0]).toMatchObject({
        title: "Test Chemical",
        price: 29.99,
        quantity: 500,
        uom: "g",
        cas: "7647-14-5",
        grade: "ACS",
        supplier: "Loudwolf",
      });
    });
  });
});
