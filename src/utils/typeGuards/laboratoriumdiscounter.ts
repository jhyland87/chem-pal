/**
 * Type guard to validate if a response from the Laboratorium Discounter search API is valid.
 * Checks for the presence and correct types of all required properties including page info,
 * request details, and a valid collection of products.
 *
 * @param response - Response object to validate
 * @returns Type predicate indicating if response is a valid SearchResponse
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid search response
 * const validResponse = {
 *   page: {
 *     search: "sodium chloride",
 *     session_id: "abc123",
 *     key: "search_key",
 *     title: "Search Results",
 *     status: "success"
 *   },
 *   request: {
 *     url: "/en/search/sodium-chloride",
 *     method: "GET",
 *     get: { q: "sodium chloride" },
 *     device: "desktop"
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
 */
export function isSearchResponseOk(response: unknown): response is SearchResponse {
  if (typeof response !== "object" || response === null) {
    return false;
  }

  // Check for required top-level properties
  if (!("page" in response && "request" in response && "collection" in response)) {
    return false;
  }

  const { page, request, collection } = response as Partial<SearchResponse>;

  if (
    typeof page !== "object" ||
    !page ||
    typeof request !== "object" ||
    !request ||
    typeof collection !== "object" ||
    !collection
  ) {
    return false;
  }

  const badProps = ["search", "session_id", "key", "title", "status"].filter((prop) => {
    return prop in page === false;
  });

  if (badProps.length > 0) {
    return false;
  }

  // Validate request object
  if (
    typeof request !== "object" ||
    !request ||
    !("url" in request && "method" in request && "get" in request && "device" in request)
  ) {
    return false;
  }

  // Validate collection and products
  if (
    typeof collection !== "object" ||
    !collection ||
    !("products" in collection) ||
    typeof collection.products !== "object"
  ) {
    return false;
  }

  // Validate each product in the collection
  return Object.values(collection.products).every((product) => isSearchResponseProduct(product));
}

/**
 * Type guard to validate if an object has the correct structure for a Laboratorium Discounter price object.
 * Checks for the presence and correct types of all required price properties including
 * regular prices and old prices (for items on sale).
 *
 * @param price - Object to validate as PriceObject
 * @returns Type predicate indicating if price is a valid PriceObject
 * @typeguard
 *
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
 */
export function isPriceObject(price: unknown): price is PriceObject {
  if (typeof price !== "object" || price === null) return false;

  const requiredProps = {
    /* eslint-disable */
    price: "number",
    price_incl: "number",
    price_excl: "number",
    price_old: "number",
    price_old_incl: "number",
    price_old_excl: "number",
    /* eslint-enable */
  };

  return Object.entries(requiredProps).every(([key, type]) => {
    return key in price && typeof price[key as keyof typeof price] === type;
  });
}

/**
 * Type guard to validate if an object has the correct structure for a Laboratorium Discounter search response product.
 * Checks for the presence and correct types of all required product properties including
 * basic info, availability, and a valid price object.
 *
 * @param product - Object to validate as SearchResponseProduct
 * @returns Type predicate indicating if product is a valid SearchResponseProduct
 * @typeguard
 *
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
 *
 * // Invalid product (missing required properties)
 * const missingProps = {
 *   id: 12345,
 *   title: "Sodium Chloride",
 *   price: {
 *     price: 29.99,
 *     price_incl: 29.99,
 *     price_excl: 24.79,
 *     price_old: 39.99,
 *     price_old_incl: 39.99,
 *     price_old_excl: 33.05
 *   }
 *   // Missing other required properties
 * };
 * if (!isSearchResponseProduct(missingProps)) {
 *   console.error("Invalid product - missing required properties");
 * }
 *
 * // Invalid product (wrong types)
 * const wrongTypes = {
 *   id: "12345", // Should be number
 *   vid: "67890", // Should be number
 *   image: "1", // Should be number
 *   brand: "false", // Should be boolean
 *   code: 123, // Should be string
 *   ean: 1234567890123, // Should be string
 *   sku: 123, // Should be string
 *   score: "1.0", // Should be number
 *   available: "true", // Should be boolean
 *   unit: "true", // Should be boolean
 *   url: 123, // Should be string
 *   title: 123, // Should be string
 *   fulltitle: 123, // Should be string
 *   variant: 500, // Should be string
 *   description: 123, // Should be string
 *   data_01: 123, // Should be string
 *   price: "29.99" // Should be PriceObject
 * };
 * if (!isSearchResponseProduct(wrongTypes)) {
 *   console.error("Invalid product - wrong property types");
 * }
 *
 * // Invalid product (invalid price object)
 * const invalidPrice = {
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
 *     price: "29.99" // Invalid price object
 *   }
 * };
 * if (!isSearchResponseProduct(invalidPrice)) {
 *   console.error("Invalid product - invalid price object");
 * }
 * ```
 */
export function isSearchResponseProduct(product: unknown): product is SearchResponseProduct {
  if (typeof product !== "object" || product === null) return false;

  const requiredProps = {
    /* eslint-disable */
    id: "number",
    vid: "number",
    image: "number",
    brand: "boolean",
    code: "string",
    ean: "string",
    sku: "string",
    score: "number",
    available: "boolean",
    unit: "boolean",
    url: "string",
    title: "string",
    fulltitle: "string",
    variant: "string",
    description: "string",
    data_01: "string",
    /* eslint-enable */
  };

  const hasRequiredProps = Object.entries(requiredProps).every(([key, type]) => {
    return key in product && typeof product[key as keyof typeof product] === type;
  });

  if (!hasRequiredProps) return false;

  // Validate price object separately
  return "price" in product && isPriceObject(product.price);
}

/**
 * Type guard to validate if an object has the correct structure for a Laboratorium Discounter product object.
 * Checks for the presence of a product object with a variants property that is either
 * an object containing variant information or false.
 *
 * @param data - Object to validate as ProductObject
 * @returns Type predicate indicating if product is a valid ProductObject
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid product object with variants
 * const validProduct = {
 *   product: {
 *     variants: {
 *       "1": {
 *         id: 1,
 *         title: "500g",
 *         price: 29.99
 *       },
 *       "2": {
 *         id: 2,
 *         title: "1kg",
 *         price: 49.99
 *       }
 *     }
 *   }
 * };
 *
 * if (isProductObject(validProduct)) {
 *   console.log("Valid product object with variants");
 *   console.log("Number of variants:", Object.keys(validProduct.product.variants).length);
 * }
 *
 * // Valid product object without variants
 * const noVariants = {
 *   product: {
 *     variants: false
 *   }
 * };
 *
 * if (isProductObject(noVariants)) {
 *   console.log("Valid product object without variants");
 * }
 *
 * // Invalid product object (missing product property)
 * const missingProduct = {
 *   variants: {
 *     "1": { id: 1, title: "500g", price: 29.99 }
 *   }
 * };
 * if (!isProductObject(missingProduct)) {
 *   console.error("Invalid product object - missing product property");
 * }
 *
 * // Invalid product object (missing variants)
 * const missingVariants = {
 *   product: {
 *     title: "Sodium Chloride"
 *   }
 * };
 * if (!isProductObject(missingVariants)) {
 *   console.error("Invalid product object - missing variants");
 * }
 *
 * // Invalid product object (wrong types)
 * const wrongTypes = {
 *   product: "not an object"
 * };
 * if (!isProductObject(wrongTypes)) {
 *   console.error("Invalid product object - wrong property types");
 * }
 * ```
 */
export function isProductObject(data: unknown): data is LaboratoriumDiscounterProductObject {
  if (typeof data !== "object" || data === null) return false;
  if ("product" in data === false || typeof data.product !== "object" || data.product === null)
    return false;
  return (
    "variants" in data.product &&
    (typeof data.product.variants === "object" || data.product.variants === false) &&
    "shop" in data &&
    typeof data.shop === "object" &&
    data.shop !== null &&
    "currencies" in data.shop &&
    typeof data.shop.currencies === "object" &&
    data.shop.currencies !== null &&
    "currency" in data.shop &&
    typeof data.shop.currency === "string"
  );
}

/**
 * Type guard to validate if an object has the correct structure for Laboratorium Discounter search parameters.
 * Checks for the presence and correct types of required parameters including
 * limit (must be a valid number string) and format (must be "json").
 *
 * @param params - Parameters to validate
 * @returns Type predicate indicating if params are valid SearchParams
 * @typeguard
 *
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
 * // Invalid search parameters (missing required properties)
 * const missingProps = {
 *   limit: "10"
 *   // Missing format
 * };
 * if (!isValidSearchParams(missingProps)) {
 *   console.error("Invalid parameters - missing required properties");
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
 *
 * // Invalid search parameters (invalid limit)
 * const invalidLimit = {
 *   limit: "not a number",
 *   format: "json"
 * };
 * if (!isValidSearchParams(invalidLimit)) {
 *   console.error("Invalid parameters - invalid limit value");
 * }
 *
 * // Invalid search parameters (wrong format)
 * const wrongFormat = {
 *   limit: "10",
 *   format: "xml"
 * };
 * if (!isValidSearchParams(wrongFormat)) {
 *   console.error("Invalid parameters - wrong format value");
 * }
 * ```
 */
export function isValidSearchParams(params: unknown): params is LaboratoriumDiscounterSearchParams {
  if (typeof params !== "object" || params === null) return false;
  return (
    "limit" in params &&
    typeof params.limit === "string" &&
    "format" in params &&
    typeof params.format === "string"
  );
}
