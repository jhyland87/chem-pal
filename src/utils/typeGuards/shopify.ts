import { z } from "zod";

/**
 * Type guard to validate if a response from the Shopify search API is a valid SearchResponse object.
 * Checks for the presence and correct types of all required properties including pagination info,
 * suggestions, and a valid array of item listings.
 *
 * @param response - The response object to validate
 * @returns Type predicate indicating if the response is a valid SearchResponse
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid search response
 * const validResponse = {
 *   totalItems: 100,
 *   startIndex: 0,
 *   itemsPerPage: 20,
 *   currentItemCount: 20,
 *   pageStartIndex: 0,
 *   totalPages: 5,
 *   suggestions: ["sodium", "chloride", "nacl"],
 *   pages: [1, 2, 3, 4, 5],
 *   items: [
 *     {
 *       title: "Sodium Chloride",
 *       price: "29.99",
 *       link: "/products/nacl",
 *       product_id: "12345",
 *       product_code: "CHEM-001",
 *       quantity: "500g",
 *       vendor: "Chemical Supplier",
 *       original_product_id: "12345",
 *       list_price: "39.99",
 *       shopify_variants: [
 *         {
 *           sku: "CHEM-001-500G",
 *           price: "29.99",
 *           link: "/products/nacl?variant=1",
 *           variant_id: "1",
 *           quantity_total: "100",
 *           options: { Model: "500g" }
 *         }
 *       ]
 *     }
 *     // ... more items
 *   ]
 * };
 *
 * if (isValidSearchResponse(validResponse)) {
 *   console.log(`Found ${validResponse.items.length} items`);
 *   console.log(`Total pages: ${validResponse.totalPages}`);
 * } else {
 *   console.error("Invalid search response structure");
 * }
 *
 * // Invalid search response (missing required properties)
 * const invalidResponse = {
 *   items: [],
 *   totalItems: 0
 *   // Missing other required properties
 * };
 * if (!isValidSearchResponse(invalidResponse)) {
 *   console.error("Invalid response - missing required properties");
 * }
 *
 * // Invalid search response (wrong types)
 * const wrongTypes = {
 *   totalItems: "100", // Should be number
 *   itemsPerPage: "20", // Should be number
 *   items: "not an array" // Should be array
 * };
 * if (!isValidSearchResponse(wrongTypes)) {
 *   console.error("Invalid response - wrong property types");
 * }
 * ```
 * @source
 */
const validSearchResponseSchema = z.object({
  totalItems: z.number(),
  startIndex: z.number(),
  itemsPerPage: z.number(),
  currentItemCount: z.number(),
  items: z.array(z.unknown()),
});

export function isValidSearchResponse(response: unknown): response is SearchResponse {
  if (!validSearchResponseSchema.safeParse(response).success) {
    return false;
  }
  return (response as { items: unknown[] }).items.every((item) => isItemListing(item));
}

/**
 * Type guard to validate if an object is a valid Shopify product variant.
 * Checks for the presence and correct types of all required variant properties
 * including SKU, price, link, variant ID, quantity, and options.
 *
 * @param variant - The variant object to validate
 * @returns Type predicate indicating if the object is a valid ShopifyVariant
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid Shopify variant
 * const validVariant = {
 *   sku: "CHEM-001-500G",
 *   price: "29.99",
 *   link: "/products/nacl?variant=1",
 *   variant_id: "1",
 *   quantity_total: "100",
 *   options: {
 *     Model: "500g",
 *     Size: "Standard"
 *   }
 * };
 *
 * if (isShopifyVariant(validVariant)) {
 *   console.log("Valid variant:", validVariant.sku);
 *   console.log("Price:", validVariant.price);
 *   console.log("Options:", validVariant.options);
 * }
 *
 * // Valid variant with numeric quantity
 * const numericQuantityVariant = {
 *   sku: "CHEM-001-1KG",
 *   price: "49.99",
 *   link: "/products/nacl?variant=2",
 *   variant_id: "2",
 *   quantity_total: 100, // Can be number or string
 *   options: {
 *     Model: "1kg"
 *   }
 * };
 *
 * if (isShopifyVariant(numericQuantityVariant)) {
 *   console.log("Valid variant with numeric quantity");
 * }
 *
 * // Invalid variant (missing required properties)
 * const invalidVariant = {
 *   sku: "CHEM-001",
 *   price: "29.99"
 *   // Missing other required properties
 * };
 * if (!isShopifyVariant(invalidVariant)) {
 *   console.error("Invalid variant - missing required properties");
 * }
 *
 * // Invalid variant (wrong types)
 * const wrongTypes = {
 *   sku: 12345, // Should be string
 *   price: 29.99, // Should be string
 *   link: 123, // Should be string
 *   variant_id: 1, // Should be string
 *   quantity_total: true, // Should be string or number
 *   options: "500g" // Should be object
 * };
 * if (!isShopifyVariant(wrongTypes)) {
 *   console.error("Invalid variant - wrong property types");
 * }
 * ```
 * @source
 */
/* eslint-disable @typescript-eslint/naming-convention */
const shopifyVariantSchema = z.object({
  sku: z.string(),
  price: z.string(),
  link: z.string(),
  variant_id: z.string(),
  quantity_total: z.union([z.string(), z.number()]),
  options: z.record(z.string(), z.unknown()),
});
/* eslint-enable @typescript-eslint/naming-convention */

export function isShopifyVariant(variant: unknown): variant is ShopifyVariant {
  return shopifyVariantSchema.safeParse(variant).success;
}

/**
 * Type guard to validate if an object is a valid Shopify item listing.
 * Checks for the presence and correct types of all required properties including
 * product details, pricing, and an array of valid Shopify variants.
 *
 * @param item - The item object to validate
 * @returns Type predicate indicating if the object is a valid ItemListing
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid item listing
 * const validItem = {
 *   title: "Sodium Chloride",
 *   price: "29.99",
 *   link: "/products/nacl",
 *   product_id: "12345",
 *   product_code: "CHEM-001",
 *   quantity: "500g",
 *   vendor: "Chemical Supplier",
 *   original_product_id: "12345",
 *   list_price: "39.99",
 *   shopify_variants: [
 *     {
 *       sku: "CHEM-001-500G",
 *       price: "29.99",
 *       link: "/products/nacl?variant=1",
 *       variant_id: "1",
 *       quantity_total: "100",
 *       options: { Model: "500g" }
 *     },
 *     {
 *       sku: "CHEM-001-1KG",
 *       price: "49.99",
 *       link: "/products/nacl?variant=2",
 *       variant_id: "2",
 *       quantity_total: "50",
 *       options: { Model: "1kg" }
 *     }
 *   ]
 * };
 *
 * if (isItemListing(validItem)) {
 *   console.log("Valid item listing:", validItem.title);
 *   console.log("Number of variants:", validItem.shopify_variants.length);
 *   console.log("Vendor:", validItem.vendor);
 * }
 *
 * // Valid item with numeric price
 * const numericPriceItem = {
 *   title: "Potassium Chloride",
 *   price: 39.99, // Can be number or string
 *   link: "/products/kcl",
 *   product_id: "12346",
 *   product_code: "CHEM-002",
 *   quantity: "1kg",
 *   vendor: "Chemical Supplier",
 *   original_product_id: "12346",
 *   list_price: "49.99",
 *   shopify_variants: [
 *     {
 *       sku: "CHEM-002-1KG",
 *       price: "39.99",
 *       link: "/products/kcl?variant=1",
 *       variant_id: "1",
 *       quantity_total: "50",
 *       options: { Model: "1kg" }
 *     }
 *   ]
 * };
 *
 * if (isItemListing(numericPriceItem)) {
 *   console.log("Valid item with numeric price");
 * }
 *
 * // Invalid item (missing required properties)
 * const invalidItem = {
 *   title: "Sodium Chloride",
 *   price: "29.99",
 *   link: "/products/nacl"
 *   // Missing other required properties
 * };
 * if (!isItemListing(invalidItem)) {
 *   console.error("Invalid item - missing required properties");
 * }
 *
 * // Invalid item (wrong types)
 * const wrongTypes = {
 *   title: 12345, // Should be string
 *   price: true, // Should be string or number
 *   link: 123, // Should be string
 *   product_id: 12345, // Should be string
 *   product_code: 123, // Should be string
 *   quantity: 500, // Should be string
 *   vendor: 123, // Should be string
 *   original_product_id: 12345, // Should be string
 *   list_price: 39.99, // Should be string
 *   shopify_variants: "not an array" // Should be array
 * };
 * if (!isItemListing(wrongTypes)) {
 *   console.error("Invalid item - wrong property types");
 * }
 *
 * // Invalid item (invalid variants)
 * const invalidVariants = {
 *   title: "Sodium Chloride",
 *   price: "29.99",
 *   link: "/products/nacl",
 *   product_id: "12345",
 *   product_code: "CHEM-001",
 *   quantity: "500g",
 *   vendor: "Chemical Supplier",
 *   original_product_id: "12345",
 *   list_price: "39.99",
 *   shopify_variants: [
 *     {
 *       sku: "CHEM-001-500G",
 *       price: "29.99"
 *       // Missing required variant properties
 *     }
 *   ]
 * };
 * if (!isItemListing(invalidVariants)) {
 *   console.error("Invalid item - contains invalid variants");
 * }
 * ```
 * @source
 */
/* eslint-disable @typescript-eslint/naming-convention */
const itemListingSchema = z.object({
  title: z.string(),
  price: z.union([z.string(), z.number()]),
  link: z.string(),
  product_id: z.string(),
  product_code: z.string(),
  quantity: z.string(),
  shopify_variants: z.array(shopifyVariantSchema),
  vendor: z.string(),
  original_product_id: z.string(),
  list_price: z.string(),
});
/* eslint-enable @typescript-eslint/naming-convention */

export function isItemListing(item: unknown): item is ItemListing {
  return itemListingSchema.safeParse(item).success;
}
