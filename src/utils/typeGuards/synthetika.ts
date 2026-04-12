import { z } from "zod";

const synthetikaSearchResponseSchema = z.object({
  count: z.number(),
  pages: z.number(),
  page: z.number(),
  list: z.array(z.unknown()),
});

/**
 * This can be used to check if a SynthetikaSearchResponse is valid
 *
 * @category Typeguards
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
export function isSynthetikaSearchResponse(data: unknown): data is SynthetikaSearchResponse {
  const check = synthetikaSearchResponseSchema.safeParse(data);
  if (!check.success) {
    console.warn("isSynthetikaSearchResponse: data is not a SynthetikaSearchResponse", {
      data,
      check,
      error: check.error,
      issues: check.error.issues,
    });
  }
  return check.success;
}

/**
 * This can be used to check if a SynthetikaSearchResponse is valid
 *
 * @category Typeguards
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

const synthetikaProductPriceSchema = z.object({
  base: z.string(),
  base_float: z.number(),
  final: z.string(),
  final_float: z.number(),
});

/* eslint-disable @typescript-eslint/naming-convention */
const synthetikaConfigurationOptionValueSchema = z.object({
  id: z.string(),
  order: z.string(),
  name: z.string(),
});

const synthetikaConfigurationOptionSchema = z.object({
  values: z.array(synthetikaConfigurationOptionValueSchema),
});

const synthetikaProductResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  can_buy: z.boolean(),
  code: z.string(),
  unit: z.object({
    name: z.string(),
    floating_point: z.boolean(),
  }),
  //stockId: z.number(),
  url: z.string(),
  availability: z.object({
    name: z.string(),
  }),
  price: z.object({
    gross: synthetikaProductPriceSchema,
    net: synthetikaProductPriceSchema,
  }),
  weight: z.object({
    weight_float: z.number(),
    weight: z.string(),
  }),
  //producer: z.record(z.string(), z.unknown()).nullable(),
  shortDescription: z.string(),
  description: z.string(),
  options_configuration: z.array(synthetikaConfigurationOptionSchema).optional(),
});

/* eslint-enable @typescript-eslint/naming-convention */

/**
 * This can be used to typeguard a SynthetikaProduct
 *
 * @category Typeguards
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
export function isSynthetikaProduct(data: unknown): data is SynthetikaProduct {
  const check = synthetikaProductResponseSchema.safeParse(data);
  if (!check.success) {
    console.warn("isSynthetikaProduct: data is not a SynthetikaProduct", {
      data,
      check,
      error: check.error,
      issues: check.error.issues,
    });
  }
  return check.success;
}

/**
 * This can be used to typeguard the .price.gross and .price.net fields of a SynthetikaProduct
 *
 * @category Typeguards
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
export function isSynthetikaProductPrice(data: unknown): data is SynthetikaProductPrice {
  return synthetikaProductPriceSchema.safeParse(data).success;
}

/**
 * This can be used to verify the .price.gross and .price.net fields of a SynthetikaProduct
 *
 * @category Typeguards
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
