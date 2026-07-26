import * as v from 'valibot';
import type {
  EpagesProductPage,
  EpagesSearchResponse,
  EpagesVariationsResponse,
} from '@/types/labchem';

const epagesSearchResponseSchema = v.object({
  products: v.array(
    v.looseObject({
      productId: v.string(),
      name: v.string(),
      links: v.array(v.looseObject({ rel: v.string(), href: v.string() })),
    }),
  ),
  totalNumberOfProducts: v.number(),
});

const epagesVariationsResponseSchema = v.object({
  results: v.number(),
  items: v.array(
    v.looseObject({
      link: v.looseObject({ rel: v.string(), href: v.string() }),
    }),
  ),
});

const epagesProductPageSchema = v.looseObject({
  productId: v.string(),
  forSale: v.boolean(),
});
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
  return v.safeParse(epagesSearchResponseSchema, response).success;
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
  return v.safeParse(epagesVariationsResponseSchema, response).success;
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
  return v.safeParse(epagesProductPageSchema, response).success;
}
