import { checkObjectStructure } from "./common";

export function isAmbeedProductListResponse(data: unknown): data is AmbeedProductListResponse {
  return checkObjectStructure(data, {
    /* eslint-disable */
    source: "number",
    code: "number",
    lang: "string",
    value: "object",
    time: "string",
    /* eslint-enable */
  });
}
export function assertIsAmbeedProductListResponse(
  data: unknown,
): asserts data is AmbeedProductListResponse {
  if (!isAmbeedProductListResponse(data)) {
    throw new Error("assertIsAmbeedProductListResponse failed");
  }
}

export function isAmbeedProductListResponseValue(
  data: unknown,
): data is AmbeedProductListResponseValue {
  return checkObjectStructure(data, {
    /* eslint-disable */
    total: "number",
    pagenum: "number",
    pageindex: "number",
    pagesize: "number",
    list: "array",
    /* eslint-enable */
  });
}

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

export function isAmbeedSearchResponseProduct(data: unknown): data is AmbeedSearchResponseProduct {
  return checkObjectStructure(data, {
    /* eslint-disable */
    source: "number",
    code: "number",
    lang: "string",
    value: "object",
    time: "string",
    /* eslint-enable */
  });
}
