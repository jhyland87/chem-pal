import { hasExpandableDetail, isPresent, resolveProductImage } from "@/helpers/product";
import { describe, expect, it } from "vitest";

/** Minimal base product with only the required fields populated. */
const baseProduct = {
  supplier: "Carolina Chemical",
  title: "Sodium Chloride",
  url: "https://example.com/nacl",
  price: 10,
  currencyCode: "USD",
  currencySymbol: "$",
  quantity: 500,
  uom: "g",
} as Product;

describe("isPresent", () => {
  it.each([
    ["non-empty string", "NaCl", true],
    ["number", 42, true],
    ["zero", 0, true],
    ["empty string", "", false],
    ["whitespace string", "   ", false],
    ["NaN", Number.NaN, false],
    ["undefined", undefined, false],
    ["null", null, false],
  ])("returns %s => %s", (_label, value, expected) => {
    expect(isPresent(value)).toBe(expected);
  });
});

describe("resolveProductImage", () => {
  it("uses the thumbnail for display and the full image on click", () => {
    const image = resolveProductImage({ ...baseProduct, thumbnail: "t.jpg", imageURL: "full.jpg" });
    expect(image).toEqual({ thumbSrc: "t.jpg", fullSrc: "full.jpg" });
  });

  it("falls back to the regular image when there is no thumbnail", () => {
    const image = resolveProductImage({ ...baseProduct, imageURL: "full.jpg" });
    expect(image).toEqual({ thumbSrc: "full.jpg", fullSrc: "full.jpg" });
  });

  it("derives a CACTUS structure image from CAS when there is no photo", () => {
    const image = resolveProductImage({ ...baseProduct, cas: "69-57-8" } as Product);
    expect(image?.thumbSrc).toBe("https://cactus.nci.nih.gov/chemical/structure/69-57-8/image");
    expect(image?.fullSrc).toContain("/69-57-8/image?width=500&height=500");
  });

  it("url-encodes the identifier for SMILES fallbacks", () => {
    // Double-cast through unknown: a raw SMILES string doesn't satisfy the branded Smiles<string>.
    const image = resolveProductImage({ ...baseProduct, smiles: "[K+].[O-]" } as unknown as Product);
    expect(image?.thumbSrc).toBe(
      "https://cactus.nci.nih.gov/chemical/structure/%5BK%2B%5D.%5BO-%5D/image",
    );
  });

  it("returns undefined with no image and no chemical identifier", () => {
    expect(resolveProductImage(baseProduct)).toBeUndefined();
  });
});

describe("hasExpandableDetail", () => {
  it("is true when the product has an image", () => {
    expect(hasExpandableDetail({ ...baseProduct, thumbnail: "t.jpg" })).toBe(true);
  });

  it("is true when the product has variants", () => {
    expect(hasExpandableDetail({ ...baseProduct, variants: [{ title: "500g" }] })).toBe(true);
  });

  it("is true when the product has a populated detail field", () => {
    expect(hasExpandableDetail({ ...baseProduct, cas: "7647-14-5" } as Product)).toBe(true);
  });

  it("is true when the product has only a CAS (structure image derivable)", () => {
    expect(hasExpandableDetail({ ...baseProduct, formula: "NaCl" })).toBe(true);
  });

  it("is false when there is nothing to show", () => {
    expect(hasExpandableDetail(baseProduct)).toBe(false);
  });

  it("is false for an empty-string detail field", () => {
    // Double-cast through unknown: "" doesn't satisfy the branded CAS<string> template type.
    expect(hasExpandableDetail({ ...baseProduct, cas: "" } as unknown as Product)).toBe(false);
  });
});
