import {
  type ProductItem,
  type ProductObject,
  type ProductSelection,
  type QueryResponse,
} from "@/types/wix";

/**
 * Type guard to validate if a response matches the Wix QueryResponse structure.
 * Performs deep validation of the response object including the nested catalog structure,
 * products metadata, and ensures all products in the list are valid Wix products.
 *
 * @param response - Response object to validate
 * @returns Type predicate indicating if response is a valid QueryResponse
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid search response
 * const validResponse = {
 *   data: {
 *     catalog: {
 *       category: {
 *         productsWithMetaData: {
 *           totalCount: 1,
 *           list: [
 *             {
 *               price: 29.99,
 *               formattedPrice: "$29.99",
 *               name: "Sodium Chloride",
 *               urlPart: "sodium-chloride",
 *               productItems: [
 *                 {
 *                   id: "item_123",
 *                   formattedPrice: "$29.99",
 *                   price: 29.99,
 *                   optionsSelections: [
 *                     {
 *                       id: "opt_1",
 *                       value: "500g",
 *                       description: "500g Bottle",
 *                       key: "size",
 *                       inStock: true
 *                     }
 *                   ]
 *                 }
 *               ],
 *               options: [
 *                 {
 *                   selections: [
 *                     {
 *                       id: "opt_1",
 *                       value: "500g",
 *                       description: "500g Bottle",
 *                       key: "size",
 *                       inStock: true
 *                     }
 *                   ]
 *                 }
 *               ]
 *             }
 *           ]
 *         }
 *       }
 *     }
 *   }
 * };
 *
 * if (isValidSearchResponse(validResponse)) {
 *   console.log("Valid search response");
 *   const firstProduct = validResponse.data.catalog.category.productsWithMetaData.list[0];
 *   console.log("First product:", firstProduct.name);
 *   console.log("Total count:", validResponse.data.catalog.category.productsWithMetaData.totalCount);
 * } else {
 *   console.error("Invalid search response structure");
 * }
 *
 * // Invalid search response (missing data)
 * const noData = {
 *   // Missing data property
 * };
 * if (!isValidSearchResponse(noData)) {
 *   console.error("Invalid response - missing data");
 * }
 *
 * // Invalid search response (missing catalog)
 * const noCatalog = {
 *   data: {
 *     // Missing catalog property
 *   }
 * };
 * if (!isValidSearchResponse(noCatalog)) {
 *   console.error("Invalid response - missing catalog");
 * }
 *
 * // Invalid search response (empty product list)
 * const emptyList = {
 *   data: {
 *     catalog: {
 *       category: {
 *         productsWithMetaData: {
 *           totalCount: 0,
 *           list: [] // Empty list
 *         }
 *       }
 *     }
 *   }
 * };
 * if (!isValidSearchResponse(emptyList)) {
 *   console.error("Invalid response - empty product list");
 * }
 * ```
 */
export function isValidSearchResponse(response: unknown): response is QueryResponse {
  if (typeof response !== "object" || response === null) {
    return false;
  }

  // Check for nested structure existence
  if (
    !("data" in response) ||
    typeof response.data !== "object" ||
    response.data === null ||
    !("catalog" in response.data) ||
    typeof response.data.catalog !== "object" ||
    response.data.catalog === null ||
    !("category" in response.data.catalog) ||
    typeof response.data.catalog.category !== "object" ||
    response.data.catalog.category === null ||
    !("productsWithMetaData" in response.data.catalog.category) ||
    typeof response.data.catalog.category.productsWithMetaData !== "object" ||
    response.data.catalog.category.productsWithMetaData === null
  ) {
    return false;
  }

  const productsData = response.data.catalog.category.productsWithMetaData;

  // Check required properties and their types
  const requiredProps = {
    totalCount: "number",
    list: Array.isArray,
  };

  const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
    if (typeof validator === "string") {
      return (
        key in productsData && typeof productsData[key as keyof typeof productsData] === validator
      );
    }
    return key in productsData && validator((productsData as Record<string, unknown>)[key]);
  });

  if (!hasRequiredProps) return false;

  // Check that list contains valid products
  return (productsData as { list: unknown[] }).list.every((product: unknown) =>
    isWixProduct(product),
  );
}

/**
 * Type guard to validate if an object is a valid Wix ProductObject.
 * Checks for the presence and correct types of all required product properties
 * including price, name, URL, and validates all product items and options.
 *
 * @param product - Object to validate as ProductObject
 * @returns Type predicate indicating if product is a valid ProductObject
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid product object
 * const validProduct = {
 *   price: 29.99,
 *   formattedPrice: "$29.99",
 *   name: "Sodium Chloride",
 *   urlPart: "sodium-chloride",
 *   productItems: [
 *     {
 *       id: "item_123",
 *       formattedPrice: "$29.99",
 *       price: 29.99,
 *       optionsSelections: [
 *         {
 *           id: "opt_1",
 *           value: "500g",
 *           description: "500g Bottle",
 *           key: "size",
 *           inStock: true
 *         }
 *       ]
 *     }
 *   ],
 *   options: [
 *     {
 *       selections: [
 *         {
 *           id: "opt_1",
 *           value: "500g",
 *           description: "500g Bottle",
 *           key: "size",
 *           inStock: true
 *         }
 *       ]
 *     }
 *   ]
 * };
 *
 * if (isWixProduct(validProduct)) {
 *   console.log("Valid product:", validProduct.name);
 *   console.log("Price:", validProduct.formattedPrice);
 *   console.log("Items:", validProduct.productItems.length);
 * } else {
 *   console.error("Invalid product structure");
 * }
 *
 * // Invalid product (missing required properties)
 * const missingProps = {
 *   name: "Sodium Chloride",
 *   price: 29.99
 *   // Missing other required properties
 * };
 * if (!isWixProduct(missingProps)) {
 *   console.error("Invalid product - missing required properties");
 * }
 *
 * // Invalid product (wrong types)
 * const wrongTypes = {
 *   price: "29.99", // Should be number
 *   formattedPrice: 29.99, // Should be string
 *   name: 123, // Should be string
 *   urlPart: 123, // Should be string
 *   productItems: "not an array", // Should be array
 *   options: "not an array" // Should be array
 * };
 * if (!isWixProduct(wrongTypes)) {
 *   console.error("Invalid product - wrong property types");
 * }
 *
 * // Invalid product (invalid product items)
 * const invalidItems = {
 *   price: 29.99,
 *   formattedPrice: "$29.99",
 *   name: "Sodium Chloride",
 *   urlPart: "sodium-chloride",
 *   productItems: [
 *     {
 *       // Invalid product item (missing required properties)
 *       id: "item_123"
 *     }
 *   ],
 *   options: []
 * };
 * if (!isWixProduct(invalidItems)) {
 *   console.error("Invalid product - invalid product items");
 * }
 * ```
 */
export function isWixProduct(product: unknown): product is ProductObject {
  if (typeof product !== "object" || product === null) {
    return false;
  }

  const requiredProps = {
    price: "number",
    formattedPrice: "string",
    name: "string",
    urlPart: "string",
    productItems: Array.isArray,
    options: Array.isArray,
  };

  const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
    if (typeof validator === "string") {
      return key in product && typeof product[key as keyof typeof product] === validator;
    }
    return key in product && validator(product[key as keyof typeof product]);
  });

  if (!hasRequiredProps) return false;

  // Check product items
  const productItems = (product as ProductObject).productItems;
  if (!productItems.every((item) => isProductItem(item))) {
    return false;
  }

  // Check options and selections if they exist
  const options = (product as ProductObject).options;
  if (
    options.length > 0 &&
    !options[0]?.selections?.every((selection) => isProductSelection(selection))
  ) {
    return false;
  }

  return true;
}

/**
 * Type guard to validate if an object is a valid Wix ProductItem.
 * Checks for the presence and correct types of all required item properties
 * including ID, price, and ensures optionsSelections is a non-empty array.
 *
 * @param item - Object to validate as ProductItem
 * @returns Type predicate indicating if item is a valid ProductItem
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid product item
 * const validItem = {
 *   id: "item_123",
 *   formattedPrice: "$29.99",
 *   price: 29.99,
 *   optionsSelections: [
 *     {
 *       id: "opt_1",
 *       value: "500g",
 *       description: "500g Bottle",
 *       key: "size",
 *       inStock: true
 *     }
 *   ]
 * };
 *
 * if (isProductItem(validItem)) {
 *   console.log("Valid product item:", validItem.id);
 *   console.log("Price:", validItem.formattedPrice);
 *   console.log("Options:", validItem.optionsSelections.length);
 * } else {
 *   console.error("Invalid product item structure");
 * }
 *
 * // Invalid product item (missing required properties)
 * const missingProps = {
 *   id: "item_123",
 *   price: 29.99
 *   // Missing other required properties
 * };
 * if (!isProductItem(missingProps)) {
 *   console.error("Invalid item - missing required properties");
 * }
 *
 * // Invalid product item (wrong types)
 * const wrongTypes = {
 *   id: 123, // Should be string
 *   formattedPrice: 29.99, // Should be string
 *   price: "29.99", // Should be number
 *   optionsSelections: "not an array" // Should be array
 * };
 * if (!isProductItem(wrongTypes)) {
 *   console.error("Invalid item - wrong property types");
 * }
 *
 * // Invalid product item (empty options)
 * const emptyOptions = {
 *   id: "item_123",
 *   formattedPrice: "$29.99",
 *   price: 29.99,
 *   optionsSelections: [] // Empty array
 * };
 * if (!isProductItem(emptyOptions)) {
 *   console.error("Invalid item - empty options selections");
 * }
 * ```
 */
export function isProductItem(item: unknown): item is ProductItem {
  if (typeof item !== "object" || item === null) {
    return false;
  }

  const requiredProps = {
    id: "string",
    formattedPrice: "string",
    price: "number",
    optionsSelections: Array.isArray,
  };

  const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
    if (typeof validator === "string") {
      return key in item && typeof item[key as keyof typeof item] === validator;
    }
    return key in item && validator(item[key as keyof typeof item]);
  });

  if (!hasRequiredProps) return false;

  // Check that optionsSelections is a non-empty array
  return (item as ProductItem).optionsSelections.length > 0;
}

/**
 * Type guard to validate if an object is a valid Wix ProductSelection.
 * Checks for the presence and correct types of all required selection properties
 * including ID (which can be string or number), value, description, key, and inStock.
 *
 * @param selection - Object to validate as ProductSelection
 * @returns Type predicate indicating if selection is a valid ProductSelection
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid product selection (string ID)
 * const validSelectionString = {
 *   id: "opt_1",
 *   value: "500g",
 *   description: "500g Bottle",
 *   key: "size",
 *   inStock: true
 * };
 *
 * if (isProductSelection(validSelectionString)) {
 *   console.log("Valid selection:", validSelectionString.value);
 *   console.log("Description:", validSelectionString.description);
 *   console.log("In stock:", validSelectionString.inStock);
 * }
 *
 * // Valid product selection (numeric ID)
 * const validSelectionNumber = {
 *   id: 1,
 *   value: "500g",
 *   description: "500g Bottle",
 *   key: "size",
 *   inStock: true
 * };
 *
 * if (isProductSelection(validSelectionNumber)) {
 *   console.log("Valid selection with numeric ID:", validSelectionNumber.id);
 * }
 *
 * // Valid product selection (null inStock)
 * const validSelectionNull = {
 *   id: "opt_1",
 *   value: "500g",
 *   description: "500g Bottle",
 *   key: "size",
 *   inStock: null
 * };
 *
 * if (isProductSelection(validSelectionNull)) {
 *   console.log("Valid selection with null stock status");
 * }
 *
 * // Invalid product selection (missing required properties)
 * const missingProps = {
 *   id: "opt_1",
 *   value: "500g"
 *   // Missing other required properties
 * };
 * if (!isProductSelection(missingProps)) {
 *   console.error("Invalid selection - missing required properties");
 * }
 *
 * // Invalid product selection (wrong types)
 * const wrongTypes = {
 *   id: true, // Should be string or number
 *   value: 123, // Should be string
 *   description: 123, // Should be string
 *   key: 123, // Should be string
 *   inStock: "true" // Should be boolean or null
 * };
 * if (!isProductSelection(wrongTypes)) {
 *   console.error("Invalid selection - wrong property types");
 * }
 * ```
 */
export function isProductSelection(selection: unknown): selection is ProductSelection {
  if (typeof selection !== "object" || selection === null) {
    return false;
  }

  const requiredProps = {
    id: (val: unknown) => typeof val === "string" || typeof val === "number",
    value: "string",
    description: "string",
    key: "string",
    inStock: (val: unknown) => typeof val === "boolean" || val === null,
  };

  return Object.entries(requiredProps).every(([key, validator]) => {
    if (typeof validator === "string") {
      return key in selection && typeof selection[key as keyof typeof selection] === validator;
    }
    return key in selection && validator(selection[key as keyof typeof selection]);
  });
}
