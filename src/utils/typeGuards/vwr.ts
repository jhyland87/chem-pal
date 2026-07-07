import { z } from "zod";

const vwrTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});

/**
 * Type guard validating a VWR OAuth token response. Requires a bearer `access_token`,
 * a `token_type`, and a numeric `expires_in` lifetime.
 * @category Typeguards
 * @param data - The response to validate
 * @returns Type predicate indicating whether `data` is a VWRTokenResponse
 * @example
 * ```typescript
 * isVWRTokenResponse({ access_token: "abc", token_type: "bearer", expires_in: 39047 }); // true
 * isVWRTokenResponse({ token_type: "bearer" }); // false
 * ```
 * @source
 */
export function isVWRTokenResponse(data: unknown): data is VWRTokenResponse {
  return vwrTokenResponseSchema.safeParse(data).success;
}

const vwrSearchProductSchema = z
  .object({
    code: z.string(),
    baseProduct: z.string(),
  })
  .passthrough();

const vwrSearchResponseSchema = z.object({
  products: z.array(vwrSearchProductSchema),
});

/**
 * Type guard validating a VWR product search response. Requires a `products` array whose
 * entries each carry at least a `code` and a `baseProduct` id (other fields are tolerated).
 * @category Typeguards
 * @param data - The response to validate
 * @returns Type predicate indicating whether `data` is a VWRSearchResponse
 * @example
 * ```typescript
 * isVWRSearchResponse({ products: [{ code: "NA3626344", baseProduct: "11805968" }] }); // true
 * isVWRSearchResponse({ products: [{ code: "NA3626344" }] }); // false (missing baseProduct)
 * ```
 * @source
 */
export function isVWRSearchResponse(data: unknown): data is VWRSearchResponse {
  return vwrSearchResponseSchema.safeParse(data).success;
}

const vwrProductRowSchema = z
  .object({
    code: z.string(),
    catalogNumber: z.string(),
  })
  .passthrough();

const vwrOrdertableResponseSchema = z.object({
  productRows: z.array(vwrProductRowSchema),
});

/**
 * Type guard validating a VWR ordertable (product detail) response. Requires a `productRows`
 * array whose entries each carry at least a `code` and `catalogNumber`.
 * @category Typeguards
 * @param data - The response to validate
 * @returns Type predicate indicating whether `data` is a VWROrdertableResponse
 * @example
 * ```typescript
 * isVWROrdertableResponse({ productRows: [{ code: "NA2226459", catalogNumber: "CA71008-946" }] }); // true
 * isVWROrdertableResponse({ productRows: "nope" }); // false
 * ```
 * @source
 */
export function isVWROrdertableResponse(data: unknown): data is VWROrdertableResponse {
  return vwrOrdertableResponseSchema.safeParse(data).success;
}

const vwrAssetReferenceSchema = z
  .object({
    url: z.string(),
  })
  .passthrough();

const vwrAssetReferencesResponseSchema = z.object({
  assetReferences: z.array(vwrAssetReferenceSchema),
});

/**
 * Type guard validating a VWR asset-references response. Requires an `assetReferences` array
 * whose entries each carry a `url` (the `assetType` and language fields are tolerated).
 * @category Typeguards
 * @param data - The response to validate
 * @returns Type predicate indicating whether `data` is a VWRAssetReferencesResponse
 * @example
 * ```typescript
 * isVWRAssetReferencesResponse({ assetReferences: [{ url: "https://x/coa.pdf" }] }); // true
 * isVWRAssetReferencesResponse({ assetReferences: [{}] }); // false (missing url)
 * ```
 * @source
 */
export function isVWRAssetReferencesResponse(data: unknown): data is VWRAssetReferencesResponse {
  return vwrAssetReferencesResponseSchema.safeParse(data).success;
}

const vwrSubstanceAttributeSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    value: z.string(),
  })
  .passthrough();

const vwrSubstanceResponseSchema = z.object({
  substanceAttributes: z.array(vwrSubstanceAttributeSchema),
});

/**
 * Type guard validating a VWR chemical substance response. Requires a `substanceAttributes`
 * array whose entries each carry a `code`, `name`, and `value`.
 * @category Typeguards
 * @param data - The response to validate
 * @returns Type predicate indicating whether `data` is a VWRSubstanceResponse
 * @example
 * ```typescript
 * isVWRSubstanceResponse({ substanceAttributes: [{ code: "c_cas", name: "CAS", value: "7664-93-9" }] }); // true
 * isVWRSubstanceResponse({ substanceAttributes: [{ code: "c_cas" }] }); // false
 * ```
 * @source
 */
export function isVWRSubstanceResponse(data: unknown): data is VWRSubstanceResponse {
  return vwrSubstanceResponseSchema.safeParse(data).success;
}

const vwrSpecificationResponseSchema = z.array(
  z
    .object({
      name: z.string(),
      result: z.string(),
    })
    .passthrough(),
);

/**
 * Type guard validating a VWR chemical specification response (a flat array of `{name, result}`).
 * @category Typeguards
 * @param data - The response to validate
 * @returns Type predicate indicating whether `data` is a VWRSpecificationResponse
 * @example
 * ```typescript
 * isVWRSpecificationResponse([{ name: "Purity", result: "> 98 %" }]); // true
 * isVWRSpecificationResponse({ name: "Purity" }); // false (not an array)
 * ```
 * @source
 */
export function isVWRSpecificationResponse(data: unknown): data is VWRSpecificationResponse {
  return vwrSpecificationResponseSchema.safeParse(data).success;
}

const vwrStockResponseSchema = z.object({
  articleAvailabilityDetails: z.object({
    articleAvailabilityDetail: z.array(
      z
        .object({
          catalogNumber: z.string(),
          availability: z.object({}).passthrough(),
        })
        .passthrough(),
    ),
  }),
});

/**
 * Type guard validating a VWR anonymous stock-availability response. Requires the nested
 * `articleAvailabilityDetails.articleAvailabilityDetail` array of per-catalog-number availability.
 * @category Typeguards
 * @param data - The response to validate
 * @returns Type predicate indicating whether `data` is a VWRStockResponse
 * @example
 * ```typescript
 * isVWRStockResponse({
 *   articleAvailabilityDetails: {
 *     articleAvailabilityDetail: [{ catalogNumber: "80722-392", availability: { stockStatus: "inStock" } }],
 *   },
 * }); // true
 * ```
 * @source
 */
export function isVWRStockResponse(data: unknown): data is VWRStockResponse {
  return vwrStockResponseSchema.safeParse(data).success;
}
