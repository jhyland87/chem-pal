import { z } from "zod";

/* eslint-disable @typescript-eslint/naming-convention */
const searchResponseItemSchema = z.object({
  document: z.object({
    //CAS: z.string(),
    id: z.string(),
    inventoryLevel: z.number(),
    name: z.string(),
    product_id: z.number(),
    retailPrice: z.number(),
    salePrice: z.number(),
    price: z.number(),
    sku: z.string(),
    upc: z.string(),
    url: z.string(),
  }),
});
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Type guard to validate if an object matches the Chemsavers ProductObject structure.
 * Checks for the presence and correct types of all required product properties including
 * CAS number, inventory level, pricing information, and product identifiers.
 *
 * @category Typeguards
 * @param response - Object to validate as ProductObject
 * @returns Type predicate indicating if response is a valid ProductObject
 * @example
 * ```typescript
 * // Valid product object
 * const validProduct = {
 *   document: {
 *     CAS: "7647-14-5",
 *     id: "prod_123",
 *     inventoryLevel: 100,
 *     name: "Sodium Chloride",
 *     product_id: 12345,
 *     retailPrice: 29.99,
 *     salePrice: 24.99,
 *     price: 24.99,
 *     sku: "SC-500G",
 *     upc: "123456789012",
 *     url: "/products/sodium-chloride"
 *   }
 * };
 *
 * if (isValidSearchResponseItem(validProduct)) {
 *   console.log("Valid product:", validProduct.document.name);
 *   console.log("Price:", validProduct.document.price);
 *   console.log("Inventory:", validProduct.document.inventoryLevel);
 * }
 *
 * // Invalid product (missing document)
 * const noDocument = {
 *   // Missing document property
 *   CAS: "7647-14-5",
 *   name: "Sodium Chloride"
 * };
 * if (!isValidSearchResponseItem(noDocument)) {
 *   console.error("Invalid product - missing document");
 * }
 *
 * // Invalid product (missing required properties)
 * const missingProps = {
 *   document: {
 *     CAS: "7647-14-5",
 *     name: "Sodium Chloride"
 *     // Missing other required properties
 *   }
 * };
 * if (!isValidSearchResponseItem(missingProps)) {
 *   console.error("Invalid product - missing required properties");
 * }
 *
 * // Invalid product (wrong types)
 * const wrongTypes = {
 *   document: {
 *     CAS: 7647145, // Should be string
 *     id: 123, // Should be string
 *     inventoryLevel: "100", // Should be number
 *     name: 123, // Should be string
 *     product_id: "12345", // Should be number
 *     retailPrice: "29.99", // Should be number
 *     salePrice: "24.99", // Should be number
 *     price: "24.99", // Should be number
 *     sku: 123, // Should be string
 *     upc: 123456789012, // Should be string
 *     url: 123 // Should be string
 *   }
 * };
 * if (!isValidSearchResponseItem(wrongTypes)) {
 *   console.error("Invalid product - wrong property types");
 * }
 * ```
 * @source
 */
export function isValidSearchResponseItem(response: unknown): response is ChemsaversProductObject {
  return searchResponseItemSchema.safeParse(response).success;
}

const searchResponseSchema = z.object({
  results: z
    .array(
      z.object({
        hits: z.array(searchResponseItemSchema),
      }),
    )
    .min(1),
});

/**
 * Type guard to validate if a response matches the Chemsavers SearchResponse structure.
 * Performs validation of the response object including the results array and its hits,
 * ensuring each hit is a valid ProductObject. This is a comprehensive validation that
 * checks the entire response structure.
 *
 * @category Typeguards
 * @param response - Response object to validate
 * @returns Type predicate indicating if response is a valid SearchResponse
 * @example
 * ```typescript
 * // Valid search response
 * const validResponse = {
 *   results: [
 *     {
 *       hits: [
 *         {
 *           document: {
 *             CAS: "7647-14-5",
 *             id: "prod_123",
 *             inventoryLevel: 100,
 *             name: "Sodium Chloride",
 *             product_id: 12345,
 *             retailPrice: 29.99,
 *             salePrice: 24.99,
 *             price: 24.99,
 *             sku: "SC-500G",
 *             upc: "123456789012",
 *             url: "/products/sodium-chloride"
 *           }
 *         }
 *       ]
 *     }
 *   ]
 * };
 *
 * if (isValidSearchResponse(validResponse)) {
 *   console.log("Valid search response");
 *   const firstHit = validResponse.results[0].hits[0];
 *   console.log("First product:", firstHit.document.name);
 * } else {
 *   console.error("Invalid search response structure");
 * }
 *
 * // Invalid search response (missing results)
 * const noResults = {
 *   // Missing results property
 * };
 * if (!isValidSearchResponse(noResults)) {
 *   console.error("Invalid response - missing results");
 * }
 *
 * // Invalid search response (empty results)
 * const emptyResults = {
 *   results: [] // Empty array
 * };
 * if (!isValidSearchResponse(emptyResults)) {
 *   console.error("Invalid response - empty results");
 * }
 *
 * // Invalid search response (missing hits)
 * const noHits = {
 *   results: [
 *     {
 *       // Missing hits property
 *     }
 *   ]
 * };
 * if (!isValidSearchResponse(noHits)) {
 *   console.error("Invalid response - missing hits");
 * }
 *
 * // Invalid search response (invalid hit)
 * const invalidHit = {
 *   results: [
 *     {
 *       hits: [
 *         {
 *           document: {
 *             // Invalid product object (missing required properties)
 *             name: "Sodium Chloride"
 *           }
 *         }
 *       ]
 *     }
 *   ]
 * };
 * if (!isValidSearchResponse(invalidHit)) {
 *   console.error("Invalid response - invalid hit");
 * }
 * ```
 * @source
 */
export function isValidSearchResponse(response: unknown): response is ChemsaversSearchResponse {
  return searchResponseSchema.safeParse(response).success;
}

/**
 * Asserts that a response is a valid Chemsavers SearchResponse.
 * Throws an error if the response is not a valid SearchResponse.
 *
 * @category Typeguards
 * @param response - Response object to validate
 * @throws Error if response is not a valid SearchResponse
 * @example
 * ```typescript
 * try {
 *   assertValidSearchResponse(data);
 *   // data is now typed as ChemsaversSearchResponse
 *   console.log(data.results[0].hits.length);
 * } catch (error) {
 *   console.error("Invalid Chemsavers response:", error.message);
 * }
 * ```
 * @source
 */
export function assertValidSearchResponse(
  response: unknown,
): asserts response is ChemsaversSearchResponse {
  if (!isValidSearchResponse(response)) {
    throw new Error("Invalid search response", { cause: response });
  }
}
