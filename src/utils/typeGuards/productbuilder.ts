import { AVAILABILITY } from "@/constants/common";
import { z } from "zod";

// `z.enum` requires a non-empty tuple type, which `Object.values` (typed as a plain
// array) cannot express. The enum always has at least one member, so the cast is safe.
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

// Zod schema for a `ProductImage` entry: a string `href` and a `type` that is
// either "image" or "thumbnail". `altText` is optional. `looseObject` preserves
// any extra keys. The `href` is validated for shape only (a string); the builder
// resolves it to an absolute URL afterwards.
const productImageSchema = z.looseObject({
  href: z.string(),
  type: z.enum(["image", "thumbnail"]),
  altText: z.string().optional(),
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

/**
 * Type guard to validate if a value is a valid product image entry.
 * Checks for a string `href` and a `type` of either "image" or "thumbnail".
 * The `href` is only shape-checked here; the builder resolves it to an absolute
 * URL (and drops the entry when it can't).
 * @param value - The value to check
 * @returns Type predicate indicating if the value is a valid ProductImage
 * @category Typeguards
 * @example
 * ```typescript
 * // Valid image entry
 * if (isProductImage({ href: "https://example.com/a.jpg", type: "image" })) {
 *   console.log('Valid product image');
 * }
 *
 * // Invalid — unknown type
 * if (!isProductImage({ href: "https://example.com/a.jpg", type: "banner" })) {
 *   console.log('Not a valid product image');
 * }
 *
 * // Invalid — missing href
 * if (!isProductImage({ type: "thumbnail" })) {
 *   console.log('Not a valid product image');
 * }
 * ```
 * @source
 */
export function isProductImage(value: unknown): value is ProductImage {
  return productImageSchema.safeParse(value).success;
}

/**
 * Type guard for a cached product-data record — the plain object produced by
 * `ProductBuilder.dump()` and round-tripped through the product-detail cache.
 * Narrows an `unknown` (or `Record<string, unknown>`) cache read to `Partial<T>`
 * so it can be handed to `ProductBuilder.setData` without an assertion.
 *
 * The check is intentionally structural (a non-null, non-array object) rather
 * than a full-schema validation: `setData` already routes every key through its
 * own validating setter and silently drops any field that fails, so validating
 * individual fields here would only risk rejecting an otherwise-usable product.
 *
 * @param value - The value read back from the product-detail cache
 * @returns Type predicate indicating the value is a `Partial<T>` record
 * @category Typeguards
 * @example
 * ```typescript
 * const cached = await this.cache.getCachedProductData(key);
 * if (isCachedProductData<Product>(cached)) {
 *   product.setData(cached); // cached is Partial<Product>
 * }
 * ```
 * @source
 */
export function isCachedProductData<T extends Product = Product>(
  value: unknown,
): value is Partial<T> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
