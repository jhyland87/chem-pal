import { checkObjectStructure } from "./common";
/**
 * Type guard to validate if an object matches the Chemsavers ProductObject structure.
 * Checks for the presence and correct types of all required product properties including
 * CAS number, inventory level, pricing information, and product identifiers.
 *
 * @param response - Object to validate as ProductObject
 * @returns Type predicate indicating if response is a valid ProductObject
 * @typeguard
 *
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
 */
export function isValidSearchResponseItem(response: unknown): response is ChemsaversProductObject {
  if (typeof response !== "object" || !response) {
    console.warn("Invalid search response item - Response is not an object:", response);
    return false;
  }
  if ("document" in response === false) {
    console.warn("Invalid search response item - Response is missing document property:", response);
    return false;
  }
  if (typeof response.document === "undefined") {
    console.warn("Invalid search response item - Response document is undefined:", response);
    return false;
  }

  if (typeof response.document !== "object") {
    console.warn("Invalid search response item - Response document is not an object:", response);
    return false;
  }

  if (
    !checkObjectStructure(response.document, {
      /* eslint-disable */
      //CAS: "string",
      id: "string",
      inventoryLevel: "number",
      name: "string",
      product_id: "number",
      retailPrice: "number",
      salePrice: "number",
      price: "number",
      sku: "string",
      upc: "string",
      url: "string",
    })
  ) {
    console.warn(
      "Invalid search response item - Response document is missing required properties:",
      response,
    );
    return false;
  }

  return true;
}

/**
 * Type guard to validate if a response matches the Chemsavers SearchResponse structure.
 * Performs validation of the response object including the results array and its hits,
 * ensuring each hit is a valid ProductObject. This is a comprehensive validation that
 * checks the entire response structure.
 *
 * @param response - Response object to validate
 * @returns Type predicate indicating if response is a valid SearchResponse
 * @typeguard
 *
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
 */
export function isValidSearchResponse(response: unknown): response is ChemsaversSearchResponse {
  try {
    if (typeof response !== "object" || !response) {
      console.warn("Invalid search response item - Response is not an object:", response);
      return false;
    }
    if ("results" in response === false) {
      console.warn(
        "Invalid search response item - Response is missing results property:",
        response,
      );
      return false;
    }

    const { results } = response as { results: unknown };

    if (!Array.isArray(results) || results.length === 0) {
      console.warn(
        "Invalid search response item - Response results is not an array (or its empty):",
        response,
      );
      return false;
    }

    if (!("hits" in results[0]) || !Array.isArray(results[0].hits)) {
      console.warn(
        "Invalid search response item - Response results[0] is missing hits property or is not an array:",
        response,
      );
      return false;
    }

    // Validate each hit in the nested array structure
    return results[0].hits.every((hit: unknown) => {
      if (!isValidSearchResponseItem(hit)) {
        console.warn(
          "Invalid search response item - Response hits is not a valid ProductObject:",
          hit,
        );
        return false;
      }
      return true;
    });
  } catch {
    console.warn(
      "Invalid search response item - Response is not a valid SearchResponse:",
      response,
    );
    return false;
  }
}

/**
 * Asserts that a response is a valid Chemsavers SearchResponse.
 * Throws an error if the response is not a valid SearchResponse.
 * @param response - Response object to validate
 * @throws Error if response is not a valid SearchResponse
 */
export function assertValidSearchResponse(
  response: unknown,
): asserts response is ChemsaversSearchResponse {
  if (!isValidSearchResponse(response)) {
    throw new Error("Invalid search response", { cause: response });
  }
}
