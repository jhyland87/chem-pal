import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { AVAILABILITY } from "@/constants/common";
import ProductBuilder from "@/utils/ProductBuilder";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as quantityHelpers from "../quantity";

describe("ProductBuilder", () => {
  const baseURL = "https://example.com";
  let builder: ProductBuilder<Product>;

  const mockResponse = (data: unknown) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  beforeEach(() => {
    setupChromeStorageMock();

    builder = new ProductBuilder(baseURL);
    // Always resolve fetch with a default USD:USD response unless overridden in a test
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(
        mockResponse({
          status_code: 200,
          data: {
            base: "USD",
            target: "USD",
            mid: 1.0,
            unit: 1,
            timestamp: "2024-03-14T00:00:00.000Z",
          },
        }),
      ),
    );
  });

  afterEach(() => {
    resetChromeStorageMock();
    vi.resetAllMocks();
  });

  describe("setBasicInfo", () => {
    it("should set title, url, and supplier correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .build();

      expect(result).toMatchObject({
        title: "Test Product",
        url: "https://example.com/product/123",
        supplier: "Test Supplier",
      });
    });
  });

  describe("setPricing", () => {
    it("should set price and currency information correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .build();

      expect(result).toMatchObject({
        price: 29.99,
        currencyCode: "USD",
        currencySymbol: "$",
      });
    });

    it("should handle ParsedPrice object correctly", async () => {
      const parsedPrice = {
        price: 29.99,
        currencyCode: "USD",
        currencySymbol: "$",
      };

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(parsedPrice)
        .setQuantity(500, "g")
        .build();

      expect(result).toMatchObject({
        price: 29.99,
        currencyCode: "USD",
        currencySymbol: "$",
      });
    });
  });

  describe("setQuantity", () => {
    it("should set quantity and unit of measure correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .build();

      expect(result).toMatchObject({
        quantity: 500,
        uom: "g",
      });
    });
  });

  describe("setDescription", () => {
    it("should set description correctly", async () => {
      const description = "Test product description";
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setDescription(description)
        .build();

      expect(result).toMatchObject({
        description,
      });
    });
  });

  describe("setFormula", () => {
    it("should set formula correctly with valid HTML chemical formula", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setFormula("K<sub>2</sub>Cr<sub>2</sub>O<sub>7</sub>")
        .build();

      expect(result).toMatchObject({
        formula: "K₂Cr₂O₇",
      });
    });

    it("should not set formula with invalid chemical formula", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setFormula("Not a chemical formula")
        .build();

      expect(result).not.toHaveProperty("formula");
    });

    it("should handle undefined formula input", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setFormula(undefined)
        .build();

      expect(result).not.toHaveProperty("formula");
    });

    it("should handle empty string formula input", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setFormula("")
        .build();

      expect(result).not.toHaveProperty("formula");
    });
  });

  describe("setCAS", () => {
    it("should set valid CAS number", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setCAS("7647-14-5")
        .build();

      expect(result).toMatchObject({
        cas: "7647-14-5",
      });
    });

    it("should not set invalid CAS number", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setCAS("invalid-cas")
        .build();

      expect(result).not.toHaveProperty("cas");
    });
  });

  describe("setData", () => {
    it("should set multiple properties at once", async () => {
      const data = {
        title: "Bulk Data Product",
        price: 99.99,
        quantity: 1000,
        uom: "g",
      };

      const result = await builder
        .setData(data)
        .setBasicInfo("Bulk Data Product", "/product/bulk", "Test Supplier")
        .setPricing(99.99, "USD", "$")
        .setQuantity(1000, "g")
        .build();

      expect(result).toMatchObject(data);
    });
  });

  describe("setID, setUUID, and setSku", () => {
    it("should set ID correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setID(12345)
        .build();

      expect(result).toMatchObject({ id: 12345 });
    });

    it("should set UUID correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setUUID("test-uuid-123")
        .build();

      expect(result).toMatchObject({ uuid: "test-uuid-123" });
    });

    it("should set SKU correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setSku("TEST-SKU-123")
        .build();

      expect(result).toMatchObject({ sku: "TEST-SKU-123" });
    });
  });

  describe("variants", () => {
    it("should add a single variant correctly", async () => {
      const variant = {
        title: "Large Pack",
        price: 49.99,
        quantity: 1000,
        uom: "g",
        sku: "LARGE-PACK",
      };

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .addVariant(variant)
        .build();

      expect(result?.variants).toHaveLength(1);
      expect(result?.variants?.[0]).toMatchObject(variant);
    });

    it("should add multiple variants correctly", async () => {
      const variants = [
        {
          title: "Small Pack",
          price: 29.99,
          quantity: 250,
          uom: "g",
        },
        {
          title: "Large Pack",
          price: 49.99,
          quantity: 1000,
          uom: "g",
        },
      ];

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .addVariants(variants)
        .build();

      expect(result?.variants).toHaveLength(2);
      expect(result?.variants).toMatchObject(variants);
    });

    it.skip("should process variant currency conversion", async () => {
      const variant = {
        title: "Euro Pack",
        price: 39.99,
        quantity: 1000,
        uom: "g",
        url: "/variants/euro",
      };

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "EUR", "€")
        .setQuantity(500, "g")
        .addVariant(variant)
        .build();

      expect(result?.variants?.[0]).toMatchObject({
        ...variant,
        usdPrice: 34.99,
        url: "https://example.com/variants/euro",
      });
    });

    it("should filter out invalid variants", async () => {
      const validVariant = {
        title: "Valid Pack",
        price: 29.99,
        quantity: 250,
        uom: "g",
      };

      const invalidVariant = {
        title: 123, // Invalid: title should be string
        price: "49.99", // Invalid: price should be number
        quantity: "1000", // Invalid: quantity should be number
        uom: 123, // Invalid: uom should be string
      };

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .addVariants([validVariant, invalidVariant as unknown as Partial<Product>])
        .build();

      expect(result?.variants).toHaveLength(1);
      expect(result?.variants?.[0]).toMatchObject(validVariant);
    });
  });

  describe("dump", () => {
    it("should return current product state", () => {
      const data = {
        title: "Test Product",
        price: 29.99,
        quantity: 500,
        uom: "g",
      };

      builder.setData(data);
      const result = builder.dump();

      expect(result).toMatchObject(data);
    });
  });

  describe("error handling", () => {
    it("should handle invalid product data gracefully", async () => {
      const invalidData = {
        title: 123, // Invalid: title should be string
        price: "29.99", // Invalid: price should be number
      };

      const result = await builder.setData(invalidData as unknown as Partial<Product>).build();

      expect(result).toBeUndefined();
    });

    it("should handle missing required fields", async () => {
      const result = await builder
        .setData({
          title: "Test Product",
          // Missing price, quantity, uom
        })
        .build();

      expect(result).toBeUndefined();
    });

    it("should handle null values in product data", async () => {
      const nullData = {
        title: null,
        price: null,
        quantity: null,
        uom: null,
      };

      const result = await builder.setData(nullData as unknown as Partial<Product>).build();

      expect(result).toBeUndefined();
    });
  });

  describe("build", () => {
    it("should return void when missing required properties", async () => {
      const result = await builder.build();
      expect(result).toBeUndefined();
    });

    it("should build a complete product with all properties", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setDescription("Test Description")
        .setCAS("7647-14-5")
        .build();

      expect(result).toMatchObject({
        title: "Test Product",
        url: "https://example.com/product/123",
        supplier: "Test Supplier",
        price: 29.99,
        currencyCode: "USD",
        currencySymbol: "$",
        quantity: 500,
        uom: "g",
        description: "Test Description",
        cas: "7647-14-5",
        usdPrice: 29.99,
        baseQuantity: 500,
      });
    });

    it("should convert non-USD prices to USD", async () => {
      // Override the default mock for this test
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve(
          mockResponse({
            status_code: 200,
            data: {
              base: "EUR",
              target: "USD",
              mid: 1.1453,
              unit: 1,
              timestamp: "2024-03-14T00:00:00.000Z",
            },
          }),
        ),
      );

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "EUR", "€")
        .setQuantity(500, "g")
        .build();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://hexarate.paikama.co/api/rates/latest/EUR?target=USD",
      );
      expect(result).toMatchObject({
        price: 29.99,
        currencyCode: "EUR",
        usdPrice: 34.35, // 29.99 * 1.1453
      });
    });

    it("should convert quantities to base units", async () => {
      const toBaseQuantitySpy = vi.spyOn(quantityHelpers, "toBaseQuantity");

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .build();

      expect(toBaseQuantitySpy).toHaveBeenCalledWith(500, "g");
      expect(result).toMatchObject({
        quantity: 500,
        uom: "g",
        baseQuantity: 500,
      });
    });

    it("should convert relative URLs to absolute URLs", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .build();

      expect(result?.url).toBe("https://example.com/product/123");
    });

    it("should preserve absolute URLs", async () => {
      const absoluteURL = "https://other-domain.com/product/123";
      const result = await builder
        .setBasicInfo("Test Product", absoluteURL, "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .build();

      expect(result?.url).toBe(absoluteURL);
    });
  });

  describe("setCurrencySymbol and setCurrencyCode", () => {
    beforeEach(() => {
      //(global.fetch as unknown as MockInstance).mockClear();
    });

    it("should set currency symbol correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setCurrencySymbol("€")
        .build();

      expect(result).toMatchObject({
        currencySymbol: "€",
      });
    });

    it.skip("should set currency code correctly", async () => {
      // Override the default mock for this test
      /*
      (global.fetch as unknown as MockInstance).mockImplementationOnce(() =>
        Promise.resolve(
          mockResponse({
            status_code: 200,
            data: {
              base: "EUR",
              target: "USD",
              mid: 1.1453,
              unit: 1,
              timestamp: "2024-03-14T00:00:00.000Z",
            },
          }),
        ),
      );
      */
      //(global.fetch as unknown as MockInstance).mockClear();
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "EUR", "€")
        .setQuantity(500, "g")
        .setCurrencyCode("EUR")
        .build();

      expect((global.fetch as unknown as MockInstance).mock.calls[0][0]).toBe(
        "https://hexarate.paikama.co/api/rates/latest/EUR?target=USD",
      );
      expect(result).toMatchObject({
        currencyCode: "EUR",
        usdPrice: 29.99,
      });
    });

    it.skip("should handle currency conversion errors", async () => {
      // Override the default mock for this test
      //(global.fetch as any).mockImplementationOnce(() => Promise.reject(new Error("API Error")));

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "EUR", "€")
        .setQuantity(500, "g")
        .setCurrencyCode("EUR")
        .build();

      expect((global.fetch as unknown as MockInstance).mock.calls).toBe(
        "https://hexarate.paikama.co/api/rates/latest/EUR?target=USD",
      );
      expect(result).toMatchObject({
        currencyCode: "EUR",
        price: 29.99,
      });
      // usdPrice should be undefined when conversion fails
      expect(result?.usdPrice).toBeUndefined();
    });

    it("should handle invalid currency symbol", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setCurrencySymbol(123 as unknown as CurrencySymbol)
        .build();

      expect(consoleSpy).toHaveBeenCalledWith("setCurrencySymbol| Invalid currency symbol: 123");
      expect(result?.currencySymbol).toBe("$");
    });

    it("should handle invalid currency code", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setCurrencyCode(123 as unknown as CurrencyCode)
        .build();

      expect(consoleSpy).toHaveBeenCalledWith("setCurrencyCode| Invalid currency code: 123");
      expect(result?.currencyCode).toBe("USD");
    });
  });

  describe("setUOM", () => {
    it("should set UOM correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setUOM("kg")
        .build();

      expect(result).toMatchObject({
        uom: "kg",
      });
    });

    it("should not set invalid UOM", async () => {
      const loggerSpy = vi.spyOn(builder["logger"], "warn");
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setUOM("")
        .build();

      expect(loggerSpy).toHaveBeenCalledWith("Unknown UOM: ");
      expect(result?.uom).toBe("g");
    });
  });

  describe("setSupplierCountry and setSupplierShipping", () => {
    it("should set supplier country correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setSupplierCountry("US")
        .build();

      expect(result).toMatchObject({
        supplierCountry: "US",
      });
    });

    it("should set supplier shipping correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setSupplierShipping("worldwide")
        .build();

      expect(result).toMatchObject({
        supplierShipping: "worldwide",
      });
    });
  });

  describe("setVendor", () => {
    it("should set vendor correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setVendor("Test Vendor")
        .build();

      expect(result).toMatchObject({
        vendor: "Test Vendor",
      });
    });

    it("should not set vendor when undefined", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setVendor(undefined)
        .build();

      expect(result).not.toHaveProperty("vendor");
    });
  });

  describe("setVariants", () => {
    it("should replace existing variants with new ones", async () => {
      const initialVariants = [{ title: "Small Pack", price: 29.99, quantity: 250, uom: "g" }];
      const newVariants = [
        { title: "Medium Pack", price: 39.99, quantity: 500, uom: "g" },
        { title: "Large Pack", price: 49.99, quantity: 1000, uom: "g" },
      ];

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .addVariants(initialVariants)
        .setVariants(newVariants)
        .build();

      expect(result?.variants).toHaveLength(2);
      expect(result?.variants).toMatchObject(newVariants);
    });

    it("should handle empty variants array", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setVariants([])
        .build();

      expect(result?.variants).toHaveLength(0);
    });
  });

  describe("determineAvailability and setAvailability", () => {
    it("should handle AVAILABILITY enum values", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setAvailability(AVAILABILITY.IN_STOCK)
        .build();

      expect(result).toMatchObject({
        availability: AVAILABILITY.IN_STOCK,
      });
    });

    it("should handle boolean values", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setAvailability(true)
        .build();

      expect(result).toMatchObject({
        availability: AVAILABILITY.IN_STOCK,
      });

      const result2 = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setAvailability(false)
        .build();

      expect(result2).toMatchObject({
        availability: AVAILABILITY.OUT_OF_STOCK,
      });
    });

    it("should handle string values", async () => {
      const testCases = [
        { input: "instock", expected: AVAILABILITY.IN_STOCK },
        { input: "outofstock", expected: AVAILABILITY.OUT_OF_STOCK },
        { input: "preorder", expected: AVAILABILITY.PRE_ORDER },
        { input: "backorder", expected: AVAILABILITY.BACKORDER },
        { input: "discontinued", expected: AVAILABILITY.DISCONTINUED },
      ];

      for (const { input, expected } of testCases) {
        const result = await builder
          .setBasicInfo("Test Product", "/product/123", "Test Supplier")
          .setPricing(29.99, "USD", "$")
          .setQuantity(500, "g")
          .setAvailability(input)
          .build();

        expect(result).toMatchObject({
          availability: expected,
        });
      }
    });

    it("should handle invalid availability values", async () => {
      const loggerSpy = vi.spyOn(builder["logger"], "warn");
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setAvailability("invalid-status")
        .build();

      expect(loggerSpy).toHaveBeenCalledWith("Unknown availability: invalid-status");
      expect(result).not.toHaveProperty("availability");
    });
  });

  describe("addRawData", () => {
    it("should merge raw data correctly", async () => {
      const rawData1 = { customField1: "value1" };
      const rawData2 = { customField2: "value2" };

      builder.addRawData(rawData1);
      builder.addRawData(rawData2);

      expect(builder["rawData"]).toMatchObject({
        customField1: "value1",
        customField2: "value2",
      });
    });

    it("should handle undefined input", async () => {
      builder.addRawData(undefined);
      expect(builder["rawData"]).toEqual({});
    });
  });

  describe("get", () => {
    it("should return property value if it exists", () => {
      builder.setBasicInfo("Test Product", "/product/123", "Test Supplier");
      expect(builder.get("title")).toBe("Test Product");
    });

    it("should return undefined for non-existent property", () => {
      expect(builder.get("nonexistent" as keyof Product)).toBeUndefined();
    });

    it("should return undefined for unset property", () => {
      builder.setBasicInfo("Test Product", "/product/123", "Test Supplier");
      expect(builder.get("price")).toBeUndefined();
    });
  });

  describe("createFromCache", () => {
    it("should create builders from cached data", () => {
      const cachedData = [
        {
          title: "Cached Product 1",
          price: 29.99,
          quantity: 500,
          uom: "g",
        },
        {
          title: "Cached Product 2",
          price: 39.99,
          quantity: 1000,
          uom: "g",
        },
      ];

      const builders = ProductBuilder.createFromCache(baseURL, cachedData);

      expect(builders).toHaveLength(2);
      expect(builders[0].dump()).toMatchObject(cachedData[0]);
      expect(builders[1].dump()).toMatchObject(cachedData[1]);
    });

    it("should handle empty cache data", () => {
      const builders = ProductBuilder.createFromCache(baseURL, []);
      expect(builders).toHaveLength(0);
    });
  });
});
