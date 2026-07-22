import { z } from 'zod';

/**
 * Minimal shape every MySimpleStore search-list product must satisfy for the
 * supplier to consume it. Only the fields read while building a product are
 * required; the response carries many more, all optional from our perspective.
 * `image_list` is validated only as an array — its per-item shape is read
 * tolerantly at the point of use — and stays optional since a product may
 * legitimately carry no images.
 */
const mySimpleStoreListProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  relative_url: z.string(),
  image_list: z.array(z.unknown()).optional(),
});

const mySimpleStoreSearchResponseSchema = z.object({
  products: z.array(mySimpleStoreListProductSchema),
});

/**
 * Type guard validating that a value matches the MySimpleStore search/list
 * response envelope: an object with a `products` array whose items each carry
 * the minimal id/slug/name/relative_url fields the supplier reads.
 * @category Typeguards
 * @param response - The value to validate (typically a parsed JSON response)
 * @returns Type predicate indicating whether `response` is a valid search response
 * @example
 * ```typescript
 * const data = await this.httpGetJson({ host: this.apiHost, path: "/api/v2/products" });
 * if (isValidSearchResponse(data)) {
 *   for (const product of data.products) console.log(product.name);
 * }
 * ```
 * @source
 */
export function isValidSearchResponse(response: unknown): response is MySimpleStoreSearchResponse {
  return mySimpleStoreSearchResponseSchema.safeParse(response).success;
}

const mySimpleStoreProductDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  variants: z.array(z.unknown()).optional(),
});

/**
 * Type guard validating that a value matches the MySimpleStore product-detail
 * response: an object with id/slug/name and an optional `variants` array. The
 * per-variant shape is guarded at the point of use so a stray entry can't
 * reject the whole response.
 * @category Typeguards
 * @param product - The value to validate (typically a parsed JSON response)
 * @returns Type predicate indicating whether `product` is a valid product detail
 * @example
 * ```typescript
 * const data = await this.httpGetJson({ host: this.apiHost, path: "/api/v2/products/geraniol-60" });
 * if (isProductDetail(data)) console.log(data.variants?.length);
 * ```
 * @source
 */
export function isProductDetail(product: unknown): product is MySimpleStoreProductDetail {
  return mySimpleStoreProductDetailSchema.safeParse(product).success;
}
