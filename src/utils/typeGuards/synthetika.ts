import { z } from "zod";

/**
 * This can be used to check if a SynthetikaSearchResponse is valid
 * @category Type Guards
 * @param data - The data to verify (raw response from Synthetika)
 * @returns True if the data is a SynthetikaSearchResponse, false otherwise
 * @example
 * ```typescript
 * const response = await fetch("https://synthetikaeu.com/webapi/front/en_US/products/usd/search/sodium%20chloride");
 * if (isSynthetikaSearchResponse(response)) {
 *   console.log(response.count);
 * }
 * ```
 * @source
 */
const synthetikaSearchResponseSchema = z.object({
  count: z.number(),
  pages: z.number(),
  page: z.number(),
  list: z.array(z.unknown()),
});

export function isSynthetikaSearchResponse(data: unknown): data is SynthetikaSearchResponse {
  return synthetikaSearchResponseSchema.safeParse(data).success;
}

/**
 * This can be used to check if a SynthetikaSearchResponse is valid
 * @category Type Guards
 * @param data - The data to verify (raw response from Synthetika)
 * @returns True if the data is a SynthetikaSearchResponse, false otherwise
 * @example
 * ```typescript
 * const response = await fetch("https://synthetikaeu.com/webapi/front/en_US/products/usd/search/sodium%20chloride");
 * assertIsSynthetikaSearchResponse(response);
 * const data = await response.json();
 * if (isSynthetikaSearchResponse(data)) {
 *   console.log(data.count);
 * }
 * ```
 * @source
 */
export function assertIsSynthetikaSearchResponse(
  data: unknown,
): asserts data is SynthetikaSearchResponse {
  if (!data || typeof data !== "object") {
    throw new Error("isSynthetikaSearchResponse: data is falsey or not an object");
  }

  if (!isSynthetikaSearchResponse(data)) {
    throw new Error("isSynthetikaSearchResponse: data is not a SynthetikaSearchResponse");
  }
}

/**
 * This can be used to typeguard a SynthetikaProduct
 * @category Type Guards
 * @param data - The data to typeguard
 * @returns True if the data is a SynthetikaProduct, false otherwise
 * @example
 * ```typescript
 * const product = { id: 1, name: "Product 1", url: "https://example.com" };
 * if (isSynthetikaProduct(product)) {
 *   console.log(product.name);
 * }
 * ```
 * @source
 */
/* eslint-disable @typescript-eslint/naming-convention */
const synthetikaProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  category: z.record(z.string(), z.unknown()),
  code: z.string(),
  can_buy: z.boolean(),
  availability: z.record(z.string(), z.unknown()),
  price: z.record(z.string(), z.unknown()),
  shortDescription: z.string(),
  producer: z.record(z.string(), z.unknown()).nullable(),
});
/* eslint-enable @typescript-eslint/naming-convention */

export function isSynthetikaProduct(data: unknown): data is SynthetikaProduct {
  return synthetikaProductSchema.safeParse(data).success;
}

/**
 * This can be used to typeguard the .price.gross and .price.net fields of a SynthetikaProduct
 * @category Type Guards
 * @param data - The data to typeguard
 * @returns True if the data is a SynthetikaProductPrice, false otherwise
 * @example
 * ```typescript
 * const product = { price: { gross: { final: "100" }, net: { final: "90" } } };
 * if (isSynthetikaProductPrice(product.price)) {
 *   console.log(product.price.gross.final);
 * }
 * ```
 * @source
 */
const synthetikaProductPriceSchema = z.object({
  base: z.string(),
  final: z.string(),
});

export function isSynthetikaProductPrice(data: unknown): data is SynthetikaProductPrice {
  return synthetikaProductPriceSchema.safeParse(data).success;
}

/**
 * This can be used to verify the .price.gross and .price.net fields of a SynthetikaProduct
 * @category Type Guards
 * @param data - The data to verify (raw response from Synthetika)
 * @returns True if the data is a SynthetikaProductPrice, false otherwise
 * @example
 * ```typescript
 * const product = { price: { gross: { final: "100" }, net: { final: "90" } } };
 * assertIsSynthetikaProductPrice(product.price.gross);
 * assertIsSynthetikaProductPrice(product.price.net);
 * console.log(product.price.gross.final);
 * ```
 * @source
 */
export function assertIsSynthetikaProductPrice(
  data: unknown,
): asserts data is SynthetikaProductPrice {
  if (!data || typeof data !== "object") {
    console.log("isSynthetikaProductPrice: data is falsey or not an object");
    throw new Error("isSynthetikaProductPrice: data is falsey or not an object");
  }

  if (!isSynthetikaProductPrice(data)) {
    console.log("isSynthetikaProductPrice: data is missing base or final");
    throw new Error("isSynthetikaProductPrice: data is missing base or final");
  }
}
