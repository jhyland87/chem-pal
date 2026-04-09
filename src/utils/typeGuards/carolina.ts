import { z } from "zod";
import { StatusCodes } from "http-status-codes";

const responseOkSchema = z.object({
  responseStatusCode: z.literal(StatusCodes.OK),
  "@type": z.string(),
  contents: z.record(z.string(), z.unknown()),
});

/**
 * Type guard to validate if a response has a valid basic structure for a Carolina search response.
 * Checks for the presence of required properties and correct response status code.
 * This is a basic validation that should be followed by more detailed validation.
 *
 * @category Typeguards
 * @param response - Response object to validate
 * @returns Type predicate indicating if response has valid basic structure
 * @example
 * ```typescript
 * // Valid basic response structure
 * const validResponse = {
 *   responseStatusCode: 200,
 *   "@type": "SearchResponse",
 *   contents: {
 *     ContentFolderZone: [
 *       {
 *         childRules: [
 *           {
 *             // Search result items would be here
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * };
 *
 * if (isResponseOk(validResponse)) {
 *   console.log("Valid basic response structure");
 *   console.log("Status code:", validResponse.responseStatusCode);
 * } else {
 *   console.error("Invalid basic response structure");
 * }
 *
 * // Invalid response (wrong status code)
 * const wrongStatus = {
 *   responseStatusCode: 404,
 *   "@type": "SearchResponse",
 *   contents: {}
 * };
 * if (!isResponseOk(wrongStatus)) {
 *   console.error("Invalid response - wrong status code");
 * }
 *
 * // Invalid response (missing required properties)
 * const missingProps = {
 *   responseStatusCode: 200
 *   // Missing @type and contents
 * };
 * if (!isResponseOk(missingProps)) {
 *   console.error("Invalid response - missing required properties");
 * }
 * ```
 * @source
 */
export function isResponseOk(response: unknown): response is CarolinaSearchResponse {
  return responseOkSchema.safeParse(response).success;
}

const validSearchResponseSchema = z.object({
  responseStatusCode: z.literal(StatusCodes.OK),
  "@type": z.string(),
  contents: z.object({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ContentFolderZone: z
      .array(
        z.object({
          childRules: z.array(z.record(z.string(), z.unknown())).min(1),
        }),
      )
      .min(1),
  }),
});

/**
 * Type guard to validate if a response has the complete structure of a Carolina search response.
 * Performs deep validation of the response object including contents, content folder zones,
 * and child rules. This is a more thorough validation than isResponseOk.
 *
 * @category Typeguards
 * @param response - Response object to validate
 * @returns Type predicate indicating if response is a valid SearchResponse
 * @example
 * ```typescript
 * // Valid search response
 * const validResponse = {
 *   responseStatusCode: StatusCodes.OK,
 *   "@type": "SearchResponse",
 *   contents: {
 *     ContentFolderZone: [
 *       {
 *         childRules: [
 *           {
 *             "product.productId": "12345",
 *             "product.productName": "Sodium Chloride",
 *             "product.shortDescription": "High purity NaCl",
 *             itemPrice: "29.99",
 *             "product.seoName": "sodium-chloride",
 *             productUrl: "/products/sodium-chloride",
 *             productName: "Sodium Chloride 500g",
 *             qtyDiscountAvailable: false
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * };
 *
 * if (isValidSearchResponse(validResponse)) {
 *   console.log("Valid search response");
 *   const firstItem = validResponse.contents.ContentFolderZone[0].childRules[0];
 *   console.log("First item:", firstItem["product.productName"]);
 * } else {
 *   console.error("Invalid search response structure");
 * }
 *
 * // Invalid search response (empty content folder)
 * const emptyFolder = {
 *   responseStatusCode: 200,
 *   "@type": "SearchResponse",
 *   contents: {
 *     ContentFolderZone: [] // Empty folder
 *   }
 * };
 * if (!isValidSearchResponse(emptyFolder)) {
 *   console.error("Invalid response - empty content folder");
 * }
 *
 * // Invalid search response (missing child rules)
 * const noChildRules = {
 *   responseStatusCode: 200,
 *   "@type": "SearchResponse",
 *   contents: {
 *     ContentFolderZone: [
 *       {
 *         // Missing childRules
 *       }
 *     ]
 *   }
 * };
 * if (!isValidSearchResponse(noChildRules)) {
 *   console.error("Invalid response - missing child rules");
 * }
 * ```
 * @source
 */
export function isValidSearchResponse(response: unknown): response is CarolinaSearchResponse {
  return validSearchResponseSchema.safeParse(response).success;
}

/* eslint-disable @typescript-eslint/naming-convention */
const searchResultItemSchema = z.object({
  "product.productId": z.string(),
  "product.productName": z.string(),
  "product.shortDescription": z.string(),
  itemPrice: z.string(),
  "product.seoName": z.string(),
  productUrl: z.string(),
  productName: z.string(),
  qtyDiscountAvailable: z.boolean(),
});
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Type guard to validate if an object is a valid Carolina search result item.
 * Checks for the presence and correct types of all required product properties
 * including product ID, name, description, price, and URL.
 *
 * @category Typeguards
 * @param result - Object to validate as SearchResult
 * @returns Type predicate indicating if result is a valid SearchResult
 * @example
 * ```typescript
 * // Valid search result item
 * const validResult = {
 *   "product.productId": "12345",
 *   "product.productName": "Sodium Chloride",
 *   "product.shortDescription": "High purity NaCl",
 *   itemPrice: "29.99",
 *   "product.seoName": "sodium-chloride",
 *   productUrl: "/products/sodium-chloride",
 *   productName: "Sodium Chloride 500g",
 *   qtyDiscountAvailable: false
 * };
 *
 * if (isSearchResultItem(validResult)) {
 *   console.log("Valid search result:", validResult["product.productName"]);
 *   console.log("Price:", validResult.itemPrice);
 *   console.log("URL:", validResult.productUrl);
 * }
 *
 * // Invalid search result (missing required properties)
 * const missingProps = {
 *   "product.productId": "12345",
 *   "product.productName": "Sodium Chloride"
 *   // Missing other required properties
 * };
 * if (!isSearchResultItem(missingProps)) {
 *   console.error("Invalid result - missing required properties");
 * }
 *
 * // Invalid search result (wrong types)
 * const wrongTypes = {
 *   "product.productId": 12345, // Should be string
 *   "product.productName": 123, // Should be string
 *   "product.shortDescription": 123, // Should be string
 *   itemPrice: 29.99, // Should be string
 *   "product.seoName": 123, // Should be string
 *   productUrl: 123, // Should be string
 *   productName: 123, // Should be string
 *   qtyDiscountAvailable: "false" // Should be boolean
 * };
 * if (!isSearchResultItem(wrongTypes)) {
 *   console.error("Invalid result - wrong property types");
 * }
 * ```
 * @source
 */
export function isSearchResultItem(result: unknown): result is CarolinaSearchResult {
  return searchResultItemSchema.safeParse(result).success;
}

const validProductResponseSchema = z.object({
  contents: z.object({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    MainContent: z
      .array(
        z.object({
          atgResponse: z.record(z.string(), z.unknown()),
        }),
      )
      .min(1),
  }),
});

/**
 * Validates that a response matches the ProductResponse interface structure.
 *
 * @category Typeguards
 * @param obj - Response object to validate
 * @returns Type predicate indicating if object is a valid ProductResponse
 * @example
 * ```typescript
 * const response = await this.httpGetJson({
 *   path: `/api/rest/cb/product/product-details/${productId}`
 * });
 * if (isValidProductResponse(response)) {
 *   // Process valid product response
 *   console.log(response.product.name);
 * }
 * ```
 * @source
 */
export function isValidProductResponse(obj: unknown): obj is CarolinaProductResponse {
  return validProductResponseSchema.safeParse(obj).success;
}

const atgResponseSchema = z.object({
  result: z.literal("success"),
  response: z.object({
    response: z.object({
      displayName: z.string(),
      longDescription: z.string(),
      shortDescription: z.string(),
      product: z.string(),
      dataLayer: z.record(z.string(), z.unknown()),
      canonicalUrl: z.string(),
    }),
  }),
});

/**
 * Validates that a response matches the ATGResponse interface structure.
 *
 * @category Typeguards
 * @param obj - Response object to validate
 * @returns Type predicate indicating if object is a valid ATGResponse
 * @example
 * ```typescript
 * const response = await this.httpGetJson({
 *   path: `/api/rest/cb/product/product-quick-view/${productId}`
 * });
 * if (isATGResponse(response)) {
 *   // Process valid ATG response
 *   console.log(response.response.response.products[0]);
 * }
 * ```
 * @source
 */
export function isATGResponse(obj: unknown): obj is ATGResponse {
  return atgResponseSchema.safeParse(obj).success;
}
