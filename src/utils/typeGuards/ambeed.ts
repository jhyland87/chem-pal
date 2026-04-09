import { z } from "zod";

/**
 * Type guard to check if the given data is an AmbeedProductListResponse
 * @param data - The data to check
 * @returns True if the data matches the AmbeedProductListResponse structure
 * @source
 */
const ambeedProductListResponseSchema = z.object({
  source: z.number(),
  code: z.number(),
  lang: z.string(),
  value: z.record(z.string(), z.unknown()),
  time: z.string(),
});

export function isAmbeedProductListResponse(data: unknown): data is AmbeedProductListResponse {
  return ambeedProductListResponseSchema.safeParse(data).success;
}

/**
 * Type assertion to ensure the given data is an AmbeedProductListResponse
 * @param data - The data to assert
 * @throws Error if the data is not an AmbeedProductListResponse
 * @source
 */
export function assertIsAmbeedProductListResponse(
  data: unknown,
): asserts data is AmbeedProductListResponse {
  if (!isAmbeedProductListResponse(data)) {
    throw new Error("assertIsAmbeedProductListResponse failed");
  }
}

/**
 * Type guard to check if the given data is an AmbeedProductListResponseValue
 * @param data - The data to check
 * @returns True if the data matches the AmbeedProductListResponseValue structure
 * @source
 */
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

export function isAmbeedProductListResponseValue(
  data: unknown,
): data is AmbeedProductListResponseValue {
  return ambeedProductListResponseValueSchema.safeParse(data).success;
}

/**
 * Type guard to check if the given data is an AmbeedProductListResponseResultItem
 * @param data - The data to check
 * @returns True if the data matches the AmbeedProductListResponseResultItem structure
 * @source
 */
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

export function isAmbeedProductListResponseResultItem(
  data: unknown,
): data is AmbeedProductListResponseResultItem {
  return ambeedProductListResponseResultItemSchema.safeParse(data).success;
}

/**
 * Type guard to check if the given data is an AmbeedProductListResponsePriceList
 * @param data - The data to check
 * @returns True if the data matches the AmbeedProductListResponsePriceList structure
 * @source
 */
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

export function isAmbeedProductListResponsePriceList(
  data: unknown,
): data is AmbeedProductListResponsePriceList {
  return ambeedProductListResponsePriceListSchema.safeParse(data).success;
}

/**
 * Type guard to check if the given data is an AmbeedSearchResponseProduct
 * @param data - The data to check
 * @returns True if the data matches the AmbeedSearchResponseProduct structure
 * @source
 */
export function isAmbeedSearchResponseProduct(data: unknown): data is AmbeedSearchResponseProduct {
  return ambeedProductListResponseSchema.safeParse(data).success;
}
