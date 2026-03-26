/**
 * Utility for persisting per-supplier, per-day search statistics
 * in chrome.storage.local.
 *
 * Each day gets its own storage key: `supplier_stats_MMDDYYYY`
 * This avoids hitting chrome.storage.local's per-item size limit.
 *
 * Uses an in-memory buffer to avoid race conditions from concurrent
 * fire-and-forget writes. Flushes to storage on a debounced timer.
 *
 * All stat calls use `supplierName` from SupplierBase (e.g. "Carolina"),
 * NOT the class name (e.g. "SupplierCarolina"), to keep keys consistent.
 *
 * Cached responses do NOT increment HTTP or product counts.
 * Auto-prunes entries older than 30 days on each flush.
 *
 * @category Utils
 */

const STORAGE_PREFIX = "supplier_stats_";
const RETENTION_DAYS = 30;
const FLUSH_DELAY_MS = 500;

/** In-memory pending increments, keyed by date:supplier:field */
const pendingIncrements: Map<string, number> = new Map();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Returns today's date as MMDDYYYY for storage key */
function todayStorageKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${STORAGE_PREFIX}${mm}${dd}${yyyy}`;
}

/** Returns today's date as YYYY-MM-DD for data grouping */
function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Extract YYYY-MM-DD from a storage key like supplier_stats_03262026 */
function storageKeyToDateKey(storageKey: string): string | null {
  const suffix = storageKey.replace(STORAGE_PREFIX, "");
  if (suffix.length !== 8) return null;
  const mm = suffix.slice(0, 2);
  const dd = suffix.slice(2, 4);
  const yyyy = suffix.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
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

/** Convert a YYYY-MM-DD date key to a MMDDYYYY storage key */
function dateKeyToStorageKey(dateKey: string): string {
  const [yyyy, mm, dd] = dateKey.split("-");
  return `${STORAGE_PREFIX}${mm}${dd}${yyyy}`;
}

/**
 * Apply all pending increments to storage. Groups by date so each day's
 * data goes to its own storage key (supplier_stats_MMDDYYYY).
 */
function flushToStorage(): void {
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

  // Read + update each day's storage key separately
  const dateKeys = Object.keys(byDate);
  const storageKeys = dateKeys.map(dateKeyToStorageKey);

  chrome.storage.local
    .get(storageKeys)
    .then((data) => {
      const updates: Record<string, Record<string, SupplierDayStats>> = {};

      for (const dateKey of dateKeys) {
        const sKey = dateKeyToStorageKey(dateKey);
        const existing: Record<string, SupplierDayStats> =
          data[sKey] && typeof data[sKey] === "object" ? data[sKey] : {};

        for (const [, supplier, field, delta] of byDate[dateKey]) {
          if (!existing[supplier]) existing[supplier] = { ...EMPTY_STATS };
          (existing[supplier][field] as number) += delta;
        }

        updates[sKey] = existing;
      }

      return chrome.storage.local.set(updates);
    })
    .then(() => {
      // Prune old entries
      pruneOldStorageKeys();
    })
    .catch((error) => {
      console.warn("Failed to flush supplier stats:", error);
      for (const [key, delta] of batch) {
        pendingIncrements.set(key, (pendingIncrements.get(key) ?? 0) + delta);
      }
      scheduleFlush();
    });
}

/** Remove storage keys older than RETENTION_DAYS */
function pruneOldStorageKeys(): void {
  const cutoff = getCutoffDateKey();
  chrome.storage.local.get(null).then((allData) => {
    const keysToRemove: string[] = [];
    for (const key of Object.keys(allData)) {
      if (!key.startsWith(STORAGE_PREFIX)) continue;
      const dateKey = storageKeyToDateKey(key);
      if (dateKey && dateKey < cutoff) {
        keysToRemove.push(key);
      }
    }
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove).catch((err) => {
        console.warn("Failed to prune old supplier stats:", err);
      });
    }
  });
}

/** Increment search query count (called once per supplier at start of execute()) */
export function incrementSearchQueryCount(supplier: string): void {
  bufferIncrement(supplier, "searchQueryCount");
}

/** Increment successful HTTP connection count (HTTP 2xx, non-cached) */
export function incrementSuccess(supplier: string): void {
  bufferIncrement(supplier, "successCount");
}

/** Increment failed HTTP connection count (HTTP 4xx/5xx, network errors, non-cached) */
export function incrementFailure(supplier: string): void {
  bufferIncrement(supplier, "failureCount");
}

/** Increment unique product count (called when a non-cached product detail is fetched) */
export function incrementProductCount(supplier: string): void {
  bufferIncrement(supplier, "uniqueProductCount");
}

/** Increment parse/processing error count (called when product processing throws) */
export function incrementParseError(supplier: string): void {
  bufferIncrement(supplier, "parseErrorCount");
}

/**
 * Migrate legacy `supplierStats` single-object storage to per-day keys.
 * Runs once; deletes the old key after migration.
 */
async function migrateLegacyStats(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(["supplierStats"]);
    if (!data.supplierStats || typeof data.supplierStats !== "object") return;

    const legacy = data.supplierStats as SupplierStatsData;
    const updates: Record<string, Record<string, SupplierDayStats>> = {};

    for (const [dateKey, suppliers] of Object.entries(legacy)) {
      const storageKey = dateKeyToStorageKey(dateKey);
      updates[storageKey] = suppliers;
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
    await chrome.storage.local.remove("supplierStats");
    console.log("Migrated legacy supplierStats to per-day keys");
  } catch (error) {
    console.warn("Failed to migrate legacy supplier stats:", error);
  }
}

/**
 * Read all stats from storage, reassembling from per-day keys into
 * the SupplierStatsData shape: { [dateKey]: { [supplier]: SupplierDayStats } }
 */
export async function getStats(): Promise<SupplierStatsData> {
  // Migrate old format if it exists
  await migrateLegacyStats();

  flushToStorage();
  try {
    const allData = await chrome.storage.local.get(null);
    const result: SupplierStatsData = {};

    for (const [key, value] of Object.entries(allData)) {
      if (!key.startsWith(STORAGE_PREFIX)) continue;
      const dateKey = storageKeyToDateKey(key);
      if (dateKey && typeof value === "object" && value !== null) {
        result[dateKey] = value as Record<string, SupplierDayStats>;
      }
    }

    return result;
  } catch (error) {
    console.warn("Failed to read supplier stats:", error);
    return {};
  }
}

/** Clear all stats — removes all supplier_stats_* keys */
export async function clearStats(): Promise<void> {
  pendingIncrements.clear();
  try {
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(allData).filter((k) => k.startsWith(STORAGE_PREFIX));
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  } catch (error) {
    console.warn("Failed to clear supplier stats:", error);
  }
}
