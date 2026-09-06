import { shipsToCountry } from '@/helpers/shipping';
import { SUPPLIER_META } from './supplierMeta.generated';

/**
 * Accessors over the generated supplier metadata registry — supplier display names,
 * home countries and shipping scopes, readable **without loading a single supplier
 * implementation**.
 *
 * The supplier classes are the single source of truth; `SUPPLIER_META` is extracted
 * from their `static` fields at build time by `tools/generate-supplier-meta.js`
 * (`pnpm run generate`, which runs as `prebuild`). Nothing here is hand-maintained,
 * and adding a supplier means editing only its class and the barrel.
 *
 * The indirection exists because reading a class static means *evaluating* that
 * supplier module, and with it SupplierBase's zod/fuzzball/liqe/graphql stack — which
 * is what used to keep the whole supplier layer in the popup's startup bundle, for a
 * results table, column drawer and search hook that need metadata (never a search) at
 * mount. Runtime-derived metadata deliberately stays on the classes: `requiredHosts`
 * is computed from `baseURL`/`apiURL`, and for the Amazon-backed suppliers `baseURL`
 * depends on the user's locale, so it could not be extracted as a literal.
 *
 * @module supplierMeta
 * @category Constants
 * @group Suppliers
 * @source
 */

export { SUPPLIER_META };

/**
 * Display and shipping metadata for one supplier — the subset of a supplier class's
 * `static` fields the UI needs before any search has run.
 * @category Constants
 * @group Suppliers
 * @source
 */
export interface SupplierMetaEntry {
  /** Human-readable supplier name, mirroring the class's `static supplierName`. */
  readonly displayName: string;
  /** The supplier's home country (ISO 3166-1 alpha-2). */
  readonly country: CountryCode;
  /** The supplier's coarse shipping scope. */
  readonly shipping: ShippingRange;
  /** Explicit destination allowlist; overrides {@link SupplierMetaEntry.shipping} when set. */
  readonly shipsTo?: readonly CountryCode[];
}

/**
 * Supplier class names mapped to their human-readable display names — the shape the
 * results-table filter and the stats panel want.
 * @returns Record mapping supplier class names to their display names.
 * @example
 * ```ts
 * supplierDisplayNames().SupplierCarolina; // => "Carolina"
 * ```
 * @category Constants
 * @group Suppliers
 * @source
 */
export function supplierDisplayNames(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(SUPPLIER_META).map(([key, meta]) => [key, meta.displayName]),
  );
}

/**
 * Supplier class names mapped to their home country and shipping scope — the fields
 * the drawer's shipping/country filters reason about.
 * @returns Record mapping supplier class names to `{ country, shipping }`.
 * @example
 * ```ts
 * supplierShippingMeta().SupplierCarolina; // => { country: "US", shipping: "domestic" }
 * ```
 * @category Constants
 * @group Suppliers
 * @source
 */
export function supplierShippingMeta(): Record<
  string,
  { country: CountryCode; shipping: ShippingRange }
> {
  return Object.fromEntries(
    Object.entries(SUPPLIER_META).map(([key, meta]) => [
      key,
      { country: meta.country, shipping: meta.shipping },
    ]),
  );
}

/**
 * Supplier class names mapped to whether they ship to `location`, so the UI can grey
 * out suppliers that can't reach the user. Applies the same `shipsTo`/scope heuristic
 * as search time — both go through {@link shipsToCountry}.
 * @param location - The user's location as an ISO 3166-1 alpha-2 country code.
 * @returns Record mapping supplier class names to a ships-to boolean.
 * @example
 * ```ts
 * supplierShipsTo('US').SupplierWarchem; // => false
 * ```
 * @category Constants
 * @group Suppliers
 * @source
 */
export function supplierShipsTo(location: CountryCode): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(SUPPLIER_META).map(([key, meta]) => [key, shipsToCountry(meta, location)]),
  );
}
