import { zodAddActualValueToIssues } from "@/helpers/utils";
import { z } from "zod";

/* eslint-disable @typescript-eslint/naming-convention */
const magento2MoneySchema = z.object({
  value: z.number(),
  currency: z.string(),
});
/* eslint-enable @typescript-eslint/naming-convention */

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
  return magento2MoneySchema.safeParse(value).success;
}

/* eslint-disable @typescript-eslint/naming-convention */
const magento2PriceBoundSchema = z.object({
  regular_price: magento2MoneySchema,
  final_price: magento2MoneySchema.optional(),
});

const magento2PriceRangeSchema = z.object({
  minimum_price: magento2PriceBoundSchema,
  maximum_price: magento2PriceBoundSchema.optional(),
});

const magento2GroupedItemSchema = z.object({
  qty: z.number().optional(),
  position: z.number().optional(),
  product: z.object({
    sku: z.string(),
    name: z.string(),
    stock_status: z.string().optional(),
    quantity: z.number().nullable().optional(),
    price_range: z.object({
      minimum_price: magento2PriceBoundSchema,
    }),
  }),
});

const magento2ConfigurableVariantSchema = z.object({
  attributes: z
    .array(
      z.object({
        code: z.string(),
        label: z.string().optional().nullable(),
        value_index: z.number(),
      }),
    )
    .optional(),
  product: z.object({
    uid: z.string().nullable().optional(),
    sku: z.string(),
    name: z.string(),
    stock_status: z.string().optional(),
    quantity: z.number().nullable().optional(),
    price_range: z.object({
      minimum_price: magento2PriceBoundSchema,
    }),
  }),
});

const magento2ProductItemSchema = z.object({
  __typename: z.string(),
  uid: z.string().nullable().optional(),
  sku: z.string(),
  name: z.string(),
  url_key: z.string(),
  url_suffix: z.string().nullable().optional(),
  stock_status: z.string().optional(),
  quantity: z.number().nullable().optional(),
  only_x_left_in_stock: z.number().nullable().optional(),
  price_range: magento2PriceRangeSchema,
  price_tiers: z.array(z.unknown()).optional().nullable(),
  short_description: z.object({ html: z.string() }).nullable().optional(),
  description: z.object({ html: z.string() }).nullable().optional(),
  image: z
    .object({
      url: z.string().optional(),
      label: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  categories: z.array(z.unknown()).nullable().optional(),
  items: z.array(magento2GroupedItemSchema).optional(),
  variants: z.array(magento2ConfigurableVariantSchema).optional(),
});
/* eslint-enable @typescript-eslint/naming-convention */

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
  return magento2ProductItemSchema.safeParse(item).success;
}

const magento2SearchResponseSchema = z.object({
  data: z.object({
    products: z.object({
      items: z.array(magento2ProductItemSchema),
    }),
  }),
  errors: z
    .array(
      z.object({
        message: z.string(),
      }),
    )
    .optional(),
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
  const parsed = magento2SearchResponseSchema.safeParse(response);
  if (!parsed.success) {
    console.warn("isValidMagento2SearchResponse: response is not a valid Magento2SearchResponse", {
      response,
      parsed,
      error: parsed.error,
      issues: zodAddActualValueToIssues(parsed.error.issues, response),
    });
  }
  return parsed.success;
}
