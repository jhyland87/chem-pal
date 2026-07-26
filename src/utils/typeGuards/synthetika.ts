import * as v from 'valibot';

const synthetikaSearchResponseSchema = v.object({
  count: v.number(),
  pages: v.number(),
  page: v.number(),
  list: v.array(v.unknown()),
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
  const check = v.safeParse(synthetikaSearchResponseSchema, data);
  if (!check.success) {
    console.warn('isSynthetikaSearchResponse: data is not a SynthetikaSearchResponse', {
      data,
      check,
      issues: check.issues,
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
  if (!data || typeof data !== 'object') {
    throw new Error('isSynthetikaSearchResponse: data is falsey or not an object');
  }

  if (!isSynthetikaSearchResponse(data)) {
    throw new Error('isSynthetikaSearchResponse: data is not a SynthetikaSearchResponse');
  }
}

const synthetikaProductPriceSchema = v.object({
  base: v.string(),
  base_float: v.number(),
  final: v.string(),
  final_float: v.number(),
});

const synthetikaConfigurationOptionValueSchema = v.object({
  id: v.string(),
  order: v.string(),
  name: v.string(),
});

const synthetikaConfigurationOptionSchema = v.object({
  values: v.array(synthetikaConfigurationOptionValueSchema),
});

const synthetikaProductResponseSchema = v.object({
  id: v.number(),
  name: v.string(),
  can_buy: v.boolean(),
  code: v.string(),
  unit: v.object({
    name: v.string(),
    floating_point: v.boolean(),
  }),
  //stockId: v.number(),
  url: v.string(),
  availability: v.object({
    name: v.string(),
  }),
  price: v.object({
    gross: synthetikaProductPriceSchema,
    net: synthetikaProductPriceSchema,
  }),
  weight: v.object({
    weight_float: v.number(),
    weight: v.string(),
  }),
  //producer: v.nullable(v.record(v.string(), v.unknown())),
  shortDescription: v.string(),
  description: v.string(),
  options_configuration: v.optional(v.array(synthetikaConfigurationOptionSchema)),
});

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
  const check = v.safeParse(synthetikaProductResponseSchema, data);
  if (!check.success) {
    console.warn('isSynthetikaProduct: data is not a SynthetikaProduct', {
      data,
      check,
      issues: check.issues,
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
  return v.safeParse(synthetikaProductPriceSchema, data).success;
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
  if (!data || typeof data !== 'object') {
    console.log('isSynthetikaProductPrice: data is falsey or not an object');
    throw new Error('isSynthetikaProductPrice: data is falsey or not an object');
  }

  if (!isSynthetikaProductPrice(data)) {
    console.log('isSynthetikaProductPrice: data is missing base or final');
    throw new Error('isSynthetikaProductPrice: data is missing base or final');
  }
}
