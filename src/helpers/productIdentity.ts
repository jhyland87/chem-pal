import { md5 } from 'js-md5';

/**
 * Derive the stable per-product cache/exclusion key from a supplier-defined
 * identity and the supplier name. Both the product-detail cache
 * (`SupplierCache.getProductIdentityCacheKey`) and the exclusion store
 * (`addExcludedProduct`) route through this one function, so a product's cache
 * entry and its exclusion entry share the same key by construction.
 *
 * The `{ key, supplier }` shape is intentionally distinct from the legacy
 * URL-based product-data key (`md5({ url, params, supplier })`), so entries
 * written under the old scheme never alias a new identity key.
 *
 * @category Helpers
 * @param identity - The supplier's unique product identity (id, uuid, sku,
 *   gid, or href), as returned by `SupplierBase.getUniqueProductKey`.
 * @param supplierName - Supplier name, e.g. `"Loudwolf"`, mixed in so two
 *   suppliers that happen to share an identity string never collide.
 * @returns MD5 hex digest used as the cache/exclusion key.
 * @example
 * ```ts
 * getProductIdentityKey("FAM_889460", "Carolina");
 * // => "3f9c2a…" (stable for the same identity + supplier)
 * ```
 * @source
 */
export function getProductIdentityKey(identity: string, supplierName: string): string {
  return md5(JSON.stringify({ key: identity, supplier: supplierName }));
}

/**
 * Derive a supplier-scoped dedupe key for a product, used to drop the same
 * product appearing more than once in a single search's result set. Prefers the
 * supplier-stable `cacheKey`, then `id`, `uuid`, and finally `url`, all mixed
 * with the supplier name so two suppliers that share an identity string (e.g. a
 * numeric `id` like `6981`) never collide. Returns `undefined` when the product
 * carries no usable identity, so callers keep it rather than merging unknowns.
 * @category Helpers
 * @param product - The product to key.
 * @returns A stable dedupe key, or `undefined` when no identity is available.
 * @example
 * ```ts
 * getProductDedupeKey({ supplier: "Carolina Chemical", cacheKey: "6981" }); // "3f9c2a…"
 * getProductDedupeKey({ supplier: "ACME" }); // undefined (no identity)
 * ```
 * @source
 */
export function getProductDedupeKey(product: Product): string | undefined {
  const identity =
    product.cacheKey ??
    (product.id != null ? String(product.id) : undefined) ??
    (product.uuid != null ? String(product.uuid) : undefined) ??
    product.url;
  if (!identity) return undefined;
  return getProductIdentityKey(identity, product.supplier ?? '');
}

/**
 * Remove duplicate products from a result set, keeping the first occurrence of
 * each identity as determined by {@link getProductDedupeKey}. Products with no
 * usable identity are always kept (never merged with each other). Order is
 * preserved.
 * @category Helpers
 * @param products - The products to de-duplicate.
 * @returns A new array with later duplicates of each product identity removed.
 * @example
 * ```ts
 * dedupeProducts([
 *   { supplier: "Carolina Chemical", cacheKey: "6981" },
 *   { supplier: "Carolina Chemical", cacheKey: "6981" },
 * ]).length; // 1
 * ```
 * @source
 */
export function dedupeProducts(products: readonly Product[]): Product[] {
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const product of products) {
    const key = getProductDedupeKey(product);
    if (key !== undefined) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(product);
  }
  return result;
}
