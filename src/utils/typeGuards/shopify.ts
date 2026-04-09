import { z } from "zod";

const validSearchResponseSchema = z.object({
  totalItems: z.number(),
  startIndex: z.number(),
  itemsPerPage: z.number(),
  currentItemCount: z.number(),
  items: z.array(z.unknown()),
});

/**
 * Type guard to validate if a response from the Shopify search API is a valid SearchResponse object.
 * Checks for the presence and correct types of all required properties including pagination info,
 * suggestions, and a valid array of item listings.
 *
 * @category Typeguards
 * @param response - The response object to validate
 * @returns Type predicate indicating if the response is a valid SearchResponse
 * @example
 * ```typescript
 * // Valid search response
 * const validResponse = {
 *   totalItems: 100,
 *   startIndex: 0,
 *   itemsPerPage: 20,
 *   currentItemCount: 20,
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
 *       shopify_variants: []
 *     }
 *   ]
 * };
 *
 * if (isValidSearchResponse(validResponse)) {
 *   console.log(`Found ${validResponse.items.length} items`);
 * } else {
 *   console.error("Invalid search response structure");
 * }
 * ```
 * @source
 */
export function isValidSearchResponse(response: unknown): response is SearchResponse {
  if (!validSearchResponseSchema.safeParse(response).success) {
    return false;
  }
  return (response as { items: unknown[] }).items.every((item) => isItemListing(item));
}

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

/**
 * Type guard to validate if an object is a valid Shopify product variant.
 * Checks for the presence and correct types of all required variant properties
 * including SKU, price, link, variant ID, quantity, and options.
 *
 * @category Typeguards
 * @param variant - The variant object to validate
 * @returns Type predicate indicating if the object is a valid ShopifyVariant
 * @example
 * ```typescript
 * // Valid Shopify variant
 * const validVariant = {
 *   sku: "CHEM-001-500G",
 *   price: "29.99",
 *   link: "/products/nacl?variant=1",
 *   variant_id: "1",
 *   quantity_total: "100",
 *   options: { Model: "500g" }
 * };
 *
 * if (isShopifyVariant(validVariant)) {
 *   console.log("Valid variant:", validVariant.sku);
 *   console.log("Price:", validVariant.price);
 * }
 * ```
 * @source
 */
export function isShopifyVariant(variant: unknown): variant is ShopifyVariant {
  return shopifyVariantSchema.safeParse(variant).success;
}

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

/**
 * Type guard to validate if an object is a valid Shopify item listing.
 * Checks for the presence and correct types of all required properties including
 * product details, pricing, and an array of valid Shopify variants.
 *
 * @category Typeguards
 * @param item - The item object to validate
 * @returns Type predicate indicating if the object is a valid ItemListing
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
 *     }
 *   ]
 * };
 *
 * if (isItemListing(validItem)) {
 *   console.log("Valid item listing:", validItem.title);
 *   console.log("Vendor:", validItem.vendor);
 * }
 * ```
 * @source
 */
export function isItemListing(item: unknown): item is ItemListing {
  return itemListingSchema.safeParse(item).success;
}
