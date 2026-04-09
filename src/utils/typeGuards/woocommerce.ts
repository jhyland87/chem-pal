import { z } from "zod";

/* eslint-disable @typescript-eslint/naming-convention */
const searchResponseItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  description: z.string(),
  short_description: z.string(),
  permalink: z.string(),
  is_in_stock: z.boolean(),
  sold_individually: z.boolean(),
  sku: z.string(),
  prices: z.object({
    price: z.string(),
    regular_price: z.string(),
    sale_price: z.string(),
    currency_code: z.string(),
    currency_symbol: z.string(),
    currency_minor_unit: z.number(),
    currency_decimal_separator: z.string(),
    currency_thousand_separator: z.string(),
    currency_prefix: z.string(),
    currency_suffix: z.string(),
  }),
});
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Type guard to validate if an unknown object is a valid SearchResponseItem from WooCommerce.
 * Checks for the presence and correct types of all required properties including nested price information.
 *
 * @category Typeguards
 * @param item - Object to validate
 * @returns Type predicate indicating if the object is a valid SearchResponseItem
 * @example
 * ```typescript
 * // Valid search response item
 * const validItem = {
 *   id: 123,
 *   name: "Sodium Chloride",
 *   type: "simple",
 *   description: "High purity NaCl",
 *   short_description: "NaCl",
 *   permalink: "/product/sodium-chloride",
 *   is_in_stock: true,
 *   sold_individually: false,
 *   sku: "NACL-500",
 *   prices: {
 *     price: "29.99",
 *     regular_price: "34.99",
 *     sale_price: "29.99",
 *     currency_code: "USD",
 *     currency_symbol: "$",
 *     currency_minor_unit: 2,
 *     currency_decimal_separator: ".",
 *     currency_thousand_separator: ",",
 *     currency_prefix: "$",
 *     currency_suffix: ""
 *   }
 * };
 *
 * if (isSearchResponseItem(validItem)) {
 *   console.log('Valid item:', validItem.name);
 *   console.log('Price:', validItem.prices.price);
 * }
 * ```
 * @source
 */
export function isSearchResponseItem(item: unknown): item is WooCommerceSearchResponseItem {
  return searchResponseItemSchema.safeParse(item).success;
}

/**
 * Type guard to validate if an unknown value is a valid WooCommerce SearchResponse.
 * Checks if the value is an array and all items are valid SearchResponseItems.
 *
 * @category Typeguards
 * @param response - Value to validate
 * @returns Type predicate indicating if the value is a valid SearchResponse
 * @example
 * ```typescript
 * // Valid search response
 * const validResponse = [
 *   {
 *     id: 123,
 *     name: "Sodium Chloride",
 *     type: "simple",
 *     // ... other required properties
 *     prices: { price: "29.99", currency_code: "USD" }
 *   }
 * ];
 *
 * if (isSearchResponse(validResponse)) {
 *   console.log('Valid search response with', validResponse.length, 'items');
 * }
 * ```
 * @source
 */
export function isSearchResponse(response: unknown): response is WooCommerceSearchResponse {
  if (!Array.isArray(response)) {
    return false;
  }

  return response.every((item) => isSearchResponseItem(item));
}

/**
 * Type guard to validate if an unknown object is a valid WooCommerce WooCommerceProductVariant.
 * Checks if the object is a valid SearchResponseItem and has the required variant properties.
 *
 * @category Typeguards
 * @param product - Object to validate
 * @returns Type predicate indicating if the object is a valid WooCommerceProductVariant
 * @example
 * ```typescript
 * // Valid product variant
 * const validVariant = {
 *   id: 123,
 *   name: "Sodium Chloride 500g",
 *   type: "variation",
 *   variation: "500g",
 *   // ... other required SearchResponseItem properties
 * };
 *
 * if (isProductVariant(validVariant)) {
 *   console.log('Valid variant:', validVariant.variation);
 * }
 * ```
 * @source
 */
export function isProductVariant(product: unknown): product is WooCommerceProductVariant {
  if (!isSearchResponseItem(product)) {
    return false;
  }

  return !("variation" in product === false || typeof product.variation !== "string");
}

const validProductVariantSchema = z.object({
  variation: z.string(),
  sku: z.string(),
  description: z.string(),
  variations: z.array(z.unknown()),
});

/**
 * Type guard to validate if a product response contains all required variant information.
 * Extends the basic WooCommerceProductVariant validation with additional required properties for complete variant data.
 *
 * @category Typeguards
 * @param response - Object to validate
 * @returns Type predicate indicating if the response is a valid and complete WooCommerceProductVariant
 * @example
 * ```typescript
 * // Valid complete product variant
 * const completeVariant = {
 *   id: 123,
 *   name: "Sodium Chloride 500g",
 *   type: "variation",
 *   variation: "500g",
 *   sku: "NACL-500",
 *   description: "High purity sodium chloride, 500g",
 *   variations: ["250g", "500g", "1000g"],
 *   // ... other required SearchResponseItem properties
 * };
 *
 * if (isValidProductVariant(completeVariant)) {
 *   console.log('Valid complete variant:', completeVariant.variation);
 *   console.log('Available variations:', completeVariant.variations);
 * }
 * ```
 * @source
 */
export function isValidProductVariant(response: unknown): response is WooCommerceProductVariant {
  if (!isProductVariant(response)) {
    return false;
  }
  return validProductVariantSchema.safeParse(response).success;
}
