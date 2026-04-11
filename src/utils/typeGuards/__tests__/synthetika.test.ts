import { describe, expect, it } from "vitest";
import sodiumDichromateFixture from "@/__mocks__/responses/synthetika.com/sodium-dichromate-7670.json";
import {
  assertIsSynthetikaProductPrice,
  assertIsSynthetikaSearchResponse,
  isSynthetikaProduct,
  isSynthetikaProductPrice,
  isSynthetikaSearchResponse,
} from "../synthetika";

const buildValidProduct = () => ({
  id: 1,
  name: "Test Product",
  url: "https://example.com",
  code: "TEST123",
  can_buy: true,
  unit: { name: "szt.", floating_point: false },
  stockId: 42,
  availability: { name: "In Stock" },
  price: {
    gross: { base: "100", base_float: 100, final: "100", final_float: 100 },
    net: { base: "90", base_float: 90, final: "90", final_float: 90 },
  },
  weight: { weight_float: 0, weight: "0 kg" },
  shortDescription: "Test Description",
  description: "Test long description",
  producer: { id: 1, name: "Test Producer", img: "test.jpg" },
  options_configuration: [
    {
      values: [{ id: "1", order: "1", name: "1000g" }],
    },
  ],
});

describe("Synthetika Type Guards", () => {
  describe("isSynthetikaSearchResponse", () => {
    it("should return true for valid SynthetikaSearchResponse", () => {
      const validResponse = {
        count: 10,
        pages: 2,
        page: 1,
        list: [],
      };

      expect(isSynthetikaSearchResponse(validResponse)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSynthetikaSearchResponse(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isSynthetikaSearchResponse(undefined)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isSynthetikaSearchResponse("not an object")).toBe(false);
    });

    it("should return false when missing required fields", () => {
      const invalidResponse = {
        count: 10,
        pages: 2,
        // missing page and list
      };

      expect(isSynthetikaSearchResponse(invalidResponse)).toBe(false);
    });

    it("should return false when fields have wrong types", () => {
      const invalidResponse = {
        count: "10", // should be number
        pages: 2,
        page: 1,
        list: "not an array", // should be array
      };

      expect(isSynthetikaSearchResponse(invalidResponse)).toBe(false);
    });
  });

  describe("assertIsSynthetikaSearchResponse", () => {
    it("should not throw for valid SynthetikaSearchResponse", () => {
      const validResponse = {
        count: 10,
        pages: 2,
        page: 1,
        list: [],
      };

      expect(() => assertIsSynthetikaSearchResponse(validResponse)).not.toThrow();
    });

    it("should throw for null", () => {
      expect(() => assertIsSynthetikaSearchResponse(null)).toThrow();
    });

    it("should throw for undefined", () => {
      expect(() => assertIsSynthetikaSearchResponse(undefined)).toThrow();
    });

    it("should throw for non-object", () => {
      expect(() => assertIsSynthetikaSearchResponse("not an object")).toThrow();
    });

    it("should throw when missing required fields", () => {
      const invalidResponse = {
        count: 10,
        pages: 2,
        // missing page and list
      };

      expect(() => assertIsSynthetikaSearchResponse(invalidResponse)).toThrow();
    });
  });

  describe("isSynthetikaProduct", () => {
    it("should return true for valid SynthetikaProduct", () => {
      expect(isSynthetikaProduct(buildValidProduct())).toBe(true);
    });

    it("should return true for the real sodium-dichromate-7670 fixture", () => {
      expect(isSynthetikaProduct(sodiumDichromateFixture)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSynthetikaProduct(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isSynthetikaProduct(undefined)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isSynthetikaProduct("not an object")).toBe(false);
    });

    it("should return false when missing required fields", () => {
      const invalidProduct = {
        id: 1,
        name: "Test Product",
        // missing other required fields
      };

      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });

    it("should return false when fields have wrong types", () => {
      const invalidProduct = {
        ...buildValidProduct(),
        id: "1", // should be number
        can_buy: "true", // should be boolean
      };

      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });

    it("should return false when unit is missing", () => {
      const { unit: _unit, ...invalidProduct } = buildValidProduct();
      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });

    it("should return false when stockId is missing", () => {
      const { stockId: _stockId, ...invalidProduct } = buildValidProduct();
      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });

    it("should return false when weight is missing", () => {
      const { weight: _weight, ...invalidProduct } = buildValidProduct();
      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });

    it("should return false when price.gross is missing the final field", () => {
      const invalidProduct = {
        ...buildValidProduct(),
        price: {
          gross: { base: "100" },
          net: { base: "90", final: "90" },
        },
      };
      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });

    it("should return false when price.net is missing entirely", () => {
      const invalidProduct = {
        ...buildValidProduct(),
        price: {
          gross: { base: "100", final: "100" },
        },
      };
      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });

    it("should return false when options_configuration is missing", () => {
      const { options_configuration: _opts, ...invalidProduct } = buildValidProduct();
      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });

    it("should return false when options_configuration is not an array", () => {
      const invalidProduct = {
        ...buildValidProduct(),
        options_configuration: { values: [] },
      };
      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });

    it("should return false when an options_configuration value is missing id/order/name", () => {
      const invalidProduct = {
        ...buildValidProduct(),
        options_configuration: [
          {
            values: [{ id: "1", name: "1000g" }], // missing order
          },
        ],
      };
      expect(isSynthetikaProduct(invalidProduct)).toBe(false);
    });

    it("should accept an empty options_configuration array", () => {
      const validProduct = {
        ...buildValidProduct(),
        options_configuration: [],
      };
      expect(isSynthetikaProduct(validProduct)).toBe(true);
    });
  });

  describe("isSynthetikaProductPrice", () => {
    it("should return true for valid SynthetikaProductPrice", () => {
      const validPrice = {
        base: "100",
        base_float: 100,
        final: "100",
        final_float: 100,
      };

      expect(isSynthetikaProductPrice(validPrice)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSynthetikaProductPrice(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isSynthetikaProductPrice(undefined)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isSynthetikaProductPrice("not an object")).toBe(false);
    });

    it("should return false when missing required fields", () => {
      const invalidPrice = {
        base: "100",
        // missing final
      };

      expect(isSynthetikaProductPrice(invalidPrice)).toBe(false);
    });
  });

  describe("assertIsSynthetikaProductPrice", () => {
    it("should not throw for valid SynthetikaProductPrice", () => {
      const validPrice = {
        base: "100",
        base_float: 100,
        final: "100",
        final_float: 100,
      };

      expect(() => assertIsSynthetikaProductPrice(validPrice)).not.toThrow();
    });

    it("should throw for null", () => {
      expect(() => assertIsSynthetikaProductPrice(null)).toThrow();
    });

    it("should throw for undefined", () => {
      expect(() => assertIsSynthetikaProductPrice(undefined)).toThrow();
    });

    it("should throw for non-object", () => {
      expect(() => assertIsSynthetikaProductPrice("not an object")).toThrow();
    });

    it("should throw when missing required fields", () => {
      const invalidPrice = {
        base: "100",
        // missing final
      };

      expect(() => assertIsSynthetikaProductPrice(invalidPrice)).toThrow();
    });
  });
});
