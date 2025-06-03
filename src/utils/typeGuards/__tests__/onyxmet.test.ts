import { describe, expect, it } from "vitest";
import { isSearchResultItem } from "../onyxmet";

describe("OnyxMet TypeGuards", () => {
  describe("isSearchResultItem", () => {
    const validItem = {
      label: "Sodium Chloride",
      image: "nacl.jpg",
      description: "High purity NaCl",
      href: "/products/nacl",
    };

    it("should return true for a valid search result item", () => {
      expect(isSearchResultItem(validItem)).toBe(true);
    });

    it("should return true for a valid item with additional properties", () => {
      const itemWithExtraProps = {
        ...validItem,
        extraProp1: "value1",
        extraProp2: 123,
        extraProp3: true,
      };

      expect(isSearchResultItem(itemWithExtraProps)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isSearchResultItem(null)).toBe(false);
    });

    it("should return false for non-object values", () => {
      const nonObjectValues = [
        "not an object",
        123,
        true,
        false,
        undefined,
        () => {},
        Symbol("item"),
        [],
      ];

      nonObjectValues.forEach((value) => {
        expect(isSearchResultItem(value)).toBe(false);
      });
    });

    it("should return false for objects missing required properties", () => {
      const missingProps = [
        {
          // Missing label
          image: "nacl.jpg",
          description: "High purity NaCl",
          href: "/products/nacl",
        },
        {
          label: "Sodium Chloride",
          // Missing image
          description: "High purity NaCl",
          href: "/products/nacl",
        },
        {
          label: "Sodium Chloride",
          image: "nacl.jpg",
          // Missing description
          href: "/products/nacl",
        },
        {
          label: "Sodium Chloride",
          image: "nacl.jpg",
          description: "High purity NaCl",
          // Missing href
        },
        {
          // Missing all properties
        },
      ];

      missingProps.forEach((item) => {
        expect(isSearchResultItem(item)).toBe(false);
      });
    });

    it("should return true for items with property values of any type", () => {
      const itemsWithAnyTypes = [
        {
          ...validItem,
          label: 123, // Any type is allowed
        },
        {
          ...validItem,
          image: null, // Any type is allowed
        },
        {
          ...validItem,
          description: undefined, // Any type is allowed
        },
        {
          ...validItem,
          href: 456, // Any type is allowed
        },
      ];

      itemsWithAnyTypes.forEach((item) => {
        expect(isSearchResultItem(item)).toBe(true);
      });
    });
  });
});
