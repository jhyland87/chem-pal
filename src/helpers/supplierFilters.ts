/**
 * @group Helpers
 * @groupDescription Cross-filter compatibility between the advanced-search drawer's
 * supplier, shipping-type, and country filters — which suppliers a shipping/country
 * selection rules out, and which shipping/country options a supplier selection leaves
 * reachable. Pure functions over a supplier metadata map so the drawer UI and the
 * search can share (and unit-test) one source of truth.
 *
 * Shipping scope is a **hierarchy**, broadest to narrowest:
 * `worldwide ⊇ international ⊇ domestic ⊇ local`. A broader scope fulfills every
 * narrower request — a worldwide supplier can also ship internationally, domestically,
 * and locally; a domestic supplier can ship domestically and locally but not worldwide.
 * @source
 */

import { SHIPPING_OPTIONS, isShippingRange } from '@/constants/common';

/** One supplier's home country and coarse shipping scope. */
export interface SupplierShippingMeta {
  /** ISO 3166-1 alpha-2 home country. */
  country: CountryCode;
  /** Coarse shipping scope stamped onto the supplier's products. */
  shipping: ShippingRange;
}

/** Map of supplier class name → its {@link SupplierShippingMeta}. */
export type SupplierMetaMap = Readonly<Record<string, SupplierShippingMeta>>;

/** Rank of each shipping scope, broadest highest. A scope fulfills any lower-ranked one. */
const SHIPPING_SCOPE_RANK: Record<ShippingRange, number> = {
  local: 0,
  domestic: 1,
  international: 2,
  worldwide: 3,
};

/**
 * Whether a supplier's shipping scope fulfills a requested one, treating scope as a
 * hierarchy: a scope covers itself and every narrower scope (worldwide covers all,
 * local covers only local).
 * @category Helpers
 * @param supplierScope - The supplier's own shipping scope.
 * @param requested - The requested shipping scope to satisfy.
 * @returns True when `supplierScope` is equal to or broader than `requested`.
 * @example
 * ```ts
 * shippingCovers('worldwide', 'domestic'); // => true
 * shippingCovers('domestic', 'worldwide'); // => false
 * shippingCovers('domestic', 'local');     // => true
 * ```
 * @source
 */
export function shippingCovers(supplierScope: ShippingRange, requested: ShippingRange): boolean {
  return SHIPPING_SCOPE_RANK[supplierScope] >= SHIPPING_SCOPE_RANK[requested];
}

/**
 * The supplier class names ruled out by the active shipping-type and/or country
 * filters. A supplier is excluded when a non-empty shipping filter names no scope
 * its own scope can fulfill (per the {@link shippingCovers} hierarchy), or a
 * non-empty country filter doesn't list its country. An empty filter constrains
 * nothing.
 * @category Helpers
 * @param meta - Supplier shipping/country metadata (from `SupplierFactory.supplierShippingMeta`).
 * @param filters - The active `shippingType` and `country` selections.
 * @returns The set of supplier class names no result could satisfy under the filters.
 * @example
 * ```ts
 * suppliersExcludedBySearchFilters(
 *   { A: { country: 'US', shipping: 'worldwide' }, B: { country: 'US', shipping: 'domestic' } },
 *   { shippingType: ['worldwide'], country: [] },
 * ); // => Set { 'B' }  (domestic can't fulfill a worldwide request)
 * ```
 * @source
 */
export function suppliersExcludedBySearchFilters(
  meta: SupplierMetaMap,
  filters: { shippingType: readonly string[]; country: readonly string[] },
): Set<string> {
  const excluded = new Set<string>();
  const requestedScopes = filters.shippingType.filter(isShippingRange);
  const byShipping = requestedScopes.length > 0;
  const byCountry = filters.country.length > 0;
  if (!byShipping && !byCountry) return excluded;

  for (const [key, { country, shipping }] of Object.entries(meta)) {
    if (byShipping && !requestedScopes.some((requested) => shippingCovers(shipping, requested))) {
      excluded.add(key);
    } else if (byCountry && !filters.country.includes(country)) {
      excluded.add(key);
    }
  }
  return excluded;
}

/**
 * The shipping-type options the given suppliers can fulfill: every scope at or below
 * the broadest selected supplier's scope (per the {@link shippingCovers} hierarchy).
 * Used to decide which shipping options stay selectable — an option no selected
 * supplier can fulfill is disabled. Empty in ⇒ empty out (no supplier constraint).
 * @category Helpers
 * @param meta - Supplier shipping/country metadata.
 * @param suppliers - The currently selected supplier class names.
 * @returns The set of shipping scopes at least one selected supplier can fulfill.
 * @example
 * ```ts
 * fulfillableShippingRanges(
 *   { A: { country: 'US', shipping: 'domestic' } },
 *   ['A'],
 * ); // => Set { 'local', 'domestic' }
 * ```
 * @source
 */
export function fulfillableShippingRanges(
  meta: SupplierMetaMap,
  suppliers: readonly string[],
): Set<ShippingRange> {
  const fulfillable = new Set<ShippingRange>();
  for (const option of SHIPPING_OPTIONS) {
    const reachable = suppliers.some((key) => {
      const entry = meta[key];
      return entry !== undefined && shippingCovers(entry.shipping, option);
    });
    if (reachable) fulfillable.add(option);
  }
  return fulfillable;
}

/**
 * The distinct home countries of the given suppliers. Used to decide which
 * country options are still reachable: a country no selected supplier resides in
 * can be disabled. Empty in ⇒ empty out (no supplier constraint).
 * @category Helpers
 * @param meta - Supplier shipping/country metadata.
 * @param suppliers - The currently selected supplier class names.
 * @returns The set of country codes those suppliers reside in.
 * @example
 * ```ts
 * countriesForSuppliers(
 *   { A: { country: 'US', shipping: 'domestic' }, B: { country: 'DE', shipping: 'international' } },
 *   ['B'],
 * ); // => Set { 'DE' }
 * ```
 * @source
 */
export function countriesForSuppliers(
  meta: SupplierMetaMap,
  suppliers: readonly string[],
): Set<CountryCode> {
  const countries = new Set<CountryCode>();
  for (const key of suppliers) {
    const entry = meta[key];
    if (entry) countries.add(entry.country);
  }
  return countries;
}
