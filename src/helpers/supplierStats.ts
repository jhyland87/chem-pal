/**
 * Pure helpers for the supplier-stats panel: filtering the recorded day-keyed
 * stats to a time range, and classifying each supplier's connection/parser
 * health. Kept free of React and IndexedDB so both are directly unit-testable.
 * @category Helpers
 * @group Stats
 * @showCategories
 * @categoryDescription Supplier statistics analysis.
 * @source
 */

/**
 * Selectable window for the stats views.
 * @category Helpers
 * @group Types
 * @source
 */
export type StatsRange = 'all' | 'today' | 'week' | 'month' | 'last7' | 'last30';

/**
 * Ordered range options for the dropdown, each with its i18n label key. Ordered
 * widest-to-narrowest so the default (`all`) sits first.
 * @category Helpers
 * @group Types
 * @source
 */
export const STATS_RANGES: ReadonlyArray<{ value: StatsRange; labelKey: string }> = [
  { value: 'all', labelKey: 'stats_range_all' },
  { value: 'last30', labelKey: 'stats_range_last30' },
  { value: 'last7', labelKey: 'stats_range_last7' },
  { value: 'month', labelKey: 'stats_range_month' },
  { value: 'week', labelKey: 'stats_range_week' },
  { value: 'today', labelKey: 'stats_range_today' },
];

/**
 * Formats a date as the `YYYY-MM-DD` key used by the stats store, in the
 * viewer's **local** time. These buckets are user-facing — "today" and the daily
 * chart's axis have to mean the user's day, not UTC's — so the store keys off
 * this too, keeping recording and filtering on the same calendar.
 * @param date - The date to format.
 * @returns The local date key.
 * @example
 * ```ts
 * // In UTC-5, 23:30 local on the 18th is 04:30 UTC on the 19th:
 * toDateKey(new Date("2026-07-19T04:30:00Z")); // => "2026-07-18"
 * ```
 * @category Helpers
 * @source
 */
export function toDateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Computes the inclusive earliest date key belonging to a range.
 * @param range - The selected range.
 * @param now - The reference "current" time.
 * @returns The earliest key in range, or `undefined` for `"all"` (no lower bound).
 */
function rangeStartKey(range: StatsRange, now: Date): string | undefined {
  // Local midnight, matching toDateKey's calendar.
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'all':
      return undefined;
    case 'today':
      return toDateKey(start);
    case 'last7':
      start.setDate(start.getDate() - 6); // inclusive of today
      return toDateKey(start);
    case 'last30':
      start.setDate(start.getDate() - 29);
      return toDateKey(start);
    case 'week':
      // Week starts Monday; getDay() is 0-6 with Sunday = 0.
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      return toDateKey(start);
    case 'month':
      start.setDate(1);
      return toDateKey(start);
    default:
      return undefined;
  }
}

/**
 * Narrows recorded stats to the days falling inside a range. Because the store
 * keys days as zero-padded `YYYY-MM-DD`, lexicographic comparison is equivalent
 * to chronological comparison, so no date parsing is needed per key.
 * @param stats - All recorded stats, keyed by date then supplier.
 * @param range - The window to keep.
 * @param now - Reference time; defaults to the current time. Injectable for tests.
 * @returns A new object containing only the in-range days.
 * @example
 * ```ts
 * filterStatsByRange(stats, "today", new Date("2026-07-18T10:00:00Z"));
 * // => { "2026-07-18": { … } }
 * ```
 * @category Helpers
 * @source
 */
export function filterStatsByRange(
  stats: SupplierStatsData,
  range: StatsRange,
  now: Date = new Date(),
): SupplierStatsData {
  const from = rangeStartKey(range, now);
  if (from === undefined) {
    return stats;
  }

  const to = toDateKey(now);
  const filtered: SupplierStatsData = {};
  for (const [dateKey, dayStats] of Object.entries(stats)) {
    if (dateKey >= from && dateKey <= to) {
      filtered[dateKey] = dayStats;
    }
  }
  return filtered;
}

/**
 * Health verdict for one supplier over the selected range.
 * @category Helpers
 * @group Types
 * @source
 */
export type SupplierHealthStatus =
  | 'ok'
  | 'disabled'
  | 'parseErrors'
  | 'parseFailure'
  | 'connectionErrors'
  | 'noSuccess';

/**
 * The per-supplier counters the classifier reads.
 * @category Helpers
 * @group Types
 * @source
 */
export interface SupplierTotals {
  success: number;
  failure: number;
  /**
   * Non-cached product detail fetches. Carried for display only — deliberately
   * *not* used to grade parser health, since a supplier serving cached results
   * reports zero here while parsing fine.
   */
  products: number;
  parseErrors: number;
}

/** i18n label key per status, for the Status column and the row tooltip. */
const STATUS_LABEL_KEYS: Record<SupplierHealthStatus, string> = {
  ok: 'stats_status_ok',
  disabled: 'stats_status_disabled',
  parseErrors: 'stats_status_parse_errors',
  parseFailure: 'stats_status_parse_failure',
  connectionErrors: 'stats_status_connection_errors',
  noSuccess: 'stats_status_no_success',
};

/**
 * Failure share at or above which a category counts as "excessive". Below this a
 * supplier is treated as healthy — occasional failures are normal. Total failure
 * (a ratio of 1) escalates to the critical status for that category.
 *
 * Exported so callers and tests can reference the threshold rather than
 * duplicating the literal.
 * @category Constants
 * @group Stats
 * @source
 */
export const EXCESSIVE_RATIO = 0.5;

/** Worst-first ordering; the headline status is the first match. */
const SEVERITY_ORDER: SupplierHealthStatus[] = [
  'noSuccess',
  'parseFailure',
  'connectionErrors',
  'parseErrors',
];

/**
 * Returns the i18n key for a health status label.
 * @param status - The classified status.
 * @returns The message key to pass to `i18n()`.
 * @example
 * ```ts
 * statusLabelKey("noSuccess"); // => "stats_status_no_success"
 * ```
 * @category Helpers
 * @source
 */
export function statusLabelKey(status: SupplierHealthStatus): string {
  return STATUS_LABEL_KEYS[status];
}

/**
 * Classifies a supplier's connection and parsing health from its totals.
 *
 * A supplier the user has turned off reports `disabled` outright — its historical
 * counters say nothing about current health, so grading them would be misleading.
 *
 * Otherwise each category is graded as a *share* of its attempts, at two tiers —
 * "excessive" at {@link EXCESSIVE_RATIO}, critical at total failure — and the
 * worst applicable status becomes the headline:
 * - `noSuccess` — calls were made and none succeeded (critical connection).
 * - `connectionErrors` — at least half of all calls failed.
 * - `parseFailure` — every successful call failed to parse (critical parser).
 * - `parseErrors` — at least half of successful calls failed to parse.
 *
 * Parse health is measured against **successful calls**, not products. Products
 * would be a misleading denominator: `uniqueProductCount` only counts non-cached
 * detail fetches, so a supplier serving cached results — or one that never fetches
 * detail pages — reports zero products while parsing perfectly well.
 *
 * A supplier with no recorded activity is `ok` rather than flagged: absence of
 * traffic isn't evidence of a problem.
 * @param totals - The supplier's aggregated counters for the selected range.
 * @param disabled - Whether the user has disabled this supplier in settings.
 * @returns The worst applicable status, plus every applicable reason for tooltips.
 * @example
 * ```ts
 * classifySupplierHealth({ success: 114, failure: 14, products: 0, parseErrors: 10 });
 * // => { status: "ok", reasons: [] }          // 11% failures, 9% parse errors
 * classifySupplierHealth({ success: 0, failure: 4, products: 0, parseErrors: 0 });
 * // => { status: "noSuccess", reasons: ["noSuccess"] }
 * classifySupplierHealth({ success: 10, failure: 0, products: 0, parseErrors: 10 });
 * // => { status: "parseFailure", reasons: ["parseFailure"] }
 * ```
 * @category Helpers
 * @source
 */
export function classifySupplierHealth(
  totals: SupplierTotals,
  disabled: boolean = false,
): {
  status: SupplierHealthStatus;
  reasons: SupplierHealthStatus[];
} {
  if (disabled) {
    return { status: 'disabled', reasons: [] };
  }

  const { success, failure, parseErrors } = totals;
  const reasons: SupplierHealthStatus[] = [];

  const calls = success + failure;
  if (calls > 0) {
    if (success === 0) {
      reasons.push('noSuccess');
    } else if (failure / calls >= EXCESSIVE_RATIO) {
      reasons.push('connectionErrors');
    }
  }

  // Only successful calls return a body to parse, so they're the denominator.
  // When success is 0 the connection status already tells the story.
  if (success > 0 && parseErrors > 0) {
    if (parseErrors >= success) {
      reasons.push('parseFailure');
    } else if (parseErrors / success >= EXCESSIVE_RATIO) {
      reasons.push('parseErrors');
    }
  }

  const status = SEVERITY_ORDER.find((candidate) => reasons.includes(candidate)) ?? 'ok';
  return { status, reasons };
}
