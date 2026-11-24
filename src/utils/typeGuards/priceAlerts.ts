import type { PriceAlert } from '@/helpers/priceAlerts';
import * as v from 'valibot';

const priceSnapshotSchema = v.looseObject({
  title: v.string(),
  price: v.number(),
  currencyCode: v.optional(v.string()),
});

const priceAlertSchema = v.looseObject({
  id: v.string(),
  supplier: v.string(),
  title: v.string(),
  createdAt: v.number(),
  failures: v.number(),
  lastPrices: v.record(v.string(), priceSnapshotSchema),
  ref: v.looseObject({
    cacheKey: v.string(),
    title: v.string(),
    url: v.string(),
    variants: v.array(v.looseObject({})),
  }),
});

/**
 * Type guard for a stored price alert.
 *
 * @category Typeguards
 * @param value - The stored value to check
 * @returns Whether the value is a price alert
 * @example
 * ```typescript
 * isPriceAlert(alert); // true
 * isPriceAlert({ id: '3f9c2a' }); // false
 * ```
 * @source
 */
export function isPriceAlert(value: unknown): value is PriceAlert {
  return v.is(priceAlertSchema, value);
}
