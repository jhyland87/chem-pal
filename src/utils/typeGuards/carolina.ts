/**
 * Type guard to validate if a response has a valid basic structure for a Carolina search response.
 * Checks for the presence of required properties and correct response status code.
 * This is a basic validation that should be followed by more detailed validation.
 *
 * @param response - Response object to validate
 * @returns Type predicate indicating if response has valid basic structure
 * @typeguard
 *
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
 */
export function isResponseOk(response: unknown): response is CarolinaSearchResponse {
  if (!response || typeof response !== "object") {
    return false;
  }

  try {
    const _response = response as Partial<CarolinaSearchResponse>;

    if (
      _response.responseStatusCode !== 200 ||
      !("@type" in _response) ||
      !("contents" in _response) ||
      typeof _response.contents !== "object"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to validate if a response has the complete structure of a Carolina search response.
 * Performs deep validation of the response object including contents, content folder zones,
 * and child rules. This is a more thorough validation than isResponseOk.
 *
 * @param response - Response object to validate
 * @returns Type predicate indicating if response is a valid SearchResponse
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid search response
 * const validResponse = {
 *   responseStatusCode: 200,
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
 */
export function isValidSearchResponse(response: unknown): response is CarolinaSearchResponse {
  if (typeof response !== "object" || response === null) {
    return false;
  }

  const requiredProps = {
    contents: (val: unknown) => {
      if (typeof val !== "object" || val === null) {
        return false;
      }
      const contents = val as Record<string, unknown>;

      if (!Array.isArray(contents.ContentFolderZone) || contents.ContentFolderZone.length === 0) {
        return false;
      }

      const folder = contents.ContentFolderZone[0] as Record<string, unknown>;
      if (
        !Array.isArray(folder.childRules) ||
        folder.childRules.length === 0 ||
        typeof folder.childRules[0] !== "object"
      ) {
        return false;
      }

      return true;
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "@type": "string",
    responseStatusCode: (val: unknown) => {
      const isValid = val === 200;
      return isValid;
    },
  };

  return Object.entries(requiredProps).every(([key, validator]) => {
    const value = (response as Record<string, unknown>)[key];
    if (value === undefined) {
      return false;
    }
    if (typeof validator === "string") {
      const isValid = typeof value === validator;
      return isValid;
    }
    return validator(value);
  });
}

/**
 * Type guard to validate if an object is a valid Carolina search result item.
 * Checks for the presence and correct types of all required product properties
 * including product ID, name, description, price, and URL.
 *
 * @param result - Object to validate as SearchResult
 * @returns Type predicate indicating if result is a valid SearchResult
 * @typeguard
 *
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
 */
export function isSearchResultItem(result: unknown): result is CarolinaSearchResult {
  if (typeof result !== "object" || result === null) {
    return false;
  }

  const requiredProps = {
    /* eslint-disable */
    "product.productId": "string",
    "product.productName": "string",
    "product.shortDescription": "string",
    itemPrice: "string",
    "product.seoName": "string",
    productUrl: "string",
    productName: "string",
    qtyDiscountAvailable: "boolean",
    /* eslint-enable */
  };

  const hasRequiredProps = Object.entries(requiredProps).every(([key, expectedType]) => {
    const item = result as Record<string, unknown>;
    if (!(key in item)) {
      return false;
    }
    const actualType = typeof item[key];
    return actualType === expectedType;
  });

  return hasRequiredProps;
}

/**
 * Validates that a response matches the ProductResponse interface structure
 * @param obj - Response object to validate
 * @returns Type predicate indicating if object is a valid ProductResponse
 * @example
 * ```typescript
 * const response = await this._httpGetJson({
 *   path: `/api/rest/cb/product/product-details/${productId}`
 * });
 * if (isValidProductResponse(response)) {
 *   // Process valid product response
 *   console.log(response.product.name);
 * }
 * ```
 */
export function isValidProductResponse(obj: unknown): obj is CarolinaProductResponse {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const response = obj as Partial<CarolinaProductResponse>;

  return !(
    !response.contents?.MainContent ||
    !Array.isArray(response.contents.MainContent) ||
    response.contents.MainContent.length === 0 ||
    typeof response.contents.MainContent[0] !== "object" ||
    response.contents.MainContent[0] === null ||
    !("atgResponse" in response.contents.MainContent[0]) ||
    typeof response.contents.MainContent[0].atgResponse !== "object"
  );
}

/**
 * Validates that a response matches the ATGResponse interface structure
 * @param obj - Response object to validate
 * @returns Type predicate indicating if object is a valid ATGResponse
 * @example
 * ```typescript
 * const response = await this._httpGetJson({
 *   path: `/api/rest/cb/product/product-quick-view/${productId}`
 * });
 * if (isATGResponse(response)) {
 *   // Process valid ATG response
 *   console.log(response.response.response.products[0]);
 * }
 * ```
 */
export function isATGResponse(obj: unknown): obj is ATGResponse {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const response = obj as Partial<ATGResponse>;

  const requiredProps = {
    result: (val: unknown) => {
      const isValid = val === "success";
      return isValid;
    },
    response: (val: unknown) => {
      if (typeof val !== "object" || val === null) {
        return false;
      }
      const innerResponse = (val as { response?: unknown }).response;
      if (typeof innerResponse !== "object" || innerResponse === null) {
        return false;
      }

      const requiredInnerProps = {
        displayName: "string",
        longDescription: "string",
        shortDescription: "string",
        product: "string",
        dataLayer: "object",
        canonicalUrl: "string",
      };

      return Object.entries(requiredInnerProps).every(([key, expectedType]) => {
        const value = (innerResponse as Record<string, unknown>)[key];
        if (value === undefined) {
          return false;
        }
        if (expectedType === "object") {
          if (typeof value !== "object" || value === null) {
            return false;
          }
        } else if (typeof value !== expectedType) {
          return false;
        }
        return true;
      });
    },
  };

  return Object.entries(requiredProps).every(([key, validator]) => {
    if (!(key in response)) {
      return false;
    }
    return validator((response as Record<string, unknown>)[key]);
  });
}
