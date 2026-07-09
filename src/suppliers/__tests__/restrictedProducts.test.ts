// ProductBuilder must load before SupplierBase/SupplierFactory to avoid the module-init cycle.
import "@/utils/ProductBuilder";
import { describe, expect, it } from "vitest";
import { SupplierFactory } from "../SupplierFactory";

/**
 * Builds a factory exercising only the restriction-filter wiring; `location` and
 * `hideRestrictedProducts` are the two options under test.
 */
const makeFactory = (location?: string, hideRestricted: boolean = false) =>
  new SupplierFactory<Product>("test", {
    limit: 5,
    controller: new AbortController(),
    location,
    hideRestrictedProducts: hideRestricted,
  });

/** Minimal product with a required field set. */
const product = (over: Partial<Product> = {}): Product =>
  ({
    supplier: "Synthetika",
    title: "Sodium Borohydride",
    url: "https://example.com/nabh4",
    price: 10,
    currencyCode: "USD",
    currencySymbol: "$",
    quantity: 100,
    uom: "g",
    ...over,
  }) as Product;

type FactoryInternals = {
  applyRestrictionFilter: (p: Product) => Product | undefined;
};

const applyFilter = (factory: SupplierFactory<Product>, p: Product) =>
  (factory as unknown as FactoryInternals).applyRestrictionFilter(p);

describe("SupplierFactory restriction filtering", () => {
  it("passes products through untouched when hideRestrictedProducts is off", () => {
    const factory = makeFactory("US", false);
    const restricted = product({ purchaseRestriction: { excludedCountries: ["US"] } });
    expect(applyFilter(factory, restricted)).toBe(restricted);
  });

  it("drops a product the user can't buy when the toggle is on", () => {
    const factory = makeFactory("US", true);
    const restricted = product({ purchaseRestriction: { excludedCountries: ["US"] } });
    expect(applyFilter(factory, restricted)).toBeUndefined();
  });

  it("keeps an unrestricted product when the toggle is on", () => {
    const factory = makeFactory("US", true);
    const clean = product();
    expect(applyFilter(factory, clean)).toEqual(clean);
  });

  it("keeps a product restricted only for other regions", () => {
    const factory = makeFactory("PL", true);
    const restricted = product({ purchaseRestriction: { excludedCountries: ["US", "DE"] } });
    expect(applyFilter(factory, restricted)).toEqual(restricted);
  });
});
