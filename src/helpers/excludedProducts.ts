import { CACHE } from "@/constants/common";
import { cstorage } from "@/utils/storage";
import { md5 } from "js-md5";

/**
 * Minimal metadata stored for each excluded product so the user can review
 * (and eventually un-exclude) their ignore list from settings.
 * @source
 */
export interface ExcludedProductEntry {
  /** Canonical product URL used to derive the exclusion key. */
  url: string;
  /** Supplier name used to derive the exclusion key. */
  supplier: string;
  /** Last-known product title, purely for display. */
  title?: string;
  /** Epoch ms at which the product was excluded. */
  excludedAt: number;
}

/**
 * Map of exclusion-key → excluded product entry, as persisted in
 * `chrome.storage.local[CACHE.EXCLUDED_PRODUCTS]`.
 * @source
 */
export type ExcludedProductsMap = Record<string, ExcludedProductEntry>;

export async function shouldExcludeProduct(url: string, supplierName: string): Promise<boolean> {
  try {
    const map = await loadExcludedProducts();
    const key = getProductExclusionKey(url, supplierName);
    console.log("exclusion key", { key, map, supplierName, url });
    return map[key] !== undefined;
  } catch (error) {
    console.warn("Failed to check if product should be excluded", { error });
    return false;
  }
}
async function getExcludedProductKeys(): Promise<Set<string>> {
  try {
    const map = await loadExcludedProducts();
    return new Set(Object.keys(map));
  } catch (error) {
    console.warn("Failed to get excluded product keys", { error });
    return new Set();
  }
}
/**
 * Derive the stable exclusion key for a product. This mirrors the key shape
 * used by `SupplierCache.getProductDataCacheKey` (see SupplierBase.ts line
 * 1337) so that exclusion checks performed inside the supplier's product
 * detail path can be compared against entries written from the UI context
 * menu without the two sides drifting.
 *
 * Uses `md5({ url, params: {}, supplier })` — identical to the no-params
 * branch of `getProductDataCacheKey`.
 *
 * @param url - Canonical product URL (same URL the supplier fetches).
 * @param supplierName - Supplier name, e.g. `"Loudwolf"`.
 * @returns MD5 hex digest used as the exclusion key.
 * @example
 * ```ts
 * const key = getProductExclusionKey(
 *   "https://example.com/acetone",
 *   "Loudwolf",
 * );
 * // → "a1b2c3..."
 * ```
 * @source
 */
export function getProductExclusionKey(url: string, supplierName: string): string {
  return md5(JSON.stringify({ url, params: {}, supplier: supplierName }));
}

/**
 * Load the excluded-products map from `chrome.storage.local`. Returns an
 * empty object if the key is missing or the read fails, so callers can treat
 * the result as always-valid.
 *
 * @returns The persisted exclusions map (never `null`/`undefined`).
 * @example
 * ```ts
 * const excluded = await loadExcludedProducts();
 * if (excluded[key]) {
 *   // product is ignored
 * }
 * ```
 * @source
 */
export async function loadExcludedProducts(): Promise<ExcludedProductsMap> {
  try {
    const data = await cstorage.local.get([CACHE.EXCLUDED_PRODUCTS]);
    const map = data[CACHE.EXCLUDED_PRODUCTS] as ExcludedProductsMap | undefined;
    return map ?? {};
  } catch (error) {
    console.warn("Failed to load excluded products from local storage:", { error });
    return {};
  }
}

/**
 * Load just the set of exclusion keys — convenient for hot-path membership
 * checks (e.g. inside `SupplierBase.getProductData`) where the full metadata
 * is not needed.
 *
 * @returns A `Set` of exclusion keys (empty on read failure).
 * @example
 * ```ts
 * const keys = await loadExcludedProductKeys();
 * if (keys.has(cacheKey)) return undefined; // skip this product
 * ```
 * @source
 */
export async function loadExcludedProductKeys(): Promise<Set<string>> {
  const map = await loadExcludedProducts();
  return new Set(Object.keys(map));
}

/**
 * Count how many excluded entries were ignored from a given supplier. Used by
 * `SupplierBase.execute` to over-fetch from `queryProducts` so that dropping
 * previously-ignored rows still leaves the caller with `limit` survivors
 * instead of a short list.
 *
 * @param supplierName - Supplier name to match against entry metadata.
 * @returns Count of entries whose `supplier` field equals `supplierName`.
 * @example
 * ```ts
 * const extra = await countExcludedProductsForSupplier("Loudwolf");
 * const results = await this.queryProductsWithCache(query, limit + extra);
 * ```
 * @source
 */
export async function countExcludedProductsForSupplier(supplierName: string): Promise<number> {
  const map = await loadExcludedProducts();
  let count = 0;
  for (const entry of Object.values(map)) {
    if (entry.supplier === supplierName) count++;
  }
  return count;
}

/**
 * Add a product to the excluded list in `chrome.storage.local`. Idempotent:
 * re-excluding an already-ignored product just refreshes its `excludedAt`
 * and last-known title. Returns the exclusion key for the caller's logging
 * convenience.
 *
 * @param url - Canonical product URL.
 * @param supplierName - Supplier name.
 * @param meta - Optional extra metadata (e.g. display title).
 * @returns The exclusion key that was written.
 * @example
 * ```ts
 * await addExcludedProduct(product.url, product.supplier, {
 *   title: product.title,
 * });
 * ```
 * @source
 */
export async function addExcludedProduct(
  url: string,
  supplierName: string,
  meta?: { title?: string },
): Promise<string> {
  const key = getProductExclusionKey(url, supplierName);
  try {
    const map = await loadExcludedProducts();
    map[key] = {
      url,
      supplier: supplierName,
      title: meta?.title,
      excludedAt: Date.now(),
    };
    await cstorage.local.set({ [CACHE.EXCLUDED_PRODUCTS]: map });
  } catch (error) {
    console.warn("Failed to persist excluded product to local storage:", { error });
  }
  return key;
}
