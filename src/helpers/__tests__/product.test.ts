import {
  hasExpandableDetail,
  isPresent,
  resolveProductImages,
  samePurchasableUnit,
} from "@/helpers/product";
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

describe("resolveProductImages", () => {
  it("uses the thumbnail for display and the full image on click", () => {
    const images = resolveProductImages({
      ...baseProduct,
      images: [
        { href: "full.jpg", type: "image", altText: "front" },
        { href: "t.jpg", type: "thumbnail" },
      ],
    });
    expect(images).toEqual([{ thumbSrc: "t.jpg", fullSrc: "full.jpg", altText: "front" }]);
  });

  it("falls back to the full image when there is no thumbnail", () => {
    const images = resolveProductImages({
      ...baseProduct,
      images: [{ href: "full.jpg", type: "image" }],
    });
    expect(images).toEqual([{ thumbSrc: "full.jpg", fullSrc: "full.jpg", altText: undefined }]);
  });

  it("pairs each full image with its thumbnail by position", () => {
    const images = resolveProductImages({
      ...baseProduct,
      images: [
        { href: "a.jpg", type: "image" },
        { href: "a-t.jpg", type: "thumbnail" },
        { href: "b.jpg", type: "image" },
        { href: "b-t.jpg", type: "thumbnail" },
      ],
    });
    expect(images).toEqual([
      { thumbSrc: "a-t.jpg", fullSrc: "a.jpg", altText: undefined },
      { thumbSrc: "b-t.jpg", fullSrc: "b.jpg", altText: undefined },
    ]);
  });

  it("reuses the default thumbnail for images that lack their own", () => {
    const images = resolveProductImages({
      ...baseProduct,
      images: [
        { href: "a.jpg", type: "image" },
        { href: "b.jpg", type: "image" },
        { href: "t.jpg", type: "thumbnail" },
      ],
    });
    expect(images.map((image) => image.thumbSrc)).toEqual(["t.jpg", "t.jpg"]);
  });

  it("cycles thumbnails alone when there are no full images", () => {
    const images = resolveProductImages({
      ...baseProduct,
      images: [{ href: "t.jpg", type: "thumbnail" }],
    });
    expect(images).toEqual([{ thumbSrc: "t.jpg", fullSrc: "t.jpg", altText: undefined }]);
  });

  it("derives a single CACTUS structure image from CAS when there is no photo", () => {
    const images = resolveProductImages({ ...baseProduct, cas: "69-57-8" } as Product);
    expect(images).toHaveLength(1);
    expect(images[0].thumbSrc).toBe("https://cactus.nci.nih.gov/chemical/structure/69-57-8/image");
    expect(images[0].fullSrc).toContain("/69-57-8/image?width=500&height=500");
  });

  it("url-encodes the identifier for SMILES fallbacks", () => {
    // Double-cast through unknown: a raw SMILES string doesn't satisfy the branded Smiles<string>.
    const images = resolveProductImages({
      ...baseProduct,
      smiles: "[K+].[O-]",
    } as unknown as Product);
    expect(images[0].thumbSrc).toBe(
      "https://cactus.nci.nih.gov/chemical/structure/%5BK%2B%5D.%5BO-%5D/image",
    );
  });

  it("returns an empty array with no image and no chemical identifier", () => {
    expect(resolveProductImages(baseProduct)).toEqual([]);
  });
});

describe("hasExpandableDetail", () => {
  it("is true when the product has an image", () => {
    expect(
      hasExpandableDetail({ ...baseProduct, images: [{ href: "t.jpg", type: "image" }] }),
    ).toBe(true);
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

describe("samePurchasableUnit", () => {
  it("matches the same size, case-insensitive on uom", () => {
    expect(
      samePurchasableUnit({ quantity: 1, uom: "mg" } as Variant, {
        quantity: 1,
        uom: "MG",
      } as Variant),
    ).toBe(true);
  });

  it("does not match a different quantity or uom", () => {
    expect(
      samePurchasableUnit({ quantity: 1, uom: "mg" } as Variant, {
        quantity: 5,
        uom: "mg",
      } as Variant),
    ).toBe(false);
    expect(
      samePurchasableUnit({ quantity: 1, uom: "mg" } as Variant, {
        quantity: 1,
        uom: "g",
      } as Variant),
    ).toBe(false);
  });

  it("detects a supplier-listed parent whose id/sku differ (Ambeed case)", () => {
    // Parent P001064386/sku BD01081502 vs variant 3272919/sku A1159477 — ids differ,
    // but both are the 1 mg unit, so the parent is a duplicate of the 1 mg variant.
    const parent = { quantity: 1, uom: "mg", usdPrice: 29, id: "P001064386" } as Variant;
    const oneMg = { quantity: 1, uom: "mg", usdPrice: 29, id: "3272919" } as Variant;
    const fiveMg = { quantity: 5, uom: "mg", usdPrice: 74, id: "3272918" } as Variant;
    expect(samePurchasableUnit(parent, oneMg)).toBe(true);
    expect(samePurchasableUnit(parent, fiveMg)).toBe(false);
  });

  it("falls back to rounded USD price when a size is missing", () => {
    expect(samePurchasableUnit({ usdPrice: 29 } as Variant, { usdPrice: 29.004 } as Variant)).toBe(
      true,
    );
    expect(samePurchasableUnit({ usdPrice: 29 } as Variant, { usdPrice: 74 } as Variant)).toBe(
      false,
    );
  });

  it("is false when neither size nor price is available", () => {
    expect(samePurchasableUnit({ title: "a" } as Variant, { title: "b" } as Variant)).toBe(false);
  });
});
