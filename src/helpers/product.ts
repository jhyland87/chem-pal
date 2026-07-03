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
 * The resolved images for a product's detail panel: the source shown in the
 * thumbnail box and the (usually larger) source opened when it's clicked.
 * @source
 */
interface ResolvedProductImage {
  /** Image URL to render in the fixed-size thumbnail box. */
  thumbSrc: string;
  /** Image URL to open in a new tab when the thumbnail is clicked. */
  fullSrc: string;
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
 * Resolves the image to display for a product, falling back from a real photo to
 * an NCI CACTUS structure depiction built from the first available chemical
 * identifier (CAS → SMILES → IUPAC name).
 * @param product - The product to resolve an image for.
 * @returns The thumbnail and full-size image sources, or `undefined` when the
 *          product has no photo and no identifier to derive a structure from.
 * @example
 * ```ts
 * resolveProductImage({ thumbnail: "t.jpg", imageURL: "full.jpg" } as Product);
 * // => { thumbSrc: "t.jpg", fullSrc: "full.jpg" }
 * resolveProductImage({ cas: "69-57-8" } as Product);
 * // => { thumbSrc: ".../structure/69-57-8/image", fullSrc: ".../structure/69-57-8/image?width=500&height=500" }
 * resolveProductImage({ title: "x" } as Product);
 * // => undefined
 * ```
 * @source
 */
export function resolveProductImage(product: Product): ResolvedProductImage | undefined {
  const { thumbnail, imageURL } = product;

  // Real supplier photo: show the thumbnail, open the full image on click.
  if (isPresent(thumbnail) || isPresent(imageURL)) {
    const thumb = thumbnail ?? imageURL;
    const full = imageURL ?? thumbnail;
    if (thumb !== undefined && full !== undefined) {
      return { thumbSrc: thumb, fullSrc: full };
    }
  }

  // No photo: derive a 2D structure depiction from a chemical identifier.
  const identifier = [product.cas, product.smiles, product.iupacName].find((id) => isPresent(id));
  if (identifier === undefined) return undefined;

  const encoded = encodeURIComponent(String(identifier));
  const structureUrl = `${CACTUS_STRUCTURE_BASE}/${encoded}/image`;
  return { thumbSrc: structureUrl, fullSrc: `${structureUrl}?width=500&height=500` };
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
  if (resolveProductImage(product) !== undefined) return true;
  if ((product.variants?.length ?? 0) > 0) return true;
  return EXPANDABLE_DETAIL_KEYS.some((key) => isPresent(product[key]));
}
