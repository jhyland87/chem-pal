/**
 * Type guard to validate if an unknown object is a valid SearchResponseItem from WooCommerce.
 * Checks for the presence and correct types of all required properties including nested price information.
 *
 * @param item - Object to validate
 * @returns Type predicate indicating if the object is a valid SearchResponseItem
 * @typeguard
 *
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
 *
 * // Invalid search response item (missing properties)
 * const invalidItem = {
 *   id: 123,
 *   name: "Sodium Chloride"
 *   // Missing required properties
 * };
 * if (!isSearchResponseItem(invalidItem)) {
 *   console.log('Invalid item - missing required properties');
 * }
 *
 * // Invalid search response item (wrong types)
 * const wrongTypes = {
 *   id: "123", // Should be number
 *   name: 456, // Should be string
 *   prices: "invalid" // Should be object
 * };
 * if (!isSearchResponseItem(wrongTypes)) {
 *   console.log('Invalid item - wrong property types');
 * }
 * ```
 */
export function isSearchResponseItem(item: unknown): item is SearchResponseItem {
  if (typeof item !== "object" || item === null) {
    return false;
  }

  const requiredProps = {
    /* eslint-disable */
    id: "number",
    name: "string",
    type: "string",
    description: "string",
    short_description: "string",
    permalink: "string",
    is_in_stock: "boolean",
    sold_individually: "boolean",
    sku: "string",
    /* eslint-enable */
    prices: (val: unknown) => typeof val === "object" && val !== null,
  };

  const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
    if (typeof validator === "string") {
      return key in item && typeof item[key as keyof typeof item] === validator;
    }
    return key in item && validator(item[key as keyof typeof item]);
  });

  if (!hasRequiredProps) return false;

  // Check prices object structure
  const prices = (item as SearchResponseItem).prices;
  const requiredPriceProps = {
    /* eslint-disable */
    price: "string",
    regular_price: "string",
    sale_price: "string",
    currency_code: "string",
    currency_symbol: "string",
    currency_minor_unit: "number",
    currency_decimal_separator: "string",
    currency_thousand_separator: "string",
    currency_prefix: "string",
    currency_suffix: "string",
    /* eslint-enable */
  };

  return Object.entries(requiredPriceProps).every(([key, type]) => {
    return key in prices && typeof prices[key as keyof typeof prices] === type;
  });
}

/**
 * Type guard to validate if an unknown value is a valid WooCommerce SearchResponse.
 * Checks if the value is an array and all items are valid SearchResponseItems.
 *
 * @param response - Value to validate
 * @returns Type predicate indicating if the value is a valid SearchResponse
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid search response
 * const validResponse = [
 *   {
 *     id: 123,
 *     name: "Sodium Chloride",
 *     type: "simple",
 *     // Other required SearchResponseItem properties would go here
 *     prices: {
 *       price: "29.99",
 *       regular_price: "34.99",
 *       sale_price: "29.99",
 *       currency_code: "USD",
 *       currency_symbol: "$",
 *       currency_minor_unit: 2,
 *       currency_decimal_separator: ".",
 *       currency_thousand_separator: ",",
 *       currency_prefix: "$",
 *       currency_suffix: ""
 *     }
 *   },
 *   {
 *     id: 124,
 *     name: "Potassium Chloride",
 *     type: "simple",
 *     // Other required SearchResponseItem properties would go here
 *     prices: {
 *       price: "39.99",
 *       regular_price: "44.99",
 *       sale_price: "39.99",
 *       currency_code: "USD",
 *       currency_symbol: "$",
 *       currency_minor_unit: 2,
 *       currency_decimal_separator: ".",
 *       currency_thousand_separator: ",",
 *       currency_prefix: "$",
 *       currency_suffix: ""
 *     }
 *   }
 * ];
 *
 * if (isSearchResponse(validResponse)) {
 *   console.log('Valid search response with', validResponse.length, 'items');
 *   validResponse.forEach(item => console.log(item.name));
 * }
 *
 * // Invalid search response (not an array)
 * const notArray = { items: [] };
 * if (!isSearchResponse(notArray)) {
 *   console.log('Invalid response - not an array');
 * }
 *
 * // Invalid search response (array with invalid items)
 * const invalidItems = [
 *   { id: 123, name: "Sodium Chloride" }, // Missing required properties
 *   { id: 124, name: "Potassium Chloride" } // Missing required properties
 * ];
 * if (!isSearchResponse(invalidItems)) {
 *   console.log('Invalid response - contains invalid items');
 * }
 * ```
 */
export function isSearchResponse(response: unknown): response is SearchResponse {
  if (!Array.isArray(response)) {
    return false;
  }

  return response.every((item) => isSearchResponseItem(item));
}

/**
 * Type guard to validate if an unknown object is a valid WooCommerce ProductVariant.
 * Checks if the object is a valid SearchResponseItem and has the required variant properties.
 *
 * @param product - Object to validate
 * @returns Type predicate indicating if the object is a valid ProductVariant
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid product variant
 * const validVariant = {
 *   id: 123,
 *   name: "Sodium Chloride 500g",
 *   type: "variation",
 *   variation: "500g",
 *   // Other required SearchResponseItem properties would go here
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
 * if (isProductVariant(validVariant)) {
 *   console.log('Valid variant:', validVariant.variation);
 * }
 *
 * // Invalid product variant (missing variation)
 * const invalidVariant = {
 *   id: 123,
 *   name: "Sodium Chloride",
 *   type: "variation"
 *   // Missing variation property
 * };
 * if (!isProductVariant(invalidVariant)) {
 *   console.log('Invalid variant - missing variation property');
 * }
 *
 * // Invalid product variant (wrong type)
 * const wrongType = {
 *   id: 123,
 *   name: "Sodium Chloride",
 *   type: "variation",
 *   variation: 500 // Should be string
 * };
 * if (!isProductVariant(wrongType)) {
 *   console.log('Invalid variant - wrong variation type');
 * }
 * ```
 */
export function isProductVariant(product: unknown): product is ProductVariant {
  if (!isSearchResponseItem(product)) {
    return false;
  }

  if (typeof (product as ProductVariant).variation !== "string") {
    return false;
  }

  return true;
}

/**
 * Type guard to validate if a product response contains all required variant information.
 * Extends the basic ProductVariant validation with additional required properties for complete variant data.
 *
 * @param response - Object to validate
 * @returns Type predicate indicating if the response is a valid and complete ProductVariant
 * @typeguard
 *
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
 *   // Other required SearchResponseItem properties would go here
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
 * if (isValidProductVariant(completeVariant)) {
 *   console.log('Valid complete variant:', completeVariant.variation);
 *   console.log('Available variations:', completeVariant.variations);
 * }
 *
 * // Invalid complete variant (missing required properties)
 * const incompleteVariant = {
 *   id: 123,
 *   name: "Sodium Chloride 500g",
 *   type: "variation",
 *   variation: "500g",
 *   sku: "NACL-500"
 *   // Missing description and variations
 * };
 * if (!isValidProductVariant(incompleteVariant)) {
 *   console.log('Invalid complete variant - missing required properties');
 * }
 *
 * // Invalid complete variant (wrong types)
 * const wrongTypes = {
 *   id: 123,
 *   name: "Sodium Chloride 500g",
 *   type: "variation",
 *   variation: "500g",
 *   sku: "NACL-500",
 *   description: 123, // Should be string
 *   variations: "250g,500g,1000g" // Should be array
 * };
 * if (!isValidProductVariant(wrongTypes)) {
 *   console.log('Invalid complete variant - wrong property types');
 * }
 * ```
 */
export function isValidProductVariant(response: unknown): response is ProductVariant {
  if (!isProductVariant(response)) {
    return false;
  }

  const requiredProps = {
    variation: "string",
    sku: "string",
    description: "string",
    variations: Array.isArray,
  };

  return Object.entries(requiredProps).every(([key, validator]) => {
    if (typeof validator === "string") {
      return key in response && typeof response[key as keyof typeof response] === validator;
    }
    return key in response && validator(response[key as keyof typeof response]);
  });
}
