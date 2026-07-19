import { EU_COUNTRY_CODES } from "@/constants/countries";

/**
 * @group Helpers
 * @groupDescription Supplier-agnostic purchase-restriction filtering: given a parsed
 * {@link PurchaseRestriction} (produced per-supplier, e.g. by the Synthetika parser) and
 * the user's location, decides whether a product or variant should be shown. Used to hide
 * products a user cannot legally or logistically purchase.
 * @source
 */

/**
 * Decides whether the current user may buy a single option (a product or one of its
 * variants) given their location. Region, EU-only, unresolved-delivery, and buyer
 * restrictions all exclude; a declaration-of-use requirement is informational and never
 * excludes. An option with no restriction is buyable. `euOnly` is checked against
 * {@link EU_COUNTRY_CODES} (the 27 EU member states), and an unknown user location is
 * treated as ineligible for the safe EU-only case.
 * @category Helpers
 * @param option - The product or variant to check
 * @param location - The user's ISO 3166-1 alpha-2 location code (may be undefined)
 * @returns True when the user may buy the option, false when it should be hidden
 * @example
 * ```typescript
 * canUserBuy({ purchaseRestriction: { excludedCountries: ["US"] } }, "US"); // false
 * canUserBuy({ purchaseRestriction: { euOnly: true } }, "PL"); // true
 * canUserBuy({ purchaseRestriction: { declarationOfUseRequired: true } }, "US"); // true
 * canUserBuy({}, "US"); // true
 * ```
 * @source
 */
export function canUserBuy(option: Variant, location?: string): boolean {
  const restriction = option.purchaseRestriction;
  if (!restriction) {
    return true;
  }
  if (restriction.excludedCountries?.some((code) => code === location)) {
    return false;
  }
  if (restriction.euOnly && (location === undefined || !EU_COUNTRY_CODES.has(location))) {
    return false;
  }
  if (restriction.restrictedDelivery) {
    return false;
  }
  if (restriction.buyerRestricted) {
    return false;
  }
  return true;
}

/**
 * Filters a grouped product against the user's location, hiding options they can't buy.
 * The parent product is one purchasable option and its `variants` are the others (they're
 * disjoint — `SupplierBase.groupVariants` splices the representative out of the
 * variant list). Restricted variants are pruned; if the representative itself is
 * restricted but a variant is buyable, the cheapest buyable variant is promoted into the
 * representative's sale fields (identity fields are kept). Returns undefined when no option
 * is buyable.
 * @category Helpers
 * @param product - The grouped product to filter
 * @param location - The user's ISO 3166-1 alpha-2 location code (may be undefined)
 * @returns The product with restricted variants pruned (or a promoted representative), or
 *   undefined when the user can't buy any option
 * @example
 * ```typescript
 * // Parent buyable, one variant excluded for US:
 * filterRestrictedProduct(product, "US"); // { ...product, variants: [buyableVariant] }
 * // Parent and every variant excluded:
 * filterRestrictedProduct(product, "US"); // undefined
 * ```
 * @source
 */
export function filterRestrictedProduct<T extends Product>(
  product: T,
  location?: string,
): T | undefined {
  const variants = product.variants ?? [];
  const buyableVariants = variants.filter((variant) => canUserBuy(variant, location));
  const parentBuyable = canUserBuy(product, location);

  if (!parentBuyable && buyableVariants.length === 0) {
    return undefined;
  }

  if (parentBuyable) {
    return variants.length > 0 ? { ...product, variants: buyableVariants } : product;
  }

  // Parent is restricted but a variant is buyable — promote the cheapest buyable variant
  // into the representative row, keeping the product's identity fields.
  const representative = [...buyableVariants].sort(
    (a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY),
  )[0];
  return {
    ...product,
    title: representative.title ?? product.title,
    price: representative.price ?? product.price,
    quantity: representative.quantity ?? product.quantity,
    uom: representative.uom ?? product.uom,
    url: representative.url ?? product.url,
    purchaseRestriction: representative.purchaseRestriction,
    variants: buyableVariants,
  };
}
