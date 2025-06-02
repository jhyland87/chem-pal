import ProductBuilder from "@/utils/ProductBuilder";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as currencyHelpers from "../currency";
import * as quantityHelpers from "../quantity";

describe("ProductBuilder", () => {
  const baseURL = "https://example.com";
  let builder: ProductBuilder<Product>;

  beforeEach(() => {
    builder = new ProductBuilder(baseURL);
    vi.clearAllMocks();
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

  describe("setId, setUUID, and setSku", () => {
    it("should set ID correctly", async () => {
      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .setId(12345)
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

    it.skip("should convert non-USD prices to USD", async () => {
      const toUSDSpy = vi.spyOn(currencyHelpers, "toUSD");

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "EUR", "€")
        .setQuantity(500, "g")
        .build();

      expect(toUSDSpy).toHaveBeenCalledWith(29.99, "EUR");
      expect(result).toMatchObject({
        price: 29.99,
        currencyCode: "EUR",
        usdPrice: 34.99,
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
});
