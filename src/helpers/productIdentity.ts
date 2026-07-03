import { md5 } from "js-md5";

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
