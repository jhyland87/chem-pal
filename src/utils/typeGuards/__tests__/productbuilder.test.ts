import { AVAILABILITY } from "@/constants/common";
import { describe, expect, it } from "vitest";
import { isAvailability, isValidVariant } from "../productbuilder";

describe("ProductBuilder TypeGuards", () => {
  describe("isAvailability", () => {
    it("should return true for valid AVAILABILITY enum values", () => {
      Object.values(AVAILABILITY).forEach((availability) => {
        expect(isAvailability(availability)).toBe(true);
      });
    });

    it.skip("should return false for invalid availability values", () => {
      const invalidValues = [
        "available",
        "in_stock",
        "out_of_stock",
        "IN STOCK",
        "OUT OF STOCK",
        "backordered",
        "discontinued",
        "",
        " ",
      ];

      invalidValues.forEach((value) => {
        expect(isAvailability(value)).toBe(false);
      });
    });

    it("should return false for non-string values", () => {
      const nonStringValues = [
        null,
        undefined,
        123,
        true,
        false,
        {},
        [],
        () => {},
        Symbol("IN_STOCK"),
      ];

      nonStringValues.forEach((value) => {
        expect(isAvailability(value)).toBe(false);
      });
    });
  });

  describe("isValidVariant", () => {
    const validCompleteVariant = {
      title: "Sodium Chloride 500g",
      price: 29.99,
      quantity: 500,
    };

    const validPartialVariant = {
      price: 39.99,
      quantity: 1000,
      // title inherited from parent product
    };

    it("should return true for a valid complete variant", () => {
      expect(isValidVariant(validCompleteVariant)).toBe(true);
    });

    it("should return true for a valid partial variant", () => {
      expect(isValidVariant(validPartialVariant)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isValidVariant(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      const nonObjectValues = [
        "not an object",
        123,
        true,
        false,
        undefined,
        () => {},
        Symbol("variant"),
      ];

      nonObjectValues.forEach((value) => {
        expect(isValidVariant(value)).toBe(false);
      });
    });

    it("should return false for variants with wrong numeric property types", () => {
      const invalidNumericProps = [
        {
          ...validCompleteVariant,
          price: "29.99", // Should be number
        },
        {
          ...validCompleteVariant,
          quantity: "500", // Should be number
        },
        {
          ...validCompleteVariant,
          price: true, // Should be number
          quantity: null, // Should be number
        },
      ];

      invalidNumericProps.forEach((variant) => {
        expect(isValidVariant(variant)).toBe(false);
      });
    });

    it("should return false for variants with wrong string property types", () => {
      const invalidStringProps = [
        {
          ...validCompleteVariant,
          title: 123, // Should be string
        },
        {
          ...validCompleteVariant,
          title: true, // Should be string
        },
        {
          ...validCompleteVariant,
          title: null, // Should be string
        },
      ];

      invalidStringProps.forEach((variant) => {
        expect(isValidVariant(variant)).toBe(false);
      });
    });

    it("should return true for variants with additional properties", () => {
      const variantWithExtraProps = {
        ...validCompleteVariant,
        extraProp1: "value1",
        extraProp2: 123,
        extraProp3: true,
      };

      expect(isValidVariant(variantWithExtraProps)).toBe(true);
    });

    it("should return true for empty object (minimal valid variant)", () => {
      expect(isValidVariant({})).toBe(true);
    });
  });
});
