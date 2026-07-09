/**
 * @group Helpers
 * @groupDescription Product-domain predicates and image resolution shared by the
 * results table's expander column and its expanded detail panel.
 * @source
 */

/** Base URL for NCI CACTUS chemical structure resolver (also used in `cas.ts`). */
const CACTUS_STRUCTURE_BASE = "https://cactus.nci.nih.gov/chemical/structure";

/** Detail fields whose presence makes a product worth expanding into the panel. */
const EXPANDABLE_DETAIL_KEYS = [
  "cas",
  "inchiKey",
  "inchi",
  "smiles",
  "formula",
  "moleweight",
  "iupacName",
  "purity",
  "grade",
  "concentration",
  "manufacturer",
  "description",
  "sdsUrl",
  "specSheetUrl",
  "coaUrl",
  "pubchemId",
] as const satisfies readonly (keyof Product)[];

/**
 * A resolved image for a product's detail panel: the source shown in the
 * thumbnail box and the (usually larger) source opened when it's clicked.
 * @source
 */
interface ResolvedProductImage {
  /** Image URL to render in the fixed-size thumbnail box. */
  thumbSrc: string;
  /** Image URL to open in a new tab when the thumbnail is clicked. */
  fullSrc: string;
  /** Alt text for the image, when the source provided one. */
  altText?: string;
}

/**
 * Reports whether a value is meaningfully populated: not null/undefined, not an
 * empty string, and not `NaN`. Used to gate optional detail rows so blank fields
 * are skipped in the panel.
 * @param value - The value to test.
 * @returns `true` when the value is present and renderable, `false` otherwise.
 * @example
 * ```ts
 * isPresent("NaCl"); // => true
 * isPresent("");     // => false
 * isPresent(NaN);    // => false
 * isPresent(undefined); // => false
 * ```
 * @source
 */
export function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return !Number.isNaN(value);
  return true;
}

/**
 * Reports whether two variants represent the same purchasable unit — used to
 * detect a supplier-listed parent among the variants when their ids/skus differ.
 * Compares pack size (quantity + case-insensitive uom); when either lacks a size,
 * falls back to rounded USD price equality.
 * @param a - The first variant (typically the parent product).
 * @param b - The second variant to compare against.
 * @returns `true` when they are the same size (or, sizeless, the same USD price).
 * @example
 * ```ts
 * samePurchasableUnit({ quantity: 1, uom: "mg" }, { quantity: 1, uom: "MG" }); // => true
 * samePurchasableUnit({ quantity: 1, uom: "mg" }, { quantity: 5, uom: "mg" }); // => false
 * ```
 * @source
 */
export function samePurchasableUnit(a: Variant, b: Variant): boolean {
  if (isPresent(a.quantity) && isPresent(b.quantity)) {
    return (
      a.quantity === b.quantity &&
      (a.uom ?? "").trim().toLowerCase() === (b.uom ?? "").trim().toLowerCase()
    );
  }
  // typeof narrows `number | undefined` to `number` (unlike isPresent, which isn't a type guard);
  // a NaN price compares false either way, so this keeps isPresent's effective behavior.
  if (typeof a.usdPrice === "number" && typeof b.usdPrice === "number") {
    return Math.round(a.usdPrice * 100) === Math.round(b.usdPrice * 100);
  }
  return false;
}

/**
 * Resolves the images to display for a product, falling back from real photos to
 * a single NCI CACTUS structure depiction built from the first available chemical
 * identifier (CAS → SMILES → IUPAC name).
 * @param product - The product to resolve images for.
 * @returns The resolved images in display order (thumbnail source, full-size
 *          source, and optional alt text), or an empty array when the product has
 *          no photos and no identifier to derive a structure from.
 * @example
 * ```ts
 * resolveProductImages({
 *   images: [{ href: "full.jpg", type: "image" }, { href: "t.jpg", type: "thumbnail" }],
 * } as Product);
 * // => [{ thumbSrc: "t.jpg", fullSrc: "full.jpg" }]
 * resolveProductImages({ cas: "69-57-8" } as Product);
 * // => [{ thumbSrc: ".../structure/69-57-8/image", fullSrc: ".../structure/69-57-8/image?width=500&height=500" }]
 * resolveProductImages({ title: "x" } as Product);
 * // => []
 * ```
 * @source
 */
export function resolveProductImages(product: Product): ResolvedProductImage[] {
  const entries = (product.images ?? []).filter((image) => isPresent(image.href));
  const { image: fulls = [], thumbnail: thumbs = [] } = Object.groupBy(
    entries,
    (image) => image.type,
  );

  // Cycle through the full-size images (or thumbnails when that's all there is),
  // opening the full source on click. Pair each with a thumbnail by position,
  // falling back to the default thumbnail, then to the source itself.
  const sources = fulls.length > 0 ? fulls : thumbs;
  if (sources.length > 0) {
    return sources.map((image, index) => ({
      thumbSrc: (thumbs[index] ?? thumbs[0] ?? image).href,
      fullSrc: image.href,
      altText: image.altText,
    }));
  }

  // No photo: derive a 2D structure depiction from a chemical identifier.
  const identifier = [product.cas, product.smiles, product.iupacName].find((id) => isPresent(id));
  if (identifier === undefined) return [];

  const encoded = encodeURIComponent(String(identifier));
  const structureUrl = `${CACTUS_STRUCTURE_BASE}/${encoded}/image`;
  return [{ thumbSrc: structureUrl, fullSrc: `${structureUrl}?width=500&height=500` }];
}

/**
 * Reports whether a product has any content worth revealing in the expanded
 * detail panel: a resolvable image, at least one variant, or any populated
 * detail field. Drives both `getRowCanExpand` and the expander column so the
 * toggle only appears when expansion would show something.
 * @param product - The product to test.
 * @returns `true` when the product has an image, variants, or detail fields.
 * @example
 * ```ts
 * hasExpandableDetail({ cas: "7647-14-5" } as Product);   // => true (detail field)
 * hasExpandableDetail({ variants: [{}] } as Product);      // => true (variants)
 * hasExpandableDetail({ title: "x", supplier: "y" } as Product); // => false
 * ```
 * @source
 */
export function hasExpandableDetail(product: Product): boolean {
  if (resolveProductImages(product).length > 0) return true;
  if ((product.variants?.length ?? 0) > 0) return true;
  return EXPANDABLE_DETAIL_KEYS.some((key) => isPresent(product[key]));
}
