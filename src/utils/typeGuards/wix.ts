import { z } from 'zod';

/**
 * Minimal shape every Wix product must satisfy for the supplier to consume it.
 * Only the fields actually read while building a product are required — the
 * Wix response carries many more, but they are optional from our perspective.
 * `media` and `additionalInfo` (read for image/SDS/chemical properties) are
 * validated only as arrays — like `productItems`/`options`, their per-item
 * shape is guarded at the point of use so a stray entry can't reject the whole
 * response — and stay optional since a product may legitimately carry none.
 */
const wixProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  sku: z.string(),
  urlPart: z.string(),
  price: z.number(),
  formattedPrice: z.string(),
  productItems: z.array(z.unknown()),
  options: z.array(z.unknown()),
  media: z.array(z.unknown()).optional(),
  additionalInfo: z.array(z.unknown()).optional(),
});

const validSearchResponseSchema = z.object({
  data: z.object({
    catalog: z.object({
      category: z.object({
        productsWithMetaData: z.object({
          totalCount: z.number(),
          list: z.array(wixProductSchema),
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
 *   id: "prod_123",
 *   name: "Sodium Chloride",
 *   description: "ACS reagent grade",
 *   sku: "NACL-500",
 *   urlPart: "sodium-chloride",
 *   price: 29.99,
 *   formattedPrice: "$29.99",
 *   productItems: [
 *     {
 *       id: "item_123",
 *       formattedPrice: "$29.99",
 *       price: 29.99,
 *       optionsSelections: [1]
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
  const parsed = wixProductSchema.safeParse(product);
  if (!parsed.success) {
    return false;
  }

  const p = parsed.data;

  if (!p.productItems.every((item) => isProductItem(item))) {
    return false;
  }

  if (p.options.length > 0) {
    const firstOption = p.options[0] as { selections?: unknown[] };
    if (!firstOption?.selections?.every((s) => isProductSelection(s))) {
      return false;
    }
  }

  return true;
}

const productItemSchema = z.object({
  id: z.string(),
  formattedPrice: z.string(),
  price: z.number(),
  optionsSelections: z.array(z.number()).min(1),
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
 *   optionsSelections: [1]
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
