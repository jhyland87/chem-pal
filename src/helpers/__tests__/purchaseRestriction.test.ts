// ProductBuilder is imported first to satisfy the supplier module-init cycle that the
// transitive typeGuards import can otherwise trip.
import { ProductBuilder } from "@/utils/ProductBuilder";
import { canUserBuy, filterRestrictedProduct } from "@/helpers/purchaseRestriction";
import { describe, expect, it } from "vitest";

describe("canUserBuy", () => {
  it("excludes a user whose location is on the denylist", () => {
    const option = { purchaseRestriction: { excludedCountries: ["US", "DE"] } } as Variant;
    expect(canUserBuy(option, "US")).toBe(false);
    expect(canUserBuy(option, "DE")).toBe(false);
    expect(canUserBuy(option, "PL")).toBe(true);
  });

  it("excludes users outside the EU for euOnly, allows EU users", () => {
    const option = { purchaseRestriction: { euOnly: true } } as Variant;
    expect(canUserBuy(option, "US")).toBe(false);
    expect(canUserBuy(option, undefined)).toBe(false);
    expect(canUserBuy(option, "PL")).toBe(true);
    expect(canUserBuy(option, "DE")).toBe(true);
  });

  it("excludes everyone for restrictedDelivery and buyerRestricted", () => {
    expect(canUserBuy({ purchaseRestriction: { restrictedDelivery: true } } as Variant, "PL")).toBe(false);
    expect(canUserBuy({ purchaseRestriction: { buyerRestricted: true } } as Variant, "PL")).toBe(false);
  });

  it("never excludes for a declaration-of-use requirement alone", () => {
    expect(canUserBuy({ purchaseRestriction: { declarationOfUseRequired: true } } as Variant, "US")).toBe(true);
  });

  it("allows options with no restriction", () => {
    expect(canUserBuy({} as Variant, "US")).toBe(true);
  });
});

/** Minimal buildable product with the required fields populated. */
const baseProduct = (): Product =>
  ({
    supplier: "Synthetika",
    title: "Sodium Nitrite 5000g",
    url: "https://example.com/5000g",
    price: 100,
    currencyCode: "USD",
    currencySymbol: "$",
    quantity: 5000,
    uom: "g",
  }) as Product;

describe("filterRestrictedProduct", () => {
  it("prunes restricted variants when the parent is buyable", () => {
    const product: Product = {
      ...baseProduct(),
      variants: [
        { title: "1000g", price: 20, quantity: 1000, uom: "g", url: "u1" },
        {
          title: "100g",
          price: 5,
          quantity: 100,
          uom: "g",
          url: "u2",
          purchaseRestriction: { excludedCountries: ["US"] },
        },
      ],
    };
    const result = filterRestrictedProduct(product, "US");
    expect(result?.variants).toHaveLength(1);
    expect(result?.variants?.[0].title).toBe("1000g");
  });

  it("drops the product when parent and every variant are restricted", () => {
    const product: Product = {
      ...baseProduct(),
      purchaseRestriction: { buyerRestricted: true },
      variants: [
        {
          title: "100g",
          price: 5,
          quantity: 100,
          uom: "g",
          url: "u2",
          purchaseRestriction: { buyerRestricted: true },
        },
      ],
    };
    expect(filterRestrictedProduct(product, "US")).toBeUndefined();
  });

  it("promotes the cheapest buyable variant when the parent is restricted", () => {
    const product: Product = {
      ...baseProduct(),
      // The 5000g representative is business-only.
      purchaseRestriction: { buyerRestricted: true },
      variants: [
        { title: "1000g", price: 20, quantity: 1000, uom: "g", url: "u1000" },
        { title: "500g", price: 12, quantity: 500, uom: "g", url: "u500" },
      ],
    };
    const result = filterRestrictedProduct(product, "US");
    expect(result).toBeDefined();
    // Cheapest buyable variant (500g) is promoted into the representative row.
    expect(result?.title).toBe("500g");
    expect(result?.price).toBe(12);
    expect(result?.quantity).toBe(500);
    expect(result?.url).toBe("u500");
    // Identity is preserved from the parent.
    expect(result?.supplier).toBe("Synthetika");
    expect(result?.variants).toHaveLength(2);
  });

  it("returns the product unchanged when nothing is restricted", () => {
    const product = baseProduct();
    expect(filterRestrictedProduct(product, "US")).toEqual(product);
  });
});

describe("ProductBuilder.setPurchaseRestriction", () => {
  it("keeps recognized, well-typed fields and trims the note", () => {
    const builder = new ProductBuilder<Product>("https://example.com");
    builder.setPurchaseRestriction({
      excludedCountries: ["US", "DE"],
      buyerRestricted: true,
      note: "  We do not ship to US, DE  ",
    });
    expect(builder.get("purchaseRestriction")).toEqual({
      excludedCountries: ["US", "DE"],
      buyerRestricted: true,
      note: "We do not ship to US, DE",
    });
  });

  it("drops invalid country codes and non-boolean flags", () => {
    const builder = new ProductBuilder<Product>("https://example.com");
    builder.setPurchaseRestriction({
      excludedCountries: ["US", "ZZ", 5],
      buyerRestricted: "yes",
      euOnly: true,
    });
    expect(builder.get("purchaseRestriction")).toEqual({
      excludedCountries: ["US"],
      euOnly: true,
    });
  });

  it("ignores non-object input and restrictions with no surviving fields", () => {
    const builder = new ProductBuilder<Product>("https://example.com");
    builder.setPurchaseRestriction("nope");
    expect(builder.get("purchaseRestriction")).toBeUndefined();
    builder.setPurchaseRestriction({ excludedCountries: [], buyerRestricted: false });
    expect(builder.get("purchaseRestriction")).toBeUndefined();
  });
});
