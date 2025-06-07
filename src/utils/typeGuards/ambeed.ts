import { checkObjectStructure } from "./common";

/**
 * Type guard to check if the given data is an AmbeedProductListResponse
 * @param data - The data to check
 * @returns True if the data matches the AmbeedProductListResponse structure
 */
export function isAmbeedProductListResponse(data: unknown): data is AmbeedProductListResponse {
  return checkObjectStructure(data, {
    source: "number",
    code: "number",
    lang: "string",
    value: "object",
    time: "string",
  });
}

/**
 * Type assertion to ensure the given data is an AmbeedProductListResponse
 * @param data - The data to assert
 * @throws Error if the data is not an AmbeedProductListResponse
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
 */
export function isAmbeedProductListResponseValue(
  data: unknown,
): data is AmbeedProductListResponseValue {
  return checkObjectStructure(data, {
    total: "number",
    pagenum: "number",
    pageindex: "number",
    pagesize: "number",
    list: "array",
  });
}

/**
 * Type guard to check if the given data is an AmbeedProductListResponseResultItem
 * @param data - The data to check
 * @returns True if the data matches the AmbeedProductListResponseResultItem structure
 */
export function isAmbeedProductListResponseResultItem(
  data: unknown,
): data is AmbeedProductListResponseResultItem {
  return checkObjectStructure(data, {
    /* eslint-disable */
    p_proimg: "string",
    p_id: "string",
    priceList: "array",
    p_moleweight: "string",
    p_proper_name3: "string",
    p_wm_max_quantity: "string",
    p_am: "string",
    s_url: "string",
    p_name_en: "string",
    p_cas: "string",
    /* eslint-enable */
  });
}

/**
 * Type guard to check if the given data is an AmbeedProductListResponsePriceList
 * @param data - The data to check
 * @returns True if the data matches the AmbeedProductListResponsePriceList structure
 */
export function isAmbeedProductListResponsePriceList(
  data: unknown,
): data is AmbeedProductListResponsePriceList {
  return checkObjectStructure(data, {
    /* eslint-disable */
    pr_am: "string",
    pr_usd: "string",
    pr_id: "number",
    discount_usd: "string",
    pr_size: "string",
    vip_usd: "string",
    pr_rate: "number",
    /* eslint-enable */
  });
}

/**
 * Type guard to check if the given data is an AmbeedSearchResponseProduct
 * @param data - The data to check
 * @returns True if the data matches the AmbeedSearchResponseProduct structure
 */
export function isAmbeedSearchResponseProduct(data: unknown): data is AmbeedSearchResponseProduct {
  return checkObjectStructure(data, {
    source: "number",
    code: "number",
    lang: "string",
    value: "object",
    time: "string",
  });
}
