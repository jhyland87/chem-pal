/**
 * @group Helpers
 * @groupDescription Product-domain predicates and image resolution shared by the
 * results table's expander column and its expanded detail panel.
 * @source
 */

import { omit } from '@/helpers/collectionUtils';
import { variantSeriesKey } from '@/helpers/priceHistory';
import { stripQuantityFromString } from '@/helpers/quantity';
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
 * thumbnail box and the (usually larger) source shown enlarged in the gallery
 * modal when the thumbnail is clicked.
 * @source
 */
export interface ResolvedProductImage {
  /** Image URL to render in the fixed-size thumbnail box. */
  thumbSrc: string;
  /** Image URL shown enlarged in the gallery modal when the thumbnail is clicked. */
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
  // Flattened variant rows (ungrouped mode) always have at least a parent link.
  if (product.parentProduct !== undefined) return true;
  return EXPANDABLE_DETAIL_KEYS.some((key) => isPresent(product[key]));
}

/** Keys stripped from copied product info — internal/derived noise. */
const NON_EXPORTED_PRODUCT_KEYS = ['currencySymbol', 'baseQuantity', 'cacheKey', '_id', 'parentProduct'];

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

/** Leading/trailing separator punctuation left behind after stripping a quantity. */
const EDGE_SEPARATORS = /^[\s,\-–—:;|]+|[\s,\-–—:;|]+$/g;

/**
 * Reports whether a variant represents the same purchasable unit as its parent
 * product — i.e. the supplier lists the parent among its own variants. Matches on
 * price-history identity first ({@link variantSeriesKey} folds in the genuine vs.
 * inherited id, then title/quantity/sku); some suppliers give the parent its own
 * id/sku that differs from the matching variant's, so it also matches when the two
 * are the same purchasable unit (see {@link samePurchasableUnit}).
 * @category Helpers
 * @param product - The parent product.
 * @param variant - The variant to test against the parent.
 * @returns `true` when the variant is the parent's own purchasable unit.
 * @example
 * ```ts
 * isParentPurchasableUnit(
 *   { title: "NaBH4", quantity: 50, uom: "g" } as Product,
 *   { quantity: 50, uom: "g" },
 * ); // => true
 * ```
 * @source
 */
export function isParentPurchasableUnit(product: Product, variant: Variant): boolean {
  const parentKey = variantSeriesKey(product, product);
  return (
    (parentKey !== undefined && variantSeriesKey(product, variant) === parentKey) ||
    samePurchasableUnit(product, variant)
  );
}

/**
 * Resolves the distinct purchasable units to show for a product: its variants,
 * with the parent product prepended unless a variant already represents the same
 * unit (see {@link isParentPurchasableUnit}), avoiding a duplicate row.
 * @category Helpers
 * @param product - The parent product.
 * @param variants - The variant list to consider, defaulting to `product.variants`.
 *   Callers with an active filter pass the filtered sub-row set instead.
 * @returns The parent-plus-variants list, deduplicated, in display order.
 * @example
 * ```ts
 * resolveDisplayedVariants({ title: "NaCl", quantity: 1, uom: "kg" } as Product);
 * // => [the product] (no variants)
 * ```
 * @source
 */
export function resolveDisplayedVariants(
  product: Product,
  variants: readonly Variant[] = product.variants ?? [],
): Variant[] {
  const parentAlreadyListed = variants.some((v) => isParentPurchasableUnit(product, v));
  return parentAlreadyListed ? [...variants] : [product, ...variants];
}

/**
 * Builds the display title for a flattened variant row. Some suppliers name a
 * variant with the full product name plus size (`"NaBH4, min 95%"`), others with
 * just the size (`"100g"`), which is meaningless as a standalone row title. When
 * the variant title doesn't already contain the product name, the product name
 * (with its own quantity stripped) is prepended. Both titles have their quantity
 * removed before the containment check, so `"Some Product 10g"` (parent) and
 * `"Some Product 100g"` (variant) still count as already-named and aren't doubled
 * up into `"Some Product 10g Some Product 100g"`.
 * @category Helpers
 * @param product - The parent product.
 * @param variant - The variant whose row title to build.
 * @returns The row title, with the product name prepended only when needed.
 * @example
 * ```ts
 * variantRowTitle({ title: "NaBH4, min 95%" } as Product, { title: "100g" });
 * // => "NaBH4, min 95% 100g"
 * variantRowTitle({ title: "Some Product 10g" } as Product, { title: "Some Product 100g" });
 * // => "Some Product 100g"
 * ```
 * @source
 */
export function variantRowTitle(product: Product, variant: Variant): string {
  const variantTitle = typeof variant.title === 'string' ? variant.title.trim() : '';
  const productTitle = typeof product.title === 'string' ? product.title.trim() : '';
  if (!variantTitle) return productTitle;

  const strippedParent = stripQuantityFromString(productTitle).replace(EDGE_SEPARATORS, '');
  if (!strippedParent) return variantTitle;

  const strippedVariant = stripQuantityFromString(variantTitle).replace(EDGE_SEPARATORS, '');
  if (strippedVariant.toLowerCase().includes(strippedParent.toLowerCase())) return variantTitle;

  return `${strippedParent} ${variantTitle}`;
}

/**
 * Flattens each product into standalone {@link Product} rows for the results
 * table's ungrouped display mode. Every product yields a **parent row** (the
 * product itself, keeping its `variants` so the detail panel can still list them)
 * plus one **variant row** per variant that isn't the parent's own purchasable
 * unit. Each variant row inherits the product's shared fields (CAS, formula,
 * images…) with the variant's own price/quantity/identity overlaid, carries a
 * {@link Product.parentProduct} back-reference, gets a disambiguated title (see
 * {@link variantRowTitle}), and drops the nested `variants` array so it stays a
 * leaf. Products without variants pass through unchanged. This is a presentational
 * transform only — it never mutates the inputs or the stored product data.
 * @category Helpers
 * @param products - The grouped product rows.
 * @returns The parent row plus one row per non-parent variant, per product.
 * @example
 * ```ts
 * flattenProductVariants([
 *   { title: "NaBH4", quantity: 50, uom: "g",
 *     variants: [{ quantity: 50, uom: "g" }, { title: "100g", quantity: 100, uom: "g" }] },
 * ] as Product[]);
 * // => [parent NaBH4 50g (with variants), variant "NaBH4 100g" (parentProduct set)]
 * ```
 * @source
 */
export function flattenProductVariants(products: readonly Product[]): Product[] {
  return products.flatMap((product) => {
    const variants = product.variants ?? [];
    if (variants.length === 0) return [product];

    const parentProduct = { title: product.title, url: product.url, permalink: product.permalink };
    const rows: Product[] = [product];
    for (const variant of variants) {
      if (isParentPurchasableUnit(product, variant)) continue;
      rows.push(
        omit(
          { ...product, ...variant, title: variantRowTitle(product, variant), parentProduct },
          'variants',
        ),
      );
    }
    return rows;
  });
}
