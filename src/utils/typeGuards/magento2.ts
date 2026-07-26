import { addActualValueToIssues } from '@/helpers/utils';
import * as v from 'valibot';

const magento2MoneySchema = v.object({
  value: v.number(),
  currency: v.string(),
});

/**
 * Type guard to validate if an object is a valid Magento 2 Money payload.
 * Verifies that both the numeric `value` and ISO `currency` string are present.
 *
 * @category Typeguards
 * @param value - The object to validate
 * @returns Type predicate indicating if the value is a valid Magento2Money
 * @example
 * ```typescript
 * const money = { value: 9.9, currency: "USD" };
 * if (isMagento2Money(money)) {
 *   console.log("Valid money:", money.currency, money.value);
 * }
 * ```
 * @source
 */
export function isMagento2Money(value: unknown): value is Magento2Money {
  return v.safeParse(magento2MoneySchema, value).success;
}

const magento2PriceBoundSchema = v.object({
  regular_price: magento2MoneySchema,
  final_price: v.optional(magento2MoneySchema),
});

const magento2PriceRangeSchema = v.object({
  minimum_price: magento2PriceBoundSchema,
  maximum_price: v.optional(magento2PriceBoundSchema),
});

const magento2GroupedItemSchema = v.object({
  qty: v.optional(v.number()),
  position: v.optional(v.number()),
  product: v.object({
    sku: v.string(),
    name: v.string(),
    stock_status: v.optional(v.string()),
    quantity: v.optional(v.nullable(v.number())),
    price_range: v.object({
      minimum_price: magento2PriceBoundSchema,
    }),
  }),
});

const magento2ConfigurableVariantSchema = v.object({
  attributes: v.optional(
    v.array(
      v.object({
        code: v.string(),
        label: v.nullable(v.optional(v.string())),
        value_index: v.number(),
      }),
    ),
  ),
  product: v.object({
    uid: v.optional(v.nullable(v.string())),
    sku: v.string(),
    name: v.string(),
    stock_status: v.optional(v.string()),
    quantity: v.optional(v.nullable(v.number())),
    price_range: v.object({
      minimum_price: magento2PriceBoundSchema,
    }),
  }),
});

const magento2ProductItemSchema = v.object({
  __typename: v.string(),
  uid: v.optional(v.nullable(v.string())),
  sku: v.string(),
  name: v.string(),
  url_key: v.string(),
  url_suffix: v.optional(v.nullable(v.string())),
  stock_status: v.optional(v.string()),
  quantity: v.optional(v.nullable(v.number())),
  only_x_left_in_stock: v.optional(v.nullable(v.number())),
  price_range: magento2PriceRangeSchema,
  price_tiers: v.nullable(v.optional(v.array(v.unknown()))),
  short_description: v.optional(v.nullable(v.object({ html: v.string() }))),
  description: v.optional(v.nullable(v.object({ html: v.string() }))),
  image: v.optional(
    v.nullable(
      v.object({
        url: v.optional(v.string()),
        label: v.optional(v.nullable(v.string())),
      }),
    ),
  ),
  categories: v.optional(v.nullable(v.array(v.unknown()))),
  items: v.optional(v.array(magento2GroupedItemSchema)),
  variants: v.optional(v.array(magento2ConfigurableVariantSchema)),
});

/**
 * Type guard to validate if an object is a valid Magento 2 product item from a
 * `products.items` array. Tolerant of optional/nullable fields so partial data
 * (missing descriptions, images, etc.) still validates.
 *
 * @category Typeguards
 * @param item - The object to validate
 * @returns Type predicate indicating if the object is a valid Magento2ProductItem
 * @example
 * ```typescript
 * const item = {
 *   __typename: "GroupedProduct",
 *   uid: "MTAxMzkwMA==",
 *   sku: "S770339",
 *   name: "Sodium iodide",
 *   url_key: "sodium-iodide-aladdin-scientific-s105953",
 *   price_range: { minimum_price: { regular_price: { value: 9.9, currency: "USD" } } }
 * };
 * if (isMagento2ProductItem(item)) {
 *   console.log("Valid item:", item.sku);
 * }
 * ```
 * @source
 */
export function isMagento2ProductItem(item: unknown): item is Magento2ProductItem {
  return v.safeParse(magento2ProductItemSchema, item).success;
}

const magento2SearchResponseSchema = v.object({
  data: v.object({
    products: v.object({
      items: v.array(magento2ProductItemSchema),
    }),
  }),
  errors: v.optional(
    v.array(
      v.object({
        message: v.string(),
      }),
    ),
  ),
});

/**
 * Type guard to validate that a response from the Magento 2 GraphQL `products`
 * query matches the expected `Magento2SearchResponse` shape. Logs the parse
 * failure via `console.warn` to aid debugging mismatched schemas.
 *
 * @category Typeguards
 * @param response - The response object to validate
 * @returns Type predicate indicating if the response is a valid Magento2SearchResponse
 * @example
 * ```typescript
 * const response = await fetch("https://example.com/graphql", { method: "POST", body: query });
 * const json = await response.json();
 * if (isValidMagento2SearchResponse(json)) {
 *   console.log(`Found ${json.data.products.items.length} items`);
 * }
 * ```
 * @source
 */
export function isValidMagento2SearchResponse(
  response: unknown,
): response is Magento2SearchResponse {
  const parsed = v.safeParse(magento2SearchResponseSchema, response);
  if (!parsed.success) {
    console.warn('isValidMagento2SearchResponse: response is not a valid Magento2SearchResponse', {
      response,
      parsed,
      issues: addActualValueToIssues(parsed.issues, response),
    });
  }
  return parsed.success;
}
