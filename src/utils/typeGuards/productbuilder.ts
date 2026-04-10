import { AVAILABILITY } from "@/constants/common";
import { z } from "zod";

const availabilityValues = Object.values(AVAILABILITY) as [AVAILABILITY, ...AVAILABILITY[]];

// Zod schema that accepts any string whose lowercased form matches an `AVAILABILITY`
// enum value. Non-string inputs are rejected outright.
const availabilitySchema = z.preprocess(
  (v) => (typeof v === "string" ? v.toLowerCase() : v),
  z.enum(availabilityValues),
);

// Zod schema for the subset of `Variant` fields that are type-checked here. All
// fields are optional because a variant may inherit values from its parent product.
// `looseObject` preserves (and does not reject) any additional keys the caller includes.
const variantSchema = z.looseObject({
  title: z.string().optional(),
  price: z.number().optional(),
  quantity: z.number().optional(),
});

/**
 * Type guard to validate if a value is a valid availability status.
 * Checks if the value is a string that matches one of the predefined AVAILABILITY enum values.
 * Matching is case-insensitive — input is lowercased before comparison.
 * @param availability - The value to check
 * @returns Type predicate indicating if the value is a valid AVAILABILITY enum value
 * @category Typeguards
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
 * @source
 */
export function isAvailability(availability: unknown): availability is AVAILABILITY {
  return availabilitySchema.safeParse(availability).success;
}

/**
 * Type guard to validate if a value is a valid product variant.
 * Checks for the presence and correct types of variant properties.
 * A variant can be partial as it may inherit some properties from the parent product
 * (such as uom, currency, URL, etc.).
 * @param variant - The variant object to validate
 * @returns Type predicate indicating if the value is a valid partial Variant
 * @category Typeguards
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
 * @source
 */
export function isValidVariant(variant: unknown): variant is Partial<Variant> {
  return variantSchema.safeParse(variant).success;
}
