import { z } from 'zod';

const shopifyVariantNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  sku: z.string().nullable(),
  availableForSale: z.boolean(),
  currentlyNotInStock: z.boolean(),
  weight: z.number(),
  weightUnit: z.enum(['POUNDS', 'OUNCES', 'GRAMS', 'KILOGRAMS']),
  price: z.object({
    amount: z.string(),
  }),
});

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
 *   id: "gid://shopify/ProductVariant/123",
 *   title: "Default Title",
 *   sku: "GTK-001",
 *   availableForSale: true,
 *   weight: 3.0,
 *   weightUnit: "OUNCES",
 *   price: { amount: "14.99" }
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

const shopifyProductNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  descriptionHtml: z.string(),
  // Null for products not published to the online store; initProductBuilders
  // falls back to `${baseURL}/products/${handle}`.
  onlineStoreUrl: z.string().nullable(),
  variants: z.object({
    edges: z.array(
      z.object({
        node: shopifyVariantNodeSchema,
      }),
    ),
  }),
});

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
 *   descriptionHtml: "<p>A gold testing kit</p>",
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
  extensions: z
    .object({
      cost: z.object({
        requestedQueryCost: z.number(),
      }),
    })
    .optional(),
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
    console.warn('isValidShopifySearchResponse: response is not a valid ShopifySearchResponse', {
      response,
      parsed,
      error: parsed.error,
      issues: parsed.error.issues,
    });
  }
  return parsed.success;
}
