import { z } from 'zod';
import type {
  EpagesProductPage,
  EpagesSearchResponse,
  EpagesVariationsResponse,
} from '@/types/labchem';

const epagesSearchResponseSchema = z.object({
  products: z.array(
    z
      .object({
        productId: z.string(),
        name: z.string(),
        links: z.array(z.object({ rel: z.string(), href: z.string() }).passthrough()),
      })
      .passthrough(),
  ),
  totalNumberOfProducts: z.number(),
});

const epagesVariationsResponseSchema = z.object({
  results: z.number(),
  items: z.array(
    z
      .object({
        link: z.object({ rel: z.string(), href: z.string() }).passthrough(),
      })
      .passthrough(),
  ),
});

const epagesProductPageSchema = z
  .object({
    productId: z.string(),
    forSale: z.boolean(),
  })
  .passthrough();

/**
 * Type guard for the ePages catalog search response
 * (`POST /api/v2/search`). Verifies the `products` array (each with an id, name,
 * and links) and the `totalNumberOfProducts` count used to drive pagination.
 *
 * @category Typeguards
 * @param response - The value to validate
 * @returns Type predicate indicating whether `response` is an EpagesSearchResponse
 * @example
 * ```typescript
 * const json = await httpPostJson({ path: "/api/v2/search", body: { query: "" } });
 * if (isEpagesSearchResponse(json)) {
 *   console.log(`${json.totalNumberOfProducts} products in catalog`);
 * }
 * ```
 * @source
 */
export function isEpagesSearchResponse(response: unknown): response is EpagesSearchResponse {
  return epagesSearchResponseSchema.safeParse(response).success;
}

/**
 * Type guard for a master product's variations list
 * (`GET …/products/{masterId}/variations`). Verifies the `items` array, each
 * entry carrying a `link` to its variation product page.
 *
 * @category Typeguards
 * @param response - The value to validate
 * @returns Type predicate indicating whether `response` is an EpagesVariationsResponse
 * @example
 * ```typescript
 * const json = await httpGetJson({ path: `/rs/shops/${shopId}/products/${id}/variations` });
 * if (isEpagesVariationsResponse(json)) {
 *   const purchasable = json.items.filter((i) => i.additionalAttributes?.purchasable !== false);
 * }
 * ```
 * @source
 */
export function isEpagesVariationsResponse(
  response: unknown,
): response is EpagesVariationsResponse {
  return epagesVariationsResponseSchema.safeParse(response).success;
}

/**
 * Type guard for a per-variation (or master) product page (`GET …/products/{id}`).
 * Verifies the fields the enrichment step reads first — `productId` and the
 * `forSale` stock flag.
 *
 * @category Typeguards
 * @param response - The value to validate
 * @returns Type predicate indicating whether `response` is an EpagesProductPage
 * @example
 * ```typescript
 * const json = await httpGetJson({ path: variation.link.href });
 * if (isEpagesProductPage(json) && json.forSale) {
 *   console.log(json.priceInfo?.price?.amount);
 * }
 * ```
 * @source
 */
export function isEpagesProductPage(response: unknown): response is EpagesProductPage {
  return epagesProductPageSchema.safeParse(response).success;
}
