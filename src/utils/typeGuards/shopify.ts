import * as v from 'valibot';

const shopifyVariantNodeSchema = v.object({
  id: v.string(),
  title: v.string(),
  sku: v.nullable(v.string()),
  availableForSale: v.boolean(),
  currentlyNotInStock: v.boolean(),
  weight: v.number(),
  weightUnit: v.picklist(['POUNDS', 'OUNCES', 'GRAMS', 'KILOGRAMS']),
  price: v.object({
    amount: v.string(),
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
  return v.safeParse(shopifyVariantNodeSchema, variant).success;
}

const shopifyProductNodeSchema = v.object({
  id: v.string(),
  title: v.string(),
  handle: v.string(),
  descriptionHtml: v.string(),
  // Null for products not published to the online store; initProductBuilders
  // falls back to `${baseURL}/products/${handle}`.
  onlineStoreUrl: v.nullable(v.string()),
  variants: v.object({
    edges: v.array(
      v.object({
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
  return v.safeParse(shopifyProductNodeSchema, product).success;
}

const shopifySearchResponseSchema = v.object({
  data: v.object({
    products: v.object({
      edges: v.array(
        v.object({
          node: shopifyProductNodeSchema,
        }),
      ),
    }),
  }),
  extensions: v.optional(
    v.object({
      cost: v.object({
        requestedQueryCost: v.number(),
      }),
    }),
  ),
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
  const parsed = v.safeParse(shopifySearchResponseSchema, response);
  if (!parsed.success) {
    console.warn('isValidShopifySearchResponse: response is not a valid ShopifySearchResponse', {
      response,
      parsed,
      issues: parsed.issues,
    });
  }
  return parsed.success;
}
