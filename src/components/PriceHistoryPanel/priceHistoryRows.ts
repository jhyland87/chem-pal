import { describeTrend } from '@/helpers/priceHistory';

/**
 * One logged price change, flattened from a {@link PriceHistoryEntry}'s point
 * series: the price observed immediately before the change, the price observed
 * after, and when the change was recorded.
 */
export interface PriceChangeRow {
  /** Stable row id: `${entry.id}::${pointIndex}`. */
  id: string;
  /** The product's stable identity key, shared by base and variant series. */
  productKey: string;
  /** Supplier display name. */
  supplier: string;
  /** Product/variant title. */
  title: string;
  /** Human-facing link back to the product, when known. */
  permalink?: string;
  /** Epoch ms timestamp of the new price (when the change was observed). */
  changedAt: number;
  /** The price in USD immediately before this change. */
  oldPriceUsd: number;
  /** The price in USD immediately after this change. */
  newPriceUsd: number;
  /** Signed USD delta (new − old). */
  deltaUsd: number;
  /** Signed percent change relative to the old price. */
  pctChange: number;
  /** Whether the change was a rise, a drop, or (only possible via rounding) flat. */
  direction: 'up' | 'down' | 'flat';
}

/**
 * Flattens every price-history series into one row per logged price change,
 * pairing each point with the one before it. A series with fewer than two
 * points has never changed and contributes no rows — this is what filters the
 * "which products actually do have price changes" view down to real movement.
 * @category Helpers
 * @group Formatters
 * @param entries - The price-history series to flatten, in any order.
 * @returns One {@link PriceChangeRow} per consecutive point pair, unsorted.
 * @example
 * ```ts
 * buildPriceChangeRows([
 *   {
 *     id: 'p1', productKey: 'p1', supplier: 'Loudwolf', title: 'Acetone 500ml',
 *     points: [{ t: 1, usd: 19.99 }, { t: 2, usd: 21.5 }], updatedAt: 2,
 *   },
 * ]);
 * // => [{ id: 'p1::1', productKey: 'p1', supplier: 'Loudwolf', title: 'Acetone 500ml',
 * //       changedAt: 2, oldPriceUsd: 19.99, newPriceUsd: 21.5, deltaUsd: 1.51,
 * //       pctChange: 7.55..., direction: 'up' }]
 * ```
 * @source
 */
export function buildPriceChangeRows(entries: readonly PriceHistoryEntry[]): PriceChangeRow[] {
  const rows: PriceChangeRow[] = [];
  for (const entry of entries) {
    for (let i = 1; i < entry.points.length; i++) {
      const prev = entry.points[i - 1];
      const curr = entry.points[i];
      const trend = describeTrend([prev, curr]);
      rows.push({
        id: `${entry.id}::${i}`,
        productKey: entry.productKey,
        supplier: entry.supplier,
        title: entry.title,
        permalink: entry.permalink,
        changedAt: curr.t,
        oldPriceUsd: prev.usd,
        newPriceUsd: curr.usd,
        deltaUsd: trend.deltaUsd,
        pctChange: trend.pctChange,
        direction: trend.direction,
      });
    }
  }
  return rows;
}
