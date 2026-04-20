/**
 * Utility for persisting per-supplier, per-day search statistics
 * in IndexedDB via the `supplierStats` object store.
 *
 * Each day gets its own record keyed by `YYYY-MM-DD`.
 *
 * Uses an in-memory buffer to avoid race conditions from concurrent
 * fire-and-forget writes. Flushes to IndexedDB on a debounced timer.
 *
 * All stat calls use `supplierName` from SupplierBase (e.g. "Carolina"),
 * NOT the class name (e.g. "SupplierCarolina"), to keep keys consistent.
 *
 * Cached responses do NOT increment HTTP or product counts.
 * Auto-prunes entries older than 30 days on each flush.
 *
 * @category Utils
 * @source
 */

import {
  getSupplierStatsEntry,
  putSupplierStatsEntry,
  getAllSupplierStats,
  deleteSupplierStatsEntries,
  clearSupplierStats as idbClearSupplierStats,
} from "@/utils/idbCache";
import { IS_DEV_BUILD } from "@/utils/isDevBuild";

const RETENTION_DAYS = 30;
const FLUSH_DELAY_MS = 500;

/** In-memory pending increments, keyed by date:supplier:field */
const pendingIncrements: Map<string, number> = new Map();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Returns today's date as YYYY-MM-DD for data grouping */
function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Get the cutoff date key for pruning */
function getCutoffDateKey(): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  return cutoff.toISOString().slice(0, 10);
}

const EMPTY_STATS: SupplierDayStats = {
  searchQueryCount: 0,
  successCount: 0,
  failureCount: 0,
  uniqueProductCount: 0,
  parseErrorCount: 0,
};

/**
 * Buffer an increment in memory and schedule a debounced flush to storage.
 * @source
 */
function bufferIncrement(supplier: string, field: keyof SupplierDayStats): void {
  const key = `${todayDateKey()}:${supplier}:${field}`;
  pendingIncrements.set(key, (pendingIncrements.get(key) ?? 0) + 1);
  scheduleFlush();
}

/** Schedule a flush if one isn't already pending */
function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushToStorage();
  }, FLUSH_DELAY_MS);
}

/**
 * Apply all pending increments to IndexedDB. Groups by date so each day's
 * data goes to its own record in the `supplierStats` object store.
 * @source
 */
async function flushToStorage(): Promise<void> {
  if (pendingIncrements.size === 0) return;

  const batch = new Map(pendingIncrements);
  pendingIncrements.clear();

  // Group increments by date
  const byDate: Record<string, Array<[string, string, keyof SupplierDayStats, number]>> = {};
  for (const [key, delta] of batch) {
    const [date, supplier, field] = key.split(":") as [string, string, keyof SupplierDayStats];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push([date, supplier, field, delta]);
  }

  try {
    for (const dateKey of Object.keys(byDate)) {
      const existing = (await getSupplierStatsEntry(dateKey)) ?? {};

      for (const [, supplier, field, delta] of byDate[dateKey]) {
        if (!existing[supplier]) existing[supplier] = { ...EMPTY_STATS };
        (existing[supplier][field] as number) += delta;
      }

      await putSupplierStatsEntry(dateKey, existing);
    }

    // Prune old entries
    await pruneOldEntries();
  } catch (error) {
    console.warn("Failed to flush supplier stats:", error);
    for (const [key, delta] of batch) {
      pendingIncrements.set(key, (pendingIncrements.get(key) ?? 0) + delta);
    }
    scheduleFlush();
  }
}

/** Remove records older than RETENTION_DAYS */
async function pruneOldEntries(): Promise<void> {
  const cutoff = getCutoffDateKey();
  try {
    const allStats = await getAllSupplierStats();
    const keysToRemove = Object.keys(allStats).filter((dateKey) => dateKey < cutoff);
    if (keysToRemove.length > 0) {
      await deleteSupplierStatsEntries(keysToRemove);
    }
  } catch (err) {
    console.warn("Failed to prune old supplier stats:", err);
  }
}

/** Increment search query count (called once per supplier at start of execute()) */
export function incrementSearchQueryCount(supplier: string): void {
  if (!IS_DEV_BUILD) return;
  bufferIncrement(supplier, "searchQueryCount");
}

/** Increment successful HTTP connection count (HTTP 2xx, non-cached) */
export function incrementSuccess(supplier: string): void {
  if (!IS_DEV_BUILD) return;
  bufferIncrement(supplier, "successCount");
}

/** Increment failed HTTP connection count (HTTP 4xx/5xx, network errors, non-cached) */
export function incrementFailure(supplier: string): void {
  if (!IS_DEV_BUILD) return;
  bufferIncrement(supplier, "failureCount");
}

/** Increment unique product count (called when a non-cached product detail is fetched) */
export function incrementProductCount(supplier: string): void {
  if (!IS_DEV_BUILD) return;
  bufferIncrement(supplier, "uniqueProductCount");
}

/** Increment parse/processing error count (called when product processing throws) */
export function incrementParseError(supplier: string): void {
  if (!IS_DEV_BUILD) return;
  bufferIncrement(supplier, "parseErrorCount");
}

/**
 * Read all stats from IndexedDB, returning the SupplierStatsData shape:
 * `{ [dateKey]: { [supplier]: SupplierDayStats } }`. Returns an empty object
 * in production builds, where stats tracking is disabled.
 * @source
 */
export async function getStats(): Promise<SupplierStatsData> {
  if (!IS_DEV_BUILD) return {};
  // Flush any pending increments first
  await flushToStorage();
  try {
    return await getAllSupplierStats();
  } catch (error) {
    console.warn("Failed to read supplier stats:", error);
    return {};
  }
}

/** Clear all stats — removes all records from the supplierStats store. No-op in production. */
export async function clearStats(): Promise<void> {
  if (!IS_DEV_BUILD) return;
  pendingIncrements.clear();
  try {
    await idbClearSupplierStats();
  } catch (error) {
    console.warn("Failed to clear supplier stats:", error);
  }
}
