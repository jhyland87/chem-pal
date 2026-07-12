import { dedupeProducts, getProductDedupeKey } from "@/helpers/productIdentity";
import { describe, expect, it } from "vitest";

const product = (fields: Partial<Product>): Product => fields as unknown as Product;

describe("getProductDedupeKey", () => {
  it("returns undefined when the product has no usable identity", () => {
    expect(getProductDedupeKey(product({ supplier: "ACME" }))).toBeUndefined();
  });

  it("is stable for the same supplier + cacheKey", () => {
    const a = getProductDedupeKey(product({ supplier: "Carolina Chemical", cacheKey: "6981" }));
    const b = getProductDedupeKey(product({ supplier: "Carolina Chemical", cacheKey: "6981" }));
    expect(a).toBeDefined();
    expect(a).toBe(b);
  });

  it("does not collide across suppliers that share an identity string", () => {
    const a = getProductDedupeKey(product({ supplier: "Carolina Chemical", cacheKey: "6981" }));
    const b = getProductDedupeKey(product({ supplier: "FTF Scientific", cacheKey: "6981" }));
    expect(a).not.toBe(b);
  });
});

describe("dedupeProducts", () => {
  it("removes a later duplicate with the same supplier + cacheKey, keeping the first", () => {
    const first = product({ supplier: "Carolina Chemical", cacheKey: "6981", title: "A" });
    const dup = product({ supplier: "Carolina Chemical", cacheKey: "6981", title: "B" });
    const other = product({ supplier: "Carolina Chemical", cacheKey: "7000", title: "C" });

    const result = dedupeProducts([first, dup, other]);

    expect(result).toEqual([first, other]);
  });

  it("keeps two suppliers that share a cacheKey string", () => {
    const carolina = product({ supplier: "Carolina Chemical", cacheKey: "6981" });
    const ftf = product({ supplier: "FTF Scientific", cacheKey: "6981" });

    expect(dedupeProducts([carolina, ftf])).toHaveLength(2);
  });

  it("falls back to url when no cacheKey/id/uuid is present", () => {
    const a = product({ supplier: "Ambeed", url: "/x" });
    const b = product({ supplier: "Ambeed", url: "/x" });
    const c = product({ supplier: "Ambeed", url: "/y" });

    expect(dedupeProducts([a, b, c])).toEqual([a, c]);
  });

  it("never merges products that have no identity at all", () => {
    const a = product({ supplier: "ACME" });
    const b = product({ supplier: "ACME" });

    expect(dedupeProducts([a, b])).toHaveLength(2);
  });
});
