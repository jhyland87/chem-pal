import { AVAILABILITY } from "@/constants/common";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { describe, expect, it } from "vitest";

const setAvailability = (value: string) =>
  new ProductBuilder<Product>("https://example.com").setAvailability(value).get("availability");

describe("ProductBuilder availability — schema.org ItemAvailability labels", () => {
  // The full https://schema.org/ItemAvailability set, as it arrives from a
  // schema.org URL suffix (e.g. ".../SoldOut" -> "SoldOut").
  const cases: Array<[string, AVAILABILITY]> = [
    ["BackOrder", AVAILABILITY.BACKORDER],
    ["Discontinued", AVAILABILITY.DISCONTINUED],
    ["InStock", AVAILABILITY.IN_STOCK],
    ["InStoreOnly", AVAILABILITY.IN_STORE_ONLY],
    ["LimitedAvailability", AVAILABILITY.LIMITED_STOCK],
    ["MadeToOrder", AVAILABILITY.MADE_TO_ORDER],
    ["OnlineOnly", AVAILABILITY.ONLINE_ONLY],
    ["OutOfStock", AVAILABILITY.OUT_OF_STOCK],
    ["PreOrder", AVAILABILITY.PRE_ORDER],
    ["PreSale", AVAILABILITY.PRE_SALE],
    ["Reserved", AVAILABILITY.RESERVED],
    ["SoldOut", AVAILABILITY.SOLD_OUT],
  ];

  it.each(cases)("maps schema.org %s to %s", (label, expected) => {
    expect(setAvailability(label)).toBe(expected);
  });

  it("stores each enum member's own value (normalizing casing)", () => {
    for (const value of Object.values(AVAILABILITY)) {
      expect(setAvailability(value.toUpperCase())).toBe(value);
    }
  });

  it("ignores an unrecognized label", () => {
    expect(setAvailability("teleported")).toBeUndefined();
  });
});
