/**
 * Shipping-destination logic, split out of `SupplierBase` so the UI can answer
 * "does this supplier ship to me?" without importing the supplier layer. The
 * module deliberately has **no imports**: it is reached from the results table and
 * the column drawer, which mount before any search has run.
 *
 * @module shipping
 * @category Country Helpers
 * @group Suppliers
 * @source
 */

/**
 * The shipping fields a supplier exposes — either as `static` class members
 * (`SupplierStaticMeta`) or as an entry in `SUPPLIER_META`. Accepts a readonly
 * `shipsTo` so both shapes satisfy it.
 * @category Country Helpers
 * @group Suppliers
 * @source
 */
export interface ShippingMeta {
  /** The supplier's coarse shipping scope. */
  readonly shipping: ShippingRange;
  /** The supplier's home country (ISO 3166-1 alpha-2). */
  readonly country: CountryCode;
  /** Optional explicit destination allowlist; overrides {@link ShippingMeta.shipping} when set. */
  readonly shipsTo?: readonly CountryCode[];
}

/**
 * Whether a supplier with the given shipping metadata ships to `location`. Prefers
 * the explicit `shipsTo` allowlist when the supplier declares one; otherwise falls
 * back to the coarse `shipping` scope — `"worldwide"`/`"international"` ship
 * anywhere, while `"domestic"`/`"local"` ship only within the supplier's own
 * `country`.
 * @param meta - The supplier's shipping/country/`shipsTo` metadata.
 * @param location - Destination country (ISO 3166-1 alpha-2).
 * @returns True when the supplier ships to `location`.
 * @example
 * ```ts
 * shipsToCountry({ shipping: 'domestic', country: 'US' }, 'DE'); // => false
 * shipsToCountry({ shipping: 'domestic', country: 'US', shipsTo: ['US', 'CA'] }, 'CA'); // => true
 * ```
 * @category Country Helpers
 * @group Suppliers
 * @source
 */
export function shipsToCountry(meta: ShippingMeta, location: CountryCode): boolean {
  if (meta.shipsTo) {
    return meta.shipsTo.includes(location);
  }
  switch (meta.shipping) {
    case 'worldwide':
    case 'international':
      return true;
    case 'domestic':
    case 'local':
      return meta.country === location;
    default:
      return true;
  }
}
