import { getProductIdentityKey } from "@/helpers/productIdentity";
import { getExcludedProducts, putExcludedProducts } from "@/utils/idbCache";

/**
 * Minimal metadata stored for each excluded product so the user can review
 * (and eventually un-exclude) their ignore list from settings.
 * @category Helpers
 * @source
 */
export interface ExcludedProductEntry {
  /**
   * Supplier's stable product identity (`SupplierBase.getUniqueProductKey`),
   * used with the supplier name to derive the exclusion key.
   */
  identity?: string;
  /** Canonical product URL, kept for display. */
  url?: string;
  /** Supplier name used to derive the exclusion key. */
  supplier: string;
  /** Last-known product title, purely for display. */
  title?: string;
  /** Epoch ms at which the product was excluded. */
  excludedAt: number;
}

/**
 * Map of exclusion-key → excluded product entry, as persisted in the
 * `excludedProducts` IndexedDB object store (via `@/utils/idbCache`).
 * @category Helpers
 * @source
 */
export type ExcludedProductsMap = Record<string, ExcludedProductEntry>;

/**
 * Load the excluded-products map from IndexedDB. Returns an empty object if
 * the store is empty or the read fails, so callers can treat the result as
 * always-valid.
 *
 * @category Helpers
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
  return getExcludedProducts();
}

/**
 * Load just the set of exclusion keys — convenient for hot-path membership
 * checks (e.g. inside `SupplierBase.getProductData`) where the full metadata
 * is not needed.
 *
 * @category Helpers
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
 * @category Helpers
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
 * Add a product to the excluded list in IndexedDB, keyed by the supplier's
 * stable product identity ({@link getProductIdentityKey}) — the same key that
 * keys the product-detail cache. Idempotent: re-excluding an already-ignored
 * product just refreshes its `excludedAt` and last-known title. Returns the
 * exclusion key for the caller's logging convenience.
 *
 * @category Helpers
 * @param identity - The product's unique identity (its `cacheKey`), or the URL
 *   as a fallback when no identity was stamped.
 * @param supplierName - Supplier name.
 * @param meta - Optional extra metadata: display title and canonical URL (kept
 *   for display and legacy-key matching).
 * @returns The exclusion key that was written.
 * @example
 * ```ts
 * await addExcludedProduct(product.cacheKey ?? product.url, product.supplier, {
 *   title: product.title,
 *   url: product.url,
 * });
 * ```
 * @source
 */
export async function addExcludedProduct(
  identity: string,
  supplierName: string,
  meta?: { title?: string; url?: string },
): Promise<string> {
  const key = getProductIdentityKey(identity, supplierName);
  try {
    const map = await loadExcludedProducts();
    map[key] = {
      identity,
      url: meta?.url,
      supplier: supplierName,
      title: meta?.title,
      excludedAt: Date.now(),
    };
    await putExcludedProducts(map);
  } catch (error) {
    console.warn("Failed to persist excluded product to IndexedDB:", { error });
  }
  return key;
}

/**
 * Remove a single entry from the excluded-products map in IndexedDB.
 * Load → delete → put, matching `addExcludedProduct`'s read-modify-write
 * shape so a caller holding a stale map cannot clobber concurrent writes.
 * No-op (and no write) when the key is absent, so repeated removals are
 * safe. Errors are logged, not thrown — callers don't need to try/catch.
 * @category Helpers
 * @param key - Exclusion key, as produced by `getProductExclusionKey`.
 * @returns Resolves once the write completes.
 * @example
 * ```ts
 * const key = getProductExclusionKey(product.url, product.supplier);
 * await removeExcludedProduct(key);
 * // entry for `key` is gone from IndexedDB; next search may surface the
 * // product again (subject to any cached supplier results).
 * ```
 * @source
 */
export async function removeExcludedProduct(key: string): Promise<void> {
  try {
    const map = await loadExcludedProducts();
    if (map[key] === undefined) return;
    delete map[key];
    await putExcludedProducts(map);
  } catch (error) {
    console.warn("Failed to remove excluded product from IndexedDB:", { error });
  }
}
