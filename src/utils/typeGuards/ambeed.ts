import { z } from "zod";

const ambeedProductListResponseSchema = z.object({
  source: z.number(),
  code: z.number(),
  lang: z.string(),
  value: z.record(z.string(), z.unknown()),
  time: z.string(),
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
  return ambeedProductListResponseSchema.safeParse(data).success;
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
    throw new Error("assertIsAmbeedProductListResponse failed");
  }
}

/* eslint-disable @typescript-eslint/naming-convention */
const ambeedProductListResponseValueSchema = z.object({
  total: z.number(),
  pagenum: z.number(),
  pageindex: z.number(),
  pagesize: z.number(),
  result: z.custom<object>((val) => typeof val === "object" && val !== null),
  menu_res: z.custom<object>((val) => typeof val === "object" && val !== null),
});
/* eslint-enable @typescript-eslint/naming-convention */

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
  return ambeedProductListResponseValueSchema.safeParse(data).success;
}

/* eslint-disable @typescript-eslint/naming-convention */
const ambeedProductListResponseResultItemSchema = z.object({
  p_id: z.string(),
  priceList: z.custom<object>((val) => typeof val === "object" && val !== null),
  p_proper_name3: z.string(),
  p_am: z.string(),
  s_url: z.string(),
  p_name_en: z.string(),
  p_cas: z.string(),
});
/* eslint-enable @typescript-eslint/naming-convention */

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
  return ambeedProductListResponseResultItemSchema.safeParse(data).success;
}

/* eslint-disable @typescript-eslint/naming-convention */
const ambeedProductListResponsePriceListSchema = z.object({
  pr_am: z.string(),
  pr_usd: z.string(),
  pr_id: z.number(),
  discount_usd: z.string(),
  pr_size: z.string(),
  vip_usd: z.string(),
  pr_rate: z.number(),
});
/* eslint-enable @typescript-eslint/naming-convention */

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
  return ambeedProductListResponsePriceListSchema.safeParse(data).success;
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
  return ambeedProductListResponseSchema.safeParse(data).success;
}
