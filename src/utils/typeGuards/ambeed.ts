import * as v from 'valibot';

const ambeedProductListResponseSchema = v.object({
  source: v.number(),
  code: v.number(),
  lang: v.string(),
  value: v.record(v.string(), v.unknown()),
  time: v.string(),
});

/**
 * Type guard to validate if a response matches the Ambeed product list API response structure.
 * Checks for the presence and correct types of source, code, lang, value, and time fields.
 *
 * @category Typeguards
 * @param data - The response data to validate
 * @returns Type predicate indicating if the data is a valid AmbeedProductListResponse
 * @example
 * ```typescript
 * const response = await fetch("https://www.ambeed.com/api/search");
 * const data = await response.json();
 * if (isAmbeedProductListResponse(data)) {
 *   console.log("Valid response, language:", data.lang);
 *   console.log("Response code:", data.code);
 * }
 * ```
 * @source
 */
export function isAmbeedProductListResponse(data: unknown): data is AmbeedProductListResponse {
  return v.safeParse(ambeedProductListResponseSchema, data).success;
}

/**
 * Type assertion to ensure the given data is a valid AmbeedProductListResponse.
 * Throws an error if the data does not match the expected structure.
 *
 * @category Typeguards
 * @param data - The response data to assert
 * @throws Error if the data is not a valid AmbeedProductListResponse
 * @example
 * ```typescript
 * try {
 *   assertIsAmbeedProductListResponse(data);
 *   // data is now typed as AmbeedProductListResponse
 *   console.log(data.value);
 * } catch (error) {
 *   console.error("Invalid Ambeed response:", error.message);
 * }
 * ```
 * @source
 */
export function assertIsAmbeedProductListResponse(
  data: unknown,
): asserts data is AmbeedProductListResponse {
  if (!isAmbeedProductListResponse(data)) {
    throw new Error('assertIsAmbeedProductListResponse failed');
  }
}

const ambeedProductListResponseValueSchema = v.object({
  total: v.number(),
  pagenum: v.number(),
  pageindex: v.number(),
  pagesize: v.number(),
  result: v.custom<object>((val) => typeof val === 'object' && val !== null),
  menu_res: v.custom<object>((val) => typeof val === 'object' && val !== null),
});

/**
 * Type guard to validate if data matches the Ambeed product list response value structure.
 * Checks for pagination fields (total, pagenum, pageindex, pagesize) and result/menu data.
 *
 * @category Typeguards
 * @param data - The value object to validate
 * @returns Type predicate indicating if the data is a valid AmbeedProductListResponseValue
 * @example
 * ```typescript
 * if (isAmbeedProductListResponseValue(response.value)) {
 *   console.log("Total results:", response.value.total);
 *   console.log("Page:", response.value.pageindex, "of", response.value.pagenum);
 * }
 * ```
 * @source
 */
export function isAmbeedProductListResponseValue(
  data: unknown,
): data is AmbeedProductListResponseValue {
  return v.safeParse(ambeedProductListResponseValueSchema, data).success;
}

const ambeedProductListResponseResultItemSchema = v.object({
  p_id: v.string(),
  priceList: v.custom<object>((val) => typeof val === 'object' && val !== null),
  p_proper_name3: v.string(),
  p_am: v.string(),
  s_url: v.string(),
  p_name_en: v.string(),
  p_cas: v.string(),
});

/**
 * Type guard to validate if data matches the Ambeed product result item structure.
 * Checks for required product fields including product ID, price list, name, molecular formula,
 * URL, English name, and CAS number.
 *
 * @category Typeguards
 * @param data - The result item to validate
 * @returns Type predicate indicating if the data is a valid AmbeedProductListResponseResultItem
 * @example
 * ```typescript
 * const item = resultList[0];
 * if (isAmbeedProductListResponseResultItem(item)) {
 *   console.log("Product:", item.p_name_en);
 *   console.log("CAS:", item.p_cas);
 *   console.log("URL:", item.s_url);
 * }
 * ```
 * @source
 */
export function isAmbeedProductListResponseResultItem(
  data: unknown,
): data is AmbeedProductListResponseResultItem {
  return v.safeParse(ambeedProductListResponseResultItemSchema, data).success;
}

const ambeedProductListResponsePriceListSchema = v.object({
  pr_am: v.string(),
  pr_usd: v.string(),
  pr_id: v.number(),
  discount_usd: v.string(),
  pr_size: v.string(),
  vip_usd: v.string(),
  pr_rate: v.number(),
});

/**
 * Type guard to validate if data matches the Ambeed price list item structure.
 * Checks for required pricing fields including amount, USD price, discount, size,
 * VIP price, and rate.
 *
 * @category Typeguards
 * @param data - The price list item to validate
 * @returns Type predicate indicating if the data is a valid AmbeedProductListResponsePriceList
 * @example
 * ```typescript
 * const priceItem = product.priceList[0];
 * if (isAmbeedProductListResponsePriceList(priceItem)) {
 *   console.log("Price (USD):", priceItem.pr_usd);
 *   console.log("Size:", priceItem.pr_size);
 *   console.log("Discount:", priceItem.discount_usd);
 * }
 * ```
 * @source
 */
export function isAmbeedProductListResponsePriceList(
  data: unknown,
): data is AmbeedProductListResponsePriceList {
  return v.safeParse(ambeedProductListResponsePriceListSchema, data).success;
}

/**
 * Type guard to validate if data matches the Ambeed search response product structure.
 * Uses the same schema as the product list response for validation.
 *
 * @category Typeguards
 * @param data - The search response product to validate
 * @returns Type predicate indicating if the data is a valid AmbeedSearchResponseProduct
 * @example
 * ```typescript
 * const product = searchResults[0];
 * if (isAmbeedSearchResponseProduct(product)) {
 *   console.log("Source:", product.source);
 *   console.log("Code:", product.code);
 * }
 * ```
 * @source
 */
export function isAmbeedSearchResponseProduct(data: unknown): data is AmbeedSearchResponseProduct {
  return v.safeParse(ambeedProductListResponseSchema, data).success;
}

const ambeedProductPriceResponseSchema = v.object({
  source: v.number(),
  code: v.number(),
  lang: v.string(),
  time: v.string(),
  value: v.object({
    proInfo: v.custom<object>((val) => typeof val === 'object' && val !== null),
  }),
});

/**
 * Type guard to validate if data matches the Ambeed product price API response structure.
 * Checks the `AmbeedResponseBase` fields plus a `value.proInfo` object, which carries the
 * shared product info every priced variant in the response is keyed against.
 * @category Typeguards
 * @param data - The response data to validate
 * @returns Type predicate indicating if the data is a valid AmbeedProductPriceResponse
 * @example
 * ```typescript
 * const response = await this.httpPostJson({ path: "/webapi/v1/product_price" });
 * if (isAmbeedProductPriceResponse(response)) {
 *   console.log("Product:", response.value.proInfo.p_name_en);
 *   console.log("Lead time:", response.value.proInfo.p_leadtime);
 * }
 * ```
 * @source
 */
export function isAmbeedProductPriceResponse(data: unknown): data is AmbeedProductPriceResponse {
  return v.safeParse(ambeedProductPriceResponseSchema, data).success;
}

/**
 * Type assertion to ensure the given data is a valid AmbeedProductPriceResponse.
 * Throws an error if the data does not match the expected structure.
 * @category Typeguards
 * @param data - The response data to assert
 * @throws Error if the data is not a valid AmbeedProductPriceResponse
 * @example
 * ```typescript
 * assertIsAmbeedProductPriceResponse(response);
 * // response is now typed as AmbeedProductPriceResponse
 * console.log(response.value.proInfo.p_am);
 * ```
 * @source
 */
export function assertIsAmbeedProductPriceResponse(
  data: unknown,
): asserts data is AmbeedProductPriceResponse {
  if (!isAmbeedProductPriceResponse(data)) {
    throw new Error('assertIsAmbeedProductPriceResponse failed');
  }
}

const ambeedGetSearchProductAndRecommendedProductsByCASResponseSchema = v.object({
  source: v.number(),
  code: v.number(),
  lang: v.string(),
  time: v.string(),
  value: v.object({
    search_pro_dict: v.custom<object>((val) => typeof val === 'object' && val !== null),
    r_pro_list: v.array(v.unknown()),
  }),
});

/**
 * Type guard to validate if data matches the Ambeed "get search product and recommended
 * products by CAS" API response structure. Checks the `AmbeedResponseBase` fields plus a
 * `value` object containing the CAS-matched `search_pro_dict` and the `r_pro_list` array
 * of recommendations.
 * @category Typeguards
 * @param data - The response data to validate
 * @returns Type predicate indicating if the data is a valid
 *   AmbeedGetSearchProductAndRecommendedProductsByCASResponse
 * @example
 * ```typescript
 * if (isAmbeedGetSearchProductAndRecommendedProductsByCASResponse(response)) {
 *   console.log("Matched product:", response.value.search_pro_dict.p_name_en);
 *   console.log("Recommendations:", response.value.r_pro_list.length);
 * }
 * ```
 * @source
 */
export function isAmbeedGetSearchProductAndRecommendedProductsByCASResponse(
  data: unknown,
): data is AmbeedGetSearchProductAndRecommendedProductsByCASResponse {
  return v.safeParse(ambeedGetSearchProductAndRecommendedProductsByCASResponseSchema, data).success;
}

/**
 * Type assertion to ensure the given data is a valid
 * AmbeedGetSearchProductAndRecommendedProductsByCASResponse. Throws an error if the data
 * does not match the expected structure.
 * @category Typeguards
 * @param data - The response data to assert
 * @throws Error if the data is not a valid
 *   AmbeedGetSearchProductAndRecommendedProductsByCASResponse
 * @example
 * ```typescript
 * assertIsAmbeedGetSearchProductAndRecommendedProductsByCASResponse(response);
 * // response is now typed as AmbeedGetSearchProductAndRecommendedProductsByCASResponse
 * console.log(response.value.search_pro_dict.p_cas);
 * ```
 * @source
 */
export function assertIsAmbeedGetSearchProductAndRecommendedProductsByCASResponse(
  data: unknown,
): asserts data is AmbeedGetSearchProductAndRecommendedProductsByCASResponse {
  if (!isAmbeedGetSearchProductAndRecommendedProductsByCASResponse(data)) {
    throw new Error('assertIsAmbeedGetSearchProductAndRecommendedProductsByCASResponse failed');
  }
}

const ambeedProductStockResponseSchema = v.object({
  source: v.number(),
  code: v.number(),
  lang: v.string(),
  time: v.string(),
  value: v.array(v.looseObject({ size: v.string() })),
});

/**
 * Type guard to validate the `webapi/v1/product_stock` response shape — the
 * `value` array of per-size stock rows (each with a `size`, plus per-warehouse
 * quantities and an optional aggregate `has_stock` flag). An empty `value`
 * array is valid (no stock data available).
 *
 * @category Typeguards
 * @param data - The response data to validate
 * @returns Type predicate indicating if the data is a valid AmbeedProductStockResponse
 * @example
 * ```typescript
 * if (isAmbeedProductStockResponse(data)) {
 *   console.log(data.value[0].size, data.value[0].has_stock);
 * }
 * ```
 * @source
 */
export function isAmbeedProductStockResponse(data: unknown): data is AmbeedProductStockResponse {
  return v.safeParse(ambeedProductStockResponseSchema, data).success;
}

/**
 * Type assertion that the given data is a valid AmbeedProductStockResponse.
 * Throws if the data does not match the expected structure.
 *
 * @category Typeguards
 * @param data - The response data to assert
 * @throws Error if the data is not a valid AmbeedProductStockResponse
 * @example
 * ```typescript
 * assertIsAmbeedProductStockResponse(response);
 * console.log(response.value);
 * ```
 * @source
 */
export function assertIsAmbeedProductStockResponse(
  data: unknown,
): asserts data is AmbeedProductStockResponse {
  if (!isAmbeedProductStockResponse(data)) {
    throw new Error('assertIsAmbeedProductStockResponse failed');
  }
}

const ambeedGetPmsSdsByAmsResponseSchema = v.object({
  value: v.object({
    isokk: v.boolean(),
    errmsg: v.string(),
    // sds_list[<p_am>][<sdsType>] = { status, url }
    sds_list: v.record(
      v.string(),
      v.record(v.string(), v.object({ status: v.boolean(), url: v.string() })),
    ),
  }),
});

/**
 * Type guard to validate the `webapi/v1/getPmsSdsByAms` response shape — the
 * `value.sds_list` map of per-product (AM id) SDS documents keyed by SDS type.
 *
 * @category Typeguards
 * @param data - The response data to validate
 * @returns Type predicate indicating if the data is a valid AmbeedGetPmsSdsByAmsResponse
 * @example
 * ```typescript
 * if (isAmbeedGetPmsSdsByAmsResponse(data)) {
 *   console.log(data.value.sds_list["A491321"]["am"].url);
 * }
 * ```
 * @source
 */
export function isAmbeedGetPmsSdsByAmsResponse(
  data: unknown,
): data is AmbeedGetPmsSdsByAmsResponse {
  return v.safeParse(ambeedGetPmsSdsByAmsResponseSchema, data).success;
}

/**
 * Type assertion that the given data is a valid AmbeedGetPmsSdsByAmsResponse.
 * Throws if the data does not match the expected structure.
 *
 * @category Typeguards
 * @param data - The response data to assert
 * @throws Error if the data is not a valid AmbeedGetPmsSdsByAmsResponse
 * @example
 * ```typescript
 * assertIsAmbeedGetPmsSdsByAmsResponse(response);
 * console.log(response.value.sds_list);
 * ```
 * @source
 */
export function assertIsAmbeedGetPmsSdsByAmsResponse(
  data: unknown,
): asserts data is AmbeedGetPmsSdsByAmsResponse {
  if (!isAmbeedGetPmsSdsByAmsResponse(data)) {
    throw new Error('assertIsAmbeedGetPmsSdsByAmsResponse failed');
  }
}
