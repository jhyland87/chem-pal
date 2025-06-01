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
 */
export function isTimestampResponse(data: unknown): data is TimestampResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "timestamp" in data &&
    typeof (data as TimestampResponse).timestamp === "number"
  );
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
 */
export function isMacklinApiResponse<T>(data: unknown): data is MacklinApiResponse<T> {
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    "message" in data &&
    "data" in data &&
    typeof (data as MacklinApiResponse).code === "number" &&
    typeof (data as MacklinApiResponse).message === "string"
  );
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
 */
export function isAuthRequiredEndpoint(url: string): boolean {
  return Object.values(AuthRequiredEndpoints).includes(url as AuthRequiredEndpoints);
}

/**
 * Validates if a URL is an authentication check endpoint.
 * These endpoints are used to verify the user's authentication status
 * and will return a specific error code (1005) if authentication fails.
 *
 * @param url - The API endpoint URL to check
 * @returns True if the endpoint is used for auth checks
 */
export function isAuthCheckEndpoint(url: string): boolean {
  return [
    ApiEndpoints.USER_INFO,
    ApiEndpoints.FRUIT_HEAD,
    ApiEndpoints.FAVOURITE_ADD,
    ApiEndpoints.FRUIT_ADD,
  ].includes(url as ApiEndpoints);
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
 */
export function isMacklinSearchResult<T>(data: unknown): data is MacklinSearchResult<T> {
  return (
    typeof data === "object" &&
    data !== null &&
    "list" in data &&
    data.list !== null &&
    typeof data.list === "object" &&
    data.list !== null
  );
}

/**
 * Validates if data matches the Macklin product format.
 * Checks for all required product properties and their types.
 * This is used to validate individual product variants in search results.
 *
 * @param data - The data to validate
 * @returns True if the data matches the product format
 * @example
 * ```ts
 * const product = response.data.list['16903-61-0'][0];
 * if (isMacklinProduct(product)) {
 *   // TypeScript now knows product has all required fields
 *   console.log(product.item_en_name);
 * }
 * ```
 */
export function isMacklinProduct(data: unknown): data is MacklinProduct {
  const requiredProps = {
    /* eslint-disable */
    chem_cas: "string",
    item_code: "string",
    item_cn_name: "string",
    item_id: "number",
    chem_mf: "string",
    item_specification: "string",
    item_if_bio: "number",
    item_transport: "number",
    chem_id: "number",
    item_order: "number",
    item_en_name: "string",
    item_safe_level: "number",
    item_upimg: "string",
    item_product_cate: "number",
    if_yj: "number",
    cas: "string",
    /* eslint-enable */
  };

  return Object.entries(requiredProps).every(([key, type]) => {
    return (
      typeof data === "object" &&
      data !== null &&
      key in data &&
      data[key as keyof typeof data] !== null &&
      data[key as keyof typeof data] !== undefined &&
      typeof data[key as keyof typeof data] === type
    );
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
 */
export function isMacklinProductDetails(data: unknown): data is MacklinProductDetails {
  const requiredProps = {
    /* eslint-disable */
    product_id: "number",
    product_code: "string",
    product_price: "string",
    product_unit: "string",
    product_locked_stock: "string",
    product_delivery_days: "number",
    product_stock_sh: "string",
    product_stock_sd: "string",
    product_stock_nf: "string",
    product_stock_cq: "string",
    product_stock_wh: "string",
    product_stock_hb: "string",
    product_if_production: "number",
    product_stock: "string",
    product_weight: "string",
    product_pack: "string",
    product_cate: "number",
    item_id: "number",
    item_code: "string",
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
    item_en_name: "string",
    item_weihuaxuhao: "string",
    item_specification: "string",
    item_en_specification: "string",
    /* eslint-enable */
  };

  return Object.entries(requiredProps).every(([key, type]) => {
    return (
      typeof data === "object" &&
      data !== null &&
      key in data &&
      data[key as keyof typeof data] !== null &&
      data[key as keyof typeof data] !== undefined &&
      typeof data[key as keyof typeof data] === type
    );
  });
}
