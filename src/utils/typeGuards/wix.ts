import { z } from "zod";

const validSearchResponseSchema = z.object({
  data: z.object({
    catalog: z.object({
      category: z.object({
        productsWithMetaData: z.object({
          totalCount: z.number(),
          list: z.array(
            z.object({
              price: z.number(),
              formattedPrice: z.string(),
              name: z.string(),
              urlPart: z.string(),
              productItems: z.array(z.unknown()),
              options: z.array(z.unknown()),
            }),
          ),
        }),
      }),
    }),
  }),
});

/**
 * Type guard to validate if a response matches the Wix QueryResponse structure.
 * Performs deep validation of the response object including the nested catalog structure,
 * products metadata, and ensures all products in the list are valid Wix products.
 *
 * @category Typeguards
 * @param response - Response object to validate
 * @returns Type predicate indicating if response is a valid QueryResponse
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
 *               productItems: [],
 *               options: []
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
 * }
 * ```
 * @source
 */
export function isValidSearchResponse(response: unknown): response is QueryResponse {
  return validSearchResponseSchema.safeParse(response).success;
}

const wixProductSchema = z.object({
  price: z.number(),
  formattedPrice: z.string(),
  name: z.string(),
  urlPart: z.string(),
  productItems: z.array(z.unknown()),
  options: z.array(z.unknown()),
});

/**
 * Type guard to validate if an object is a valid Wix ProductObject.
 * Checks for the presence and correct types of all required product properties
 * including price, name, URL, and validates all product items and options.
 *
 * @category Typeguards
 * @param product - Object to validate as ProductObject
 * @returns Type predicate indicating if product is a valid ProductObject
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
 *         { id: "opt_1", value: "500g", description: "500g Bottle", key: "size", inStock: true }
 *       ]
 *     }
 *   ],
 *   options: [
 *     {
 *       selections: [
 *         { id: "opt_1", value: "500g", description: "500g Bottle", key: "size", inStock: true }
 *       ]
 *     }
 *   ]
 * };
 *
 * if (isWixProduct(validProduct)) {
 *   console.log("Valid product:", validProduct.name);
 *   console.log("Price:", validProduct.formattedPrice);
 * }
 * ```
 * @source
 */
export function isWixProduct(product: unknown): product is ProductObject {
  if (!wixProductSchema.safeParse(product).success) {
    return false;
  }

  const p = product as { productItems: unknown[]; options: Array<{ selections?: unknown[] }> };

  if (!p.productItems.every((item) => isProductItem(item))) {
    return false;
  }

  if (p.options.length > 0 && !p.options[0]?.selections?.every((s) => isProductSelection(s))) {
    return false;
  }

  return true;
}

const productItemSchema = z.object({
  id: z.string(),
  formattedPrice: z.string(),
  price: z.number(),
  optionsSelections: z.array(z.unknown()).min(1),
});

/**
 * Type guard to validate if an object is a valid Wix ProductItem.
 * Checks for the presence and correct types of all required item properties
 * including ID, price, and ensures optionsSelections is a non-empty array.
 *
 * @category Typeguards
 * @param item - Object to validate as ProductItem
 * @returns Type predicate indicating if item is a valid ProductItem
 * @example
 * ```typescript
 * // Valid product item
 * const validItem = {
 *   id: "item_123",
 *   formattedPrice: "$29.99",
 *   price: 29.99,
 *   optionsSelections: [
 *     { id: "opt_1", value: "500g", description: "500g Bottle", key: "size", inStock: true }
 *   ]
 * };
 *
 * if (isProductItem(validItem)) {
 *   console.log("Valid product item:", validItem.id);
 *   console.log("Price:", validItem.formattedPrice);
 * }
 * ```
 * @source
 */
export function isProductItem(item: unknown): item is ProductItem {
  return productItemSchema.safeParse(item).success;
}

const productSelectionSchema = z.object({
  id: z.union([z.string(), z.number()]),
  value: z.string(),
  description: z.string(),
  key: z.string(),
  inStock: z.union([z.boolean(), z.null()]),
});

/**
 * Type guard to validate if an object is a valid Wix ProductSelection.
 * Checks for the presence and correct types of all required selection properties
 * including ID (which can be string or number), value, description, key, and inStock.
 *
 * @category Typeguards
 * @param selection - Object to validate as ProductSelection
 * @returns Type predicate indicating if selection is a valid ProductSelection
 * @example
 * ```typescript
 * // Valid product selection (string ID)
 * const validSelection = {
 *   id: "opt_1",
 *   value: "500g",
 *   description: "500g Bottle",
 *   key: "size",
 *   inStock: true
 * };
 *
 * if (isProductSelection(validSelection)) {
 *   console.log("Valid selection:", validSelection.value);
 *   console.log("In stock:", validSelection.inStock);
 * }
 * ```
 * @source
 */
export function isProductSelection(selection: unknown): selection is ProductSelection {
  return productSelectionSchema.safeParse(selection).success;
}
