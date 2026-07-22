/**
 * @group Helpers
 * @groupDescription Product-domain predicates and image resolution shared by the
 * results table's expander column and its expanded detail panel.
 * @source
 */

import { mapDefined } from './utils';
/** Base URL for NCI CACTUS chemical structure resolver (also used in `cas.ts`). */
const CACTUS_STRUCTURE_BASE = 'https://cactus.nci.nih.gov/chemical/structure';

/** Detail fields whose presence makes a product worth expanding into the panel. */
const EXPANDABLE_DETAIL_KEYS = [
  'cas',
  'inchiKey',
  'inchi',
  'smiles',
  'formula',
  'moleweight',
  'iupacName',
  'purity',
  'grade',
  'concentration',
  'manufacturer',
  'description',
  'sdsUrl',
  'specSheetUrl',
  'coaUrl',
  'pubchemId',
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
 * @category Helpers
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
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return !Number.isNaN(value);
  return true;
}

/**
 * Reports whether two variants represent the same purchasable unit — used to
 * detect a supplier-listed parent among the variants when their ids/skus differ.
 * Compares pack size (quantity + case-insensitive uom); when either lacks a size,
 * falls back to rounded USD price equality.
 * @category Helpers
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
      (a.uom ?? '').trim().toLowerCase() === (b.uom ?? '').trim().toLowerCase()
    );
  }
  // typeof narrows `number | undefined` to `number` (unlike isPresent, which isn't a type guard);
  // a NaN price compares false either way, so this keeps isPresent's effective behavior.
  if (typeof a.usdPrice === 'number' && typeof b.usdPrice === 'number') {
    return Math.round(a.usdPrice * 100) === Math.round(b.usdPrice * 100);
  }
  return false;
}

/**
 * Resolves the images to display for a product, falling back from real photos to
 * a single NCI CACTUS structure depiction built from the first available chemical
 * identifier (CAS → SMILES → IUPAC name).
 * @category Helpers
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
 * @category Helpers
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

/** Keys stripped from copied product info — internal/derived noise. */
const NON_EXPORTED_PRODUCT_KEYS = ['currencySymbol', 'baseQuantity', 'cacheKey', '_id'];

/**
 * Splits a flat {@link ProductImage} list into separate `images` and
 * `thumbnails` href arrays, dropping the per-entry `{ type }` wrapper so copied
 * product info reads cleanly. Each array is omitted when it would be empty.
 * @param images - The product's flat image list, or undefined.
 * @returns Hrefs grouped by kind: `{ images?, thumbnails? }`.
 * @example
 * ```ts
 * splitProductImages([
 *   { href: "a/120x120x2/img.jpeg", type: "thumbnail" },
 *   { href: "a/img.jpeg", type: "image" },
 * ]);
 * // => { images: ["a/img.jpeg"], thumbnails: ["a/120x120x2/img.jpeg"] }
 * ```
 * @source
 */
function splitProductImages(images?: ProductImage[]): {
  images?: string[];
  thumbnails?: string[];
} {
  const fullImages: string[] = [];
  const thumbnails: string[] = [];
  for (const image of images ?? []) {
    if (image.type === 'thumbnail') {
      thumbnails.push(image.href);
    } else {
      fullImages.push(image.href);
    }
  }
  return {
    images: fullImages.length > 0 ? fullImages : undefined,
    thumbnails: thumbnails.length > 0 ? thumbnails : undefined,
  };
}

/**
 * Cleans one product or variant for copy/export: drops internal noise keys,
 * renders `price` with its currency symbol, and replaces the flat `images` list
 * with separate `images`/`thumbnails` href arrays. Nested `variants` are left to
 * the caller.
 * @param item - The product or variant to clean.
 * @returns A plain object with the cleaned fields.
 * @example
 * ```ts
 * cleanProductFields({ title: "Acetone", price: 5, currencySymbol: "$", images: [] });
 * // => { title: "Acetone", price: "$5" }
 * ```
 * @source
 */
function cleanProductFields(item: Variant): Record<string, unknown> {
  const entries = mapDefined(Object.entries(item), ([key, value]) => {
    if (NON_EXPORTED_PRODUCT_KEYS.includes(key)) return;
    if (key === 'images' || key === 'variants') return;
    if (key === 'price') return [key, `${item.currencySymbol ?? ''}${value}`];
    return [key, value];
  });

  const cleaned: Record<string, unknown> = Object.fromEntries(entries);
  const { images, thumbnails } = splitProductImages(item.images);
  if (images) cleaned.images = images;
  if (thumbnails) cleaned.thumbnails = thumbnails;
  return cleaned;
}

/**
 * Builds a copy/export-friendly plain object from a product: internal fields are
 * dropped, the price is rendered with its currency symbol, and every image list
 * (on the product and each variant) is split into `images`/`thumbnails` href
 * arrays so the copied output isn't cluttered with `{ href, type }` pairs.
 * @param product - The product to serialize.
 * @returns A cleaned object suitable for JSON/YAML copy output.
 * @example
 * ```ts
 * getExportableProductData(product).images;     // => ["https://…/image.jpeg"]
 * getExportableProductData(product).thumbnails; // => ["https://…/120x120x2/image.jpeg"]
 * ```
 * @source
 */
export function getExportableProductData(product: Product): Record<string, unknown> {
  const cleaned = cleanProductFields(product);
  if (product.variants && product.variants.length > 0) {
    cleaned.variants = product.variants.map(cleanProductFields);
  }
  return cleaned;
}
