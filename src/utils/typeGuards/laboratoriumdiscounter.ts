import { z } from "zod";

/* eslint-disable @typescript-eslint/naming-convention */
const searchResponseOkSchema = z.object({
  page: z.object({
    search: z.string(),
    session_id: z.string(),
    key: z.string(),
    title: z.string(),
    status: z.number(),
  }),
  request: z.object({
    url: z.string(),
    method: z.string(),
    get: z.record(z.string(), z.unknown()),
    device: z.record(z.string(), z.unknown()),
  }),
  collection: z.object({
    products: z.record(z.string(), z.unknown()),
  }),
});
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Type guard to validate if a response from the Laboratorium Discounter search API is valid.
 * Checks for the presence and correct types of all required properties including page info,
 * request details, and a valid collection of products.
 *
 * @category Typeguards
 * @param response - Response object to validate
 * @returns Type predicate indicating if response is a valid SearchResponse
 * @example
 * ```typescript
 * // Valid search response
 * const validResponse = {
 *   page: {
 *     search: "sodium chloride",
 *     session_id: "abc123",
 *     key: "search_key",
 *     title: "Search Results",
 *     status: 200
 *   },
 *   request: {
 *     url: "/en/search/sodium-chloride",
 *     method: "GET",
 *     get: { q: "sodium chloride" },
 *     device: { platform: "osx", type: "webkit", mobile: false }
 *   },
 *   collection: {
 *     products: {
 *       "12345": {
 *         id: 12345,
 *         vid: 67890,
 *         image: 1,
 *         brand: false,
 *         code: "CHEM-001",
 *         ean: "1234567890123",
 *         sku: "SKU-001",
 *         score: 1.0,
 *         available: true,
 *         unit: true,
 *         url: "/products/chemical-1",
 *         title: "Sodium Chloride",
 *         fulltitle: "Sodium Chloride 500g",
 *         variant: "500g",
 *         description: "High purity sodium chloride",
 *         data_01: "Additional info",
 *         price: {
 *           price: 29.99,
 *           price_incl: 29.99,
 *           price_excl: 24.79,
 *           price_old: 39.99,
 *           price_old_incl: 39.99,
 *           price_old_excl: 33.05
 *         }
 *       }
 *     }
 *   }
 * };
 *
 * if (isSearchResponseOk(validResponse)) {
 *   console.log("Valid search response");
 *   console.log("Number of products:", Object.keys(validResponse.collection.products).length);
 *   console.log("Search query:", validResponse.page.search);
 * } else {
 *   console.error("Invalid response structure");
 * }
 *
 * // Invalid search response (missing required properties)
 * const invalidResponse = {
 *   page: { search: "sodium chloride" },
 *   collection: { products: {} }
 *   // Missing request object
 * };
 * if (!isSearchResponseOk(invalidResponse)) {
 *   console.error("Invalid response - missing required properties");
 * }
 *
 * // Invalid search response (wrong types)
 * const wrongTypes = {
 *   page: "not an object",
 *   request: "not an object",
 *   collection: "not an object"
 * };
 * if (!isSearchResponseOk(wrongTypes)) {
 *   console.error("Invalid response - wrong property types");
 * }
 * ```
 * @source
 */
export function isSearchResponseOk(response: unknown): response is SearchResponse {
  if (!searchResponseOkSchema.safeParse(response).success) {
    return false;
  }
  const { collection } = response as { collection: { products: Record<string, unknown> } };
  return Object.values(collection.products).every((product) => isSearchResponseProduct(product));
}

/* eslint-disable @typescript-eslint/naming-convention */
const priceObjectSchema = z.object({
  price: z.number(),
  price_incl: z.number(),
  price_excl: z.number(),
  price_old: z.number(),
  price_old_incl: z.number(),
  price_old_excl: z.number(),
});
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Type guard to validate if an object has the correct structure for a Laboratorium Discounter price object.
 * Checks for the presence and correct types of all required price properties including
 * regular prices and old prices (for items on sale).
 *
 * @category Typeguards
 * @param price - Object to validate as PriceObject
 * @returns Type predicate indicating if price is a valid PriceObject
 * @example
 * ```typescript
 * // Valid price object (regular price)
 * const regularPrice = {
 *   price: 29.99,
 *   price_incl: 29.99,
 *   price_excl: 24.79,
 *   price_old: 29.99,
 *   price_old_incl: 29.99,
 *   price_old_excl: 24.79
 * };
 *
 * if (isPriceObject(regularPrice)) {
 *   console.log("Valid regular price:", regularPrice.price);
 * }
 *
 * // Valid price object (sale price)
 * const salePrice = {
 *   price: 29.99,
 *   price_incl: 29.99,
 *   price_excl: 24.79,
 *   price_old: 39.99,
 *   price_old_incl: 39.99,
 *   price_old_excl: 33.05
 * };
 *
 * if (isPriceObject(salePrice)) {
 *   console.log("Valid sale price:", salePrice.price);
 *   console.log("Original price:", salePrice.price_old);
 * }
 *
 * // Invalid price object (missing properties)
 * const missingProps = {
 *   price: 29.99,
 *   price_incl: 29.99
 *   // Missing other required properties
 * };
 * if (!isPriceObject(missingProps)) {
 *   console.error("Invalid price - missing required properties");
 * }
 *
 * // Invalid price object (wrong types)
 * const wrongTypes = {
 *   price: "29.99", // Should be number
 *   price_incl: "29.99", // Should be number
 *   price_excl: "24.79", // Should be number
 *   price_old: "39.99", // Should be number
 *   price_old_incl: "39.99", // Should be number
 *   price_old_excl: "33.05" // Should be number
 * };
 * if (!isPriceObject(wrongTypes)) {
 *   console.error("Invalid price - wrong property types");
 * }
 * ```
 * @source
 */
export function isPriceObject(price: unknown): price is PriceObject {
  return priceObjectSchema.safeParse(price).success;
}

/* eslint-disable @typescript-eslint/naming-convention */
const searchResponseProductSchema = z.object({
  id: z.number(),
  vid: z.number(),
  image: z.number(),
  brand: z.boolean(),
  code: z.string(),
  ean: z.string(),
  sku: z.string(),
  score: z.number(),
  available: z.boolean(),
  unit: z.boolean(),
  url: z.string(),
  title: z.string(),
  fulltitle: z.string(),
  variant: z.string(),
  description: z.string(),
  data_01: z.string(),
  price: priceObjectSchema,
});
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Type guard to validate if an object has the correct structure for a Laboratorium Discounter search response product.
 * Checks for the presence and correct types of all required product properties including
 * basic info, availability, and a valid price object.
 *
 * @category Typeguards
 * @param product - Object to validate as SearchResponseProduct
 * @returns Type predicate indicating if product is a valid SearchResponseProduct
 * @example
 * ```typescript
 * // Valid search response product
 * const validProduct = {
 *   id: 12345,
 *   vid: 67890,
 *   image: 1,
 *   brand: false,
 *   code: "CHEM-001",
 *   ean: "1234567890123",
 *   sku: "SKU-001",
 *   score: 1.0,
 *   available: true,
 *   unit: true,
 *   url: "/products/chemical-1",
 *   title: "Sodium Chloride",
 *   fulltitle: "Sodium Chloride 500g",
 *   variant: "500g",
 *   description: "High purity sodium chloride",
 *   data_01: "Additional info",
 *   price: {
 *     price: 29.99,
 *     price_incl: 29.99,
 *     price_excl: 24.79,
 *     price_old: 39.99,
 *     price_old_incl: 39.99,
 *     price_old_excl: 33.05
 *   }
 * };
 *
 * if (isSearchResponseProduct(validProduct)) {
 *   console.log("Valid product:", validProduct.title);
 *   console.log("Price:", validProduct.price.price);
 *   console.log("Available:", validProduct.available);
 * }
 * ```
 * @source
 */
export function isSearchResponseProduct(product: unknown): product is SearchResponseProduct {
  return searchResponseProductSchema.safeParse(product).success;
}

const productObjectSchema = z.object({
  product: z
    .record(z.string(), z.unknown())
    .refine((val) => "variants" in val && (typeof val.variants === "object" || val.variants === false)),
  shop: z.object({
    currencies: z.record(z.string(), z.unknown()),
    currency: z.string(),
  }),
});

/**
 * Type guard to validate if an object has the correct structure for a Laboratorium Discounter product object.
 * Checks for the presence of a product object with a variants property that is either
 * an object containing variant information or false.
 *
 * @category Typeguards
 * @param data - Object to validate as ProductObject
 * @returns Type predicate indicating if product is a valid ProductObject
 * @example
 * ```typescript
 * // Valid product object with variants
 * const validProduct = {
 *   product: {
 *     variants: {
 *       "1": { id: 1, title: "500g", price: 29.99 },
 *       "2": { id: 2, title: "1kg", price: 49.99 }
 *     }
 *   },
 *   shop: { currencies: { EUR: {} }, currency: "EUR" }
 * };
 *
 * if (isProductObject(validProduct)) {
 *   console.log("Valid product object with variants");
 *   console.log("Number of variants:", Object.keys(validProduct.product.variants).length);
 * }
 *
 * // Valid product object without variants
 * const noVariants = {
 *   product: { variants: false },
 *   shop: { currencies: { EUR: {} }, currency: "EUR" }
 * };
 *
 * if (isProductObject(noVariants)) {
 *   console.log("Valid product object without variants");
 * }
 * ```
 * @source
 */
export function isProductObject(data: unknown): data is LaboratoriumDiscounterProductObject {
  return productObjectSchema.safeParse(data).success;
}

const validSearchParamsSchema = z.object({
  limit: z.string(),
  format: z.string(),
});

/**
 * Type guard to validate if an object has the correct structure for Laboratorium Discounter search parameters.
 * Checks for the presence and correct types of required parameters including
 * limit (must be a valid number string) and format (must be "json").
 *
 * @category Typeguards
 * @param params - Parameters to validate
 * @returns Type predicate indicating if params are valid SearchParams
 * @example
 * ```typescript
 * // Valid search parameters
 * const validParams = {
 *   limit: "10",
 *   format: "json"
 * };
 *
 * if (isValidSearchParams(validParams)) {
 *   console.log("Valid search parameters");
 *   console.log("Limit:", validParams.limit);
 * }
 *
 * // Invalid search parameters (wrong types)
 * const wrongTypes = {
 *   limit: 10, // Should be string
 *   format: 123 // Should be "json"
 * };
 * if (!isValidSearchParams(wrongTypes)) {
 *   console.error("Invalid parameters - wrong property types");
 * }
 * ```
 * @source
 */
export function isValidSearchParams(params: unknown): params is LaboratoriumDiscounterSearchParams {
  return validSearchParamsSchema.safeParse(params).success;
}
