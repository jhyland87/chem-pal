import { checkObjectStructure } from "@/helpers/collectionUtils";

// Enums
export enum ApiEndpoints {
  /* eslint-disable */
  TIMESTAMP = "/api/timestamp",
  SEARCH = "/api/item/search",
  USER_INFO = "/api/user/info",
  FRUIT_HEAD = "/api/fruit/head",
  FAVOURITE_ADD = "/api/favourite/add",
  FRUIT_ADD = "/api/fruit/add",
  QUICK_BUY = "/api/quick/buy",
  /* eslint-enable */
}

export enum AuthRequiredEndpoints {
  /* eslint-disable */
  ORDER_LIST = "/api/center/order_list",
  EXPRESS = "/api/center/express",
  PREPAY = "/api/center/prepay",
  COUPON = "/api/center/coupon",
  ADDRESS_LIST = "/api/address/list",
  FRUIT_ORDER = "/api/fruit/order",
  /* eslint-enable */
}

/**
 * Check if the response is a timestamp response
 * @param data - The response data
 * @returns True if the response is a timestamp response, false otherwise
 * A valid response would be:
 * ```json
 * {"code":200,"message":"","data":{"timestamp":1748793383}}
 * ```
 * @source
 */
export function isTimestampResponse(data: unknown): data is TimestampResponse {
  return checkObjectStructure(data, {
    timestamp: "number",
  });
}

/**
 * Validates if a response matches the Macklin API response format.
 * All API responses must have a code, message, and data field.
 *
 * @param data - The response to validate
 * @returns True if the response matches the MacklinApiResponse format
 * @example
 * ```ts
 * const response = await fetch('/api/item/search');
 * if (isMacklinApiResponse(response)) {
 *   // TypeScript now knows response has code, message, and data
 *   console.log(response.data);
 * }
 * ```
 * @source
 */
export function isMacklinApiResponse<T>(data: unknown): data is MacklinApiResponse<T> {
  return checkObjectStructure(data, {
    code: "number",
    message: "string",
    data: (val: unknown) => val !== undefined,
  });
}

/**
 * Validates if a URL requires authentication.
 * These endpoints require a valid user token in the X-User-Token header.
 *
 * @param url - The API endpoint URL to check
 * @returns True if the endpoint requires authentication
 * @example
 * ```ts
 * if (isAuthRequiredEndpoint('/api/center/order_list')) {
 *   // Add authentication headers
 * }
 * ```
 * @source
 */
export function isAuthRequiredEndpoint(url: string): boolean {
  return (Object.values(AuthRequiredEndpoints) as string[]).includes(url);
}

/**
 * Validates if a URL is an authentication check endpoint.
 * These endpoints are used to verify the user's authentication status
 * and will return a specific error code (1005) if authentication fails.
 *
 * @param url - The API endpoint URL to check
 * @returns True if the endpoint is used for auth checks
 * @source
 */
export function isAuthCheckEndpoint(url: string): boolean {
  return (
    [
      ApiEndpoints.USER_INFO,
      ApiEndpoints.FRUIT_HEAD,
      ApiEndpoints.FAVOURITE_ADD,
      ApiEndpoints.FRUIT_ADD,
    ] as string[]
  ).includes(url);
}

/**
 * Validates if data matches the Macklin search result format.
 * Search results contain a list of products and a total count.
 * The list property is generic to support different product types.
 *
 * @param data - The data to validate
 * @returns True if the data matches the search result format
 * @example
 * ```ts
 * const response = await fetch('/api/item/search');
 * if (isMacklinSearchResult(response.data)) {
 *   // TypeScript now knows response.data has list and total
 *   console.log(response.data.total);
 * }
 * ```
 * @source
 */
export function isMacklinSearchResult<T>(data: unknown): data is MacklinSearchResult<T> {
  return checkObjectStructure(data, {
    list: (val: unknown) => typeof val === "object" && val !== null,
  });
}

/**
 * Validates if data matches the Macklin product details response format.
 * Product details response contains a list of product details.
 *
 * @param data - The data to validate
 * @returns True if the data matches the product details response format
 * @source
 */
export function isMacklinProductDetailsResponse(
  data: unknown,
): data is MacklinProductDetailsResponse {
  return checkObjectStructure(data, {
    list: (val: unknown) => Array.isArray(val) && val.every(isMacklinProductDetails),
  });
}

/**
 * Validates if data matches the Macklin product details format.
 * Product details contain comprehensive information about a specific
 * product variant, including pricing, stock, and delivery information.
 *
 * @param data - The data to validate
 * @returns True if the data matches the product details format
 * @example
 * ```ts
 * const details = await fetch('/api/product/list?code=B803083');
 * if (isMacklinProductDetails(details)) {
 *   // TypeScript now knows details has all product information
 *   console.log(details.product_price);
 * }
 * ```
 * @source
 */
export function isMacklinProductDetails(data: unknown): data is MacklinProductDetails {
  return checkObjectStructure(data, {
    /* eslint-disable */
    item_id: "number",
    item_code: "string",
    product_id: "number",
    product_code: "string",
    product_price: "string",
    product_unit: "string",
    product_locked_stock: "string",
    product_pack: "string",
    item_en_name: "string",
    product_stock: "string",
    chem_cas: "string",
    delivery_desc_show: "string",
    /*
    product_delivery_days: "number",
    product_stock_sh: "string",
    product_stock_sd: "string",
    product_stock_nf: "string",
    product_stock_cq: "string",
    product_stock_wh: "string",
    product_stock_hb: "string",
    product_if_production: "number",
    product_weight: "string",
    product_cate: "number",
    item_safe_level: "number",
    item_transport: "number",
    item_if_bio: "number",
    item_product_cate: "number",
    item_if_sell: "number",
    chem_cas: "string",
    item_if_stock: "number",
    item_max_package: "string",
    item_can_pack: "number",
    item_delivery_days: "number",
    item_cn_name: "string",
    item_weihuaxuhao: "string",
    item_specification: "string",
    item_en_specification: "string",
    */
    /* eslint-enable */
  });
}
