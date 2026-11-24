/**
 * Updates cached copies of one product after it was refetched on its own.
 *
 * @module
 * @category Helpers
 * @group Price Alerts
 */
import { omit } from '@/helpers/collectionUtils';
import { productSeriesKey } from '@/helpers/priceHistory';
import { samePurchasableUnit } from '@/helpers/product';
import {
  getAllSupplierQueryCacheEntries,
  getSearchResultsRecord,
  getSupplierProductDataCacheEntry,
  putSupplierProductDataCacheEntry,
  putSupplierQueryCacheEntry,
  setSearchResults,
} from '@/utils/idbCache';
import { isCachedProductData, isValidVariant } from '@/utils/typeGuards/productbuilder';

/** The fields a refetch may change. Everything else (CAS, SDS, match scores…) is left alone. */
const PRICE_FIELDS = ['price', 'currencyCode', 'currencySymbol', 'availability'] as const;

/** Prices worked out when a product is built. Cached listings are stored before that. */
const BUILT_PRICE_FIELDS = ['usdPrice', 'localPrice'] as const;

/** The headline's pack size. */
const SIZE_FIELDS = ['quantity', 'uom'] as const;

/** The pack size worked out when a product is built, used for sorting. */
const BUILT_SIZE_FIELDS = ['baseQuantity', 'baseUom'] as const;

/**
 * Copies the named fields that are set.
 * @param source - The object to read
 * @param fields - The fields to copy
 * @returns The fields that aren't undefined
 * @example
 * ```ts
 * pickDefined({ price: 9, availability: undefined }, ['price', 'availability']); // { price: 9 }
 * ```
 * @source
 */
function pickDefined<T extends object, K extends keyof T>(
  source: T,
  fields: readonly K[],
): Partial<T> {
  const picked: Partial<T> = {};
  for (const field of fields) {
    if (source[field] !== undefined) picked[field] = source[field];
  }
  return picked;
}

/**
 * Finds the fresh size that a cached size corresponds to: by id, then SKU, then pack size. Only an
 * unambiguous match counts, because sizes inherit missing ids and SKUs from their product.
 * @param variants - The fresh sizes
 * @param cached - The cached size
 * @returns The fresh size, or undefined when none or several match
 * @example
 * ```ts
 * findMatchingVariant([{ id: 1, price: 9 }, { id: 2, price: 20 }], { id: 2 }); // { id: 2, price: 20 }
 * ```
 * @source
 */
function findMatchingVariant(
  variants: readonly Variant[],
  cached: Partial<Variant>,
): Variant | undefined {
  const matchers: Array<(variant: Variant) => boolean> = [
    ({ id }) => id !== undefined && String(id) === String(cached.id),
    ({ sku }) => sku !== undefined && String(sku) === String(cached.sku),
    (variant) => samePurchasableUnit(variant, cached),
  ];
  for (const matches of matchers) {
    const found = variants.filter(matches);
    if (found.length === 1) return found[0];
  }
  return undefined;
}

/**
 * Replaces the prices of a cached product or size.
 * @param cached - The cached copy
 * @param fresh - The refetched product or size
 * @param isBuilt - Whether the copy is a finished product; see {@link mergeFreshPrices}
 * @returns The copy with fresh prices
 * @example
 * ```ts
 * mergePrices({ sku: 'A-1', price: 24, usdPrice: 24 }, { price: 19.5, usdPrice: 19.5 }, false);
 * // { sku: 'A-1', price: 19.5 }
 * ```
 * @source
 */
function mergePrices<T extends Partial<Variant>>(
  cached: T,
  fresh: Partial<Variant>,
  isBuilt: boolean,
) {
  return isBuilt
    ? { ...cached, ...pickDefined(fresh, [...PRICE_FIELDS, ...BUILT_PRICE_FIELDS]) }
    : { ...omit(cached, [...BUILT_PRICE_FIELDS]), ...pickDefined(fresh, PRICE_FIELDS) };
}

/**
 * Merges fresh prices into a cached copy. Cached sizes without a fresh match are kept as they are.
 * @param cached - The cached copy
 * @param fresh - The refetched product
 * @param isBuilt - Whether the copy is a finished product (search results) rather than a cached
 * listing, whose USD price is worked out when it is loaded
 * @returns The merged copy
 * @example
 * ```ts
 * mergeFreshPrices({ title: 'Acetone', cas: '67-64-1', price: 24 }, fresh, false);
 * // { title: 'Acetone', cas: '67-64-1', price: 19.5 }
 * ```
 * @source
 */
function mergeFreshPrices<T extends Partial<Product>>(cached: T, fresh: Product, isBuilt: boolean) {
  const freshVariants = fresh.variants ?? [];
  const variants = cached.variants?.map((variant) => {
    const match = isValidVariant(variant) && findMatchingVariant(freshVariants, variant);
    return match ? mergePrices(variant, match, isBuilt) : variant;
  });
  return {
    ...mergePrices(cached, fresh, isBuilt),
    // The headline can move to another pack size, so its size follows its price.
    ...pickDefined(fresh, SIZE_FIELDS),
    ...(isBuilt && pickDefined(fresh, BUILT_SIZE_FIELDS)),
    ...(variants && { variants }),
  };
}

/**
 * Updates every cached copy of one product with its fresh prices: the product-data cache, the cached
 * search listings it appears in, and the results on screen. Other cached data and cache ages are left
 * alone, so this doesn't extend how long a search stays cached.
 * @category Helpers
 * @group Price Alerts
 * @param fresh - The refetched product
 * @returns Resolves once the caches are updated
 * @example
 * ```ts
 * await patchCachedProduct(result.product);
 * ```
 * @source
 */
export async function patchCachedProduct(fresh: Product): Promise<void> {
  const key = productSeriesKey(fresh);
  if (key === undefined) return;

  // The product-data cache is keyed by the same supplier + identity hash.
  const cached = await getSupplierProductDataCacheEntry(key);
  if (cached && isCachedProductData(cached.data)) {
    await putSupplierProductDataCacheEntry(key, {
      ...cached,
      data: mergeFreshPrices(cached.data, fresh, false),
    });
  }

  for (const { cacheKey, ...entry } of await getAllSupplierQueryCacheEntries()) {
    if (entry.__cacheMetadata.supplier !== fresh.supplier) continue;
    const isCopy = (row: unknown): row is Partial<Product> =>
      isCachedProductData(row) && row.cacheKey === fresh.cacheKey;
    if (!entry.data.some(isCopy)) continue;
    await putSupplierQueryCacheEntry(cacheKey, {
      ...entry,
      data: entry.data.map((row) => (isCopy(row) ? mergeFreshPrices(row, fresh, false) : row)),
    });
  }

  const results = await getSearchResultsRecord();
  if (!results.data.some((row) => productSeriesKey(row) === key)) return;
  await setSearchResults(
    results.data.map((row) =>
      productSeriesKey(row) === key ? mergeFreshPrices(row, fresh, true) : row,
    ),
    results.query,
  );
}
