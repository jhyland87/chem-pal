import { AVAILABILITY } from "@/constants/common";
import type { Variant } from "@/types";
/**
 * Type guard to validate if a value is a valid availability status.
 * Checks if the value is a string that matches one of the predefined AVAILABILITY enum values.
 *
 * @param availability - The value to check
 * @returns Type predicate indicating if the value is a valid AVAILABILITY enum value
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid availability values
 * if (isAvailability('IN_STOCK')) {
 *   console.log('Product is in stock');
 * }
 * if (isAvailability('OUT_OF_STOCK')) {
 *   console.log('Product is out of stock');
 * }
 *
 * // Invalid availability values
 * if (!isAvailability('available')) {
 *   console.log('Invalid availability status');
 * }
 * if (!isAvailability(123)) {
 *   console.log('Availability must be a string');
 * }
 * ```
 */
export function isAvailability(availability: unknown): availability is AVAILABILITY {
  return (
    typeof availability === "string" &&
    Object.values(AVAILABILITY).includes(availability as AVAILABILITY)
  );
}

/**
 * Type guard to validate if a value is a valid product variant.
 * Checks for the presence and correct types of variant properties.
 * A variant can be partial as it may inherit some properties from the parent product
 * (such as uom, currency, URL, etc.).
 *
 * @param variant - The variant object to validate
 * @returns Type predicate indicating if the value is a valid partial Variant
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid variant with all properties
 * const completeVariant = {
 *   title: "Sodium Chloride 500g",
 *   price: 29.99,
 *   quantity: 500
 * };
 * if (isValidVariant(completeVariant)) {
 *   console.log('Valid complete variant:', completeVariant.title);
 * }
 *
 * // Valid partial variant (inheriting some properties from parent)
 * const partialVariant = {
 *   price: 39.99,
 *   quantity: 1000
 *   // title and other properties inherited from parent product
 * };
 * if (isValidVariant(partialVariant)) {
 *   console.log('Valid partial variant');
 * }
 *
 * // Invalid variant (wrong types)
 * const invalidVariant = {
 *   title: "Sodium Chloride",
 *   price: "29.99", // Should be number
 *   quantity: "500"  // Should be number
 * };
 * if (!isValidVariant(invalidVariant)) {
 *   console.log('Invalid variant - wrong property types');
 * }
 *
 * // Invalid variant (null/undefined)
 * if (!isValidVariant(null)) {
 *   console.log('Invalid variant - null value');
 * }
 * ```
 */
export function isValidVariant(variant: unknown): variant is Partial<Variant> {
  if (!variant || typeof variant !== "object") return false;

  // Check that any numeric properties are actually numbers
  const numericProps = ["price", "quantity"];
  for (const prop of numericProps) {
    if (prop in variant && typeof variant[prop as keyof typeof variant] !== "number") {
      return false;
    }
  }

  // Check that any string properties are actually strings
  const stringProps = ["title"];
  for (const prop of stringProps) {
    if (prop in variant && typeof variant[prop as keyof typeof variant] !== "string") {
      return false;
    }
  }

  return true;
}
