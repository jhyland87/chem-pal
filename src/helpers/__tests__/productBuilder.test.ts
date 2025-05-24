import { toUSD } from "@/helpers/currency";
import { ProductBuilder } from "@/helpers/productBuilder";
import { toBaseQuantity } from "@/helpers/quantity";
import type { Product } from "@/types";

// Mock the currency and quantity helper functions
jest.mock("@/helpers/currency", () => ({
  toUSD: jest.fn(),
}));

jest.mock("@/helpers/quantity", () => ({
  toBaseQuantity: jest.fn(),
}));

describe("ProductBuilder", () => {
  const baseURL = "https://example.com";
  let builder: ProductBuilder<Product>;

  beforeEach(() => {
    builder = new ProductBuilder(baseURL);
    jest.clearAllMocks();
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

  describe("build", () => {
    beforeEach(() => {
      (toUSD as jest.Mock).mockResolvedValue(29.99);
      (toBaseQuantity as jest.Mock).mockReturnValue(500);
    });

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
      (toUSD as jest.Mock).mockResolvedValue(34.99);

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "EUR", "€")
        .setQuantity(500, "g")
        .build();

      expect(toUSD).toHaveBeenCalledWith(29.99, "EUR");
      expect(result).toMatchObject({
        price: 29.99,
        currencyCode: "EUR",
        usdPrice: 34.99,
      });
    });

    it("should convert quantities to base units", async () => {
      (toBaseQuantity as jest.Mock).mockReturnValue(0.5);

      const result = await builder
        .setBasicInfo("Test Product", "/product/123", "Test Supplier")
        .setPricing(29.99, "USD", "$")
        .setQuantity(500, "g")
        .build();

      expect(toBaseQuantity).toHaveBeenCalledWith(500, "g");
      expect(result).toMatchObject({
        quantity: 500,
        uom: "g",
        baseQuantity: 0.5,
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
