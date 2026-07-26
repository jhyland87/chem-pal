import * as v from 'valibot';

const searchItemImagesSchema = v.array(
  v.object({
    id: v.number(),
    src: v.string(),
    thumbnail: v.string(),
    srcset: v.string(),
    sizes: v.string(),
    thumbnail_srcset: v.string(),
    thumbnail_sizes: v.string(),
    name: v.string(),
    alt: v.string(),
  }),
);

const searchItemPricesSchema = v.object({
  price: v.string(),
  regular_price: v.string(),
  sale_price: v.string(),
  currency_code: v.string(),
  currency_symbol: v.string(),
  currency_minor_unit: v.number(),
  currency_decimal_separator: v.string(),
  currency_thousand_separator: v.string(),
  currency_prefix: v.string(),
  currency_suffix: v.string(),
  // The Store API returns price_range as { min_amount, max_amount } for
  // variable/grouped products. Fields are optional so a partial or evolving
  // shape can never reject the whole search response.
  price_range: v.optional(
    v.nullable(
      v.object({
        min_amount: v.optional(v.string()),
        max_amount: v.optional(v.string()),
      }),
    ),
  ),
});

const searchResponseItemSchema = v.object({
  id: v.number(),
  name: v.string(),
  type: v.string(),
  description: v.string(),
  short_description: v.string(),
  permalink: v.string(),
  is_in_stock: v.boolean(),
  sold_individually: v.boolean(),
  weight: v.optional(v.nullable(v.string())),
  formatted_weight: v.optional(v.nullable(v.string())),
  sku: v.string(),
  prices: searchItemPricesSchema,
  price_html: v.optional(v.nullable(v.string())),
  images: v.optional(v.nullable(searchItemImagesSchema)),
});

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
  return v.safeParse(searchResponseItemSchema, item).success;
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

  return !('variation' in product === false || typeof product.variation !== 'string');
}

const validProductVariantSchema = v.object({
  variation: v.string(),
  sku: v.string(),
  description: v.string(),
  variations: v.array(v.unknown()),
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
  return v.safeParse(validProductVariantSchema, response).success;
}
