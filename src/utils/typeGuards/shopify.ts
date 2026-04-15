import { z } from "zod";

/* eslint-disable @typescript-eslint/naming-convention */
const shopifyVariantNodeSchema = z.object({
  title: z.string(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  price: z.object({
    amount: z.string(),
  }),
  weight: z.number(),
  weightUnit: z.enum(["POUNDS", "OUNCES", "GRAMS", "KILOGRAMS"]),
  requiresShipping: z.boolean(),
  availableForSale: z.boolean(),
  currentlyNotInStock: z.boolean(),
});
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Type guard to validate if an object is a valid Shopify variant node.
 * Checks for the presence and correct types of all required variant properties
 * including title, SKU, price, weight, and availability fields.
 *
 * @category Typeguards
 * @param variant - The object to validate
 * @returns Type predicate indicating if the object is a valid ShopifyVariantNode
 * @example
 * ```typescript
 * const variant = {
 *   title: "Default Title",
 *   sku: "GTK-001",
 *   barcode: "",
 *   price: { amount: "14.99" },
 *   weight: 3.0,
 *   weightUnit: "OUNCES",
 *   requiresShipping: true,
 *   availableForSale: true,
 *   currentlyNotInStock: false
 * };
 *
 * if (isShopifyVariantNode(variant)) {
 *   console.log("Valid variant:", variant.sku);
 * }
 * ```
 * @source
 */
export function isShopifyVariantNode(variant: unknown): variant is ShopifyVariantNode {
  return shopifyVariantNodeSchema.safeParse(variant).success;
}

/* eslint-disable @typescript-eslint/naming-convention */
const shopifyProductNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  description: z.string(),
  onlineStoreUrl: z.string(),
  variants: z.object({
    edges: z.array(
      z.object({
        node: shopifyVariantNodeSchema,
      }),
    ),
  }),
});
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Type guard to validate if an object is a valid Shopify product node.
 * Checks for the presence and correct types of all required product properties
 * and validates that all nested variant nodes are also valid.
 *
 * @category Typeguards
 * @param product - The object to validate
 * @returns Type predicate indicating if the object is a valid ShopifyProductNode
 * @example
 * ```typescript
 * const product = {
 *   id: "gid://shopify/Product/123",
 *   title: "Gold Test Kit",
 *   handle: "gold-test-kit",
 *   description: "A gold testing kit",
 *   onlineStoreUrl: "https://example.com/products/gold-test-kit",
 *   variants: { edges: [{ node: validVariant }] }
 * };
 *
 * if (isShopifyProductNode(product)) {
 *   console.log("Valid product:", product.title);
 * }
 * ```
 * @source
 */
export function isShopifyProductNode(product: unknown): product is ShopifyProductNode {
  return shopifyProductNodeSchema.safeParse(product).success;
}

const shopifySearchResponseSchema = z.object({
  data: z.object({
    products: z.object({
      edges: z.array(
        z.object({
          node: shopifyProductNodeSchema,
        }),
      ),
    }),
  }),
  extensions: z.object({
    cost: z.object({
      requestedQueryCost: z.number(),
    }),
  }),
});

/**
 * Type guard to validate if a response from the Shopify GraphQL API is a valid
 * ShopifySearchResponse. Checks for the nested data.products.edges structure and
 * validates all product nodes within.
 *
 * @category Typeguards
 * @param response - The response object to validate
 * @returns Type predicate indicating if the response is a valid ShopifySearchResponse
 * @example
 * ```typescript
 * const response = await fetch(shopifyGraphQLUrl, { method: "POST", body: query });
 * const json = await response.json();
 *
 * if (isValidShopifySearchResponse(json)) {
 *   const products = json.data.products.edges.map(e => e.node);
 *   console.log(`Found ${products.length} products`);
 * }
 * ```
 * @source
 */
export function isValidShopifySearchResponse(response: unknown): response is ShopifySearchResponse {
  const parsed = shopifySearchResponseSchema.safeParse(response);
  if (!parsed.success) {
    console.warn("isValidShopifySearchResponse: response is not a valid ShopifySearchResponse", {
      response,
      parsed,
      error: parsed.error,
      issues: parsed.error.issues,
    });
  }
  return parsed.success;
}
