import * as v from 'valibot';

const validSearchResponseSchema = v.object({
  totalItems: v.number(),
  startIndex: v.number(),
  itemsPerPage: v.number(),
  currentItemCount: v.number(),
  items: v.array(v.unknown()),
});

/**
 * Type guard to validate if a response from the Searchanise search API is a valid SearchResponse object.
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
  const parsed = v.safeParse(validSearchResponseSchema, response);
  if (!parsed.success) {
    return false;
  }
  return parsed.output.items.every((item) => isItemListing(item));
}

const searchaniseVariantSchema = v.object({
  sku: v.string(),
  price: v.string(),
  link: v.string(),
  variant_id: v.string(),
  quantity_total: v.union([v.string(), v.number()]),
  options: v.record(v.string(), v.unknown()),
});

/**
 * Type guard to validate if an object is a valid Searchanise product variant.
 * Checks for the presence and correct types of all required variant properties
 * including SKU, price, link, variant ID, quantity, and options.
 *
 * @category Typeguards
 * @param variant - The variant object to validate
 * @returns Type predicate indicating if the object is a valid SearchaniseVariant
 * @example
 * ```typescript
 * // Valid Searchanise variant
 * const validVariant = {
 *   sku: "CHEM-001-500G",
 *   price: "29.99",
 *   link: "/products/nacl?variant=1",
 *   variant_id: "1",
 *   quantity_total: "100",
 *   options: { Model: "500g" }
 * };
 *
 * if (isSearchaniseVariant(validVariant)) {
 *   console.log("Valid variant:", validVariant.sku);
 *   console.log("Price:", validVariant.price);
 * }
 * ```
 * @source
 */
export function isSearchaniseVariant(variant: unknown): variant is SearchaniseVariant {
  return v.safeParse(searchaniseVariantSchema, variant).success;
}

const itemListingSchema = v.object({
  title: v.string(),
  price: v.union([v.string(), v.number()]),
  link: v.string(),
  product_id: v.string(),
  product_code: v.string(),
  quantity: v.string(),
  // Absent on non-Shopify storefronts (e.g. Laballey's Magento catalog).
  shopify_variants: v.optional(v.array(searchaniseVariantSchema)),
  vendor: v.optional(v.string()),
  original_product_id: v.string(),
  list_price: v.string(),
});

/**
 * Type guard to validate if an object is a valid Searchanise item listing.
 * Checks for the presence and correct types of all required properties including
 * product details, pricing, and an array of valid Searchanise variants.
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
  return v.safeParse(itemListingSchema, item).success;
}

const searchaniseApiObjectSchema = v.object({
  host: v.pipe(v.string(), v.minLength(1)),
  api_key: v.pipe(v.string(), v.regex(/^[A-Za-z0-9]{10}$/)),
});

/**
 * Type guard for the `window.Searchanise` object that Searchanise-powered storefronts embed in
 * their pages. Requires a non-empty `host` string and a 10-character alphanumeric `api_key`;
 * other fields are ignored.
 * @category Typeguards
 * @group Suppliers
 * @param data - The value to validate (typically parsed from the storefront's homepage)
 * @returns Type predicate indicating whether the value carries a usable `host` and `api_key`
 * @example
 * ```typescript
 * isValidSearchaniseApiObject({ host: 'https://searchserverapi1.com', api_key: '4p4M0R6q0N' });
 * // true
 * isValidSearchaniseApiObject({ host: 'https://searchserverapi1.com', api_key: 'short' });
 * // false
 * ```
 * @source
 */
export function isValidSearchaniseApiObject(data: unknown): data is SearchaniseApiObject {
  return v.safeParse(searchaniseApiObjectSchema, data).success;
}

const searchaniseCredentialsSchema = v.object({
  apiKey: v.pipe(v.string(), v.regex(/^[A-Za-z0-9]{10}$/)),
  host: v.pipe(v.string(), v.minLength(1)),
});

/**
 * Type guard for cached Searchanise credentials. Requires a 10-character alphanumeric `apiKey`
 * and a non-empty `host` string. It checks shape only; the supplier separately checks the host
 * against its allow-list before using it.
 * @category Typeguards
 * @group Suppliers
 * @param data - The value to validate (typically read back from extension storage)
 * @returns Type predicate indicating whether the value is usable credentials
 * @example
 * ```typescript
 * isSearchaniseCredentials({ apiKey: '4p4M0R6q0N', host: 'searchserverapi1.com' }); // true
 * isSearchaniseCredentials({ apiKey: 'short', host: 'searchserverapi1.com' });       // false
 * ```
 * @source
 */
export function isSearchaniseCredentials(data: unknown): data is SearchaniseCredentials {
  return v.safeParse(searchaniseCredentialsSchema, data).success;
}
