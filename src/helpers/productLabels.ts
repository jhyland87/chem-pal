import { isShippingRange } from "@/constants/common";
import { i18n } from "@/helpers/i18n";
import { isAvailability } from "@/utils/typeGuards/productbuilder";

/**
 * Localized label for a supplier {@link ShippingRange} (worldwide/international/
 * domestic/local). Falls back to the raw value for anything outside the known set.
 * @param range - The shipping range value.
 * @returns The translated label, or the raw value if unrecognized.
 * @example
 * ```ts
 * shippingLabel("worldwide"); // => "Worldwide" (en) / "Ogólnoświatowa" (pl)
 * ```
 * @category Helpers
 * @source
 */
export function shippingLabel(range: string): string {
  return isShippingRange(range) ? i18n(`shipping_${range}`) : range;
}

/**
 * Localized label for an {@link AVAILABILITY} value. Also covers the drawer's
 * grouped filter codes (`in_stock`, `out_of_stock`, …), which are a subset of the
 * enum values. Falls back to the raw value for anything outside the known set.
 * @param value - The availability value.
 * @returns The translated label, or the raw value if unrecognized.
 * @example
 * ```ts
 * availabilityLabel("in_stock"); // => "In Stock" (en) / "Dostępny" (pl)
 * ```
 * @category Helpers
 * @source
 */
export function availabilityLabel(value: string): string {
  return isAvailability(value) ? i18n(`availability_${value}`) : value;
}
