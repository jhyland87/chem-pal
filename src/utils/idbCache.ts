import { maxHistoryEntries, maxSupplierCacheEntries } from "@/../config.json";
import { IDB_STORE, type IdbStore } from "@/constants/common";
import type { ExcludedProductsMap } from "@/helpers/excludedProducts";
import { Logger } from "@/utils/Logger";
import { type DBSchema, type IDBPDatabase, openDB } from "idb";

/**
 * Custom event name dispatched when search results are cleared.
 * Consumers listen for this via `window.addEventListener` to replace
 * the former `cstorage.onChanged` pattern for `search_results`.
 * @category Utils
 */
export const IDB_SEARCH_RESULTS_CLEARED = "idb:search-results-cleared";

/**
 * Custom event name dispatched when supplier stats are updated.
 * Consumers listen for this to live-refresh stats during searches.
 * @category Utils
 */
export const IDB_SUPPLIER_STATS_UPDATED = "idb:supplier-stats-updated";

const logger = new Logger("idbCache");

const DB_NAME = "chempal";
const DB_VERSION = 6;

/** Single-row key used by the `app_meta` store (mirrors the `"current"` pattern of `search_results`). */
const APP_META_KEY = "current";
// Cache-capacity caps live in config.json alongside the other build-time tunables.
const MAX_SUPPLIER_CACHE_ENTRIES = maxSupplierCacheEntries;
const MAX_HISTORY_ENTRIES = maxHistoryEntries;

interface ChemPalDBSchema extends DBSchema {
  search_results: {
    key: string;
    value: {
      id: string;
      data: Product[];
      query?: string;
    };
  };
  search_history: {
    key: number;
    value: SearchHistoryEntry;
  };
  supplier_query_cache: {
    key: string;
    value: {
      cacheKey: string;
      data: unknown[];
      __cacheMetadata: {
        cachedAt: number;
        version: number;
        query: string;
        supplier: string;
        supplierModule: string;
        resultCount: number;
        limit: number;
      };
    };
    indexes: {
      cachedAt: number;
    };
  };
  supplier_product_data_cache: {
    key: string;
    value: {
      cacheKey: string;
      data: Record<string, unknown>;
      timestamp: number;
    };
    indexes: {
      timestamp: number;
    };
  };
  supplier_stats: {
    key: string;
    value: {
      dateKey: string;
      suppliers: Record<string, SupplierDayStats>;
    };
  };
  excluded_products: {
    key: string;
    value: {
      id: string;
      map: ExcludedProductsMap;
    };
  };
  price_history: {
    key: string;
    value: PriceHistoryEntry;
    indexes: {
      productKey: string;
    };
  };
  app_meta: {
    key: string;
    value: {
      id: string;
      appVersion: string;
      updatedAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ChemPalDBSchema>> | null = null;

/**
 * Returns a singleton promise to the opened IndexedDB database.
 * Creates object stores on first open via the `upgrade` callback.
 */
function getDB(): Promise<IDBPDatabase<ChemPalDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<ChemPalDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(IDB_STORE.SEARCH_RESULTS)) {
          db.createObjectStore(IDB_STORE.SEARCH_RESULTS, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(IDB_STORE.SEARCH_HISTORY)) {
          db.createObjectStore(IDB_STORE.SEARCH_HISTORY, { keyPath: "timestamp" });
        }

        if (!db.objectStoreNames.contains(IDB_STORE.SUPPLIER_QUERY_CACHE)) {
          const sqc = db.createObjectStore(IDB_STORE.SUPPLIER_QUERY_CACHE, { keyPath: "cacheKey" });
          sqc.createIndex("cachedAt", "__cacheMetadata.cachedAt");
        }

        if (!db.objectStoreNames.contains(IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE)) {
          const spdc = db.createObjectStore(IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE, {
            keyPath: "cacheKey",
          });
          spdc.createIndex("timestamp", "timestamp");
        }

        if (!db.objectStoreNames.contains(IDB_STORE.SUPPLIER_STATS)) {
          db.createObjectStore(IDB_STORE.SUPPLIER_STATS, { keyPath: "dateKey" });
        }

        if (!db.objectStoreNames.contains(IDB_STORE.EXCLUDED_PRODUCTS)) {
          db.createObjectStore(IDB_STORE.EXCLUDED_PRODUCTS, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(IDB_STORE.PRICE_HISTORY)) {
          const ph = db.createObjectStore(IDB_STORE.PRICE_HISTORY, { keyPath: "id" });
          ph.createIndex("productKey", "productKey");
        }

        if (!db.objectStoreNames.contains(IDB_STORE.APP_META)) {
          db.createObjectStore(IDB_STORE.APP_META, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

function emitSearchResultsCleared(): void {
  window.dispatchEvent(new CustomEvent(IDB_SEARCH_RESULTS_CLEARED));
}

function emitSupplierStatsUpdated(): void {
  window.dispatchEvent(new CustomEvent(IDB_SUPPLIER_STATS_UPDATED));
}

/* -------------------------------------------------------------------------- */
/*                            Search Results                                  */
/* -------------------------------------------------------------------------- */

/**
 * Reads the persisted search results. The row is stored under a single
 * `"current"` key, so this is one read. See {@link getSearchResultsRecord} when
 * the originating query is needed too.
 * @category Utils
 * @returns The persisted products, or `[]` when nothing is stored or the read fails.
 * @example
 * ```ts
 * const products = await getSearchResults(); // => [{ id: "…", title: "Acetone" }]
 * ```
 * @source
 */
export async function getSearchResults(): Promise<Product[]> {
  try {
    const db = await getDB();
    const record = await db.get(IDB_STORE.SEARCH_RESULTS, "current");
    return record?.data ?? [];
  } catch (error) {
    logger.error("Failed to get search results from IndexedDB", { error });
    return [];
  }
}

/**
 * Reads the persisted `search_results` row as a whole, returning both the product
 * `data` and the `query` that produced it. Use this (instead of {@link getSearchResults})
 * when the caller also needs the originating query — e.g. to rehydrate the results
 * header label so it stays in sync with the persisted results.
 * @category Utils
 * @returns The persisted results and query. `data` is `[]` and `query` is `undefined`
 * when no row exists (or the row predates the `query` field).
 * @example
 * ```ts
 * await getSearchResultsRecord(); // { data: [{ id: "A", ... }], query: "acetone" }
 * ```
 * @source
 */
export async function getSearchResultsRecord(): Promise<{ data: Product[]; query?: string }> {
  try {
    const db = await getDB();
    const record = await db.get(IDB_STORE.SEARCH_RESULTS, "current");
    return { data: record?.data ?? [], query: record?.query };
  } catch (error) {
    logger.error("Failed to get search results record from IndexedDB", { error });
    return { data: [] };
  }
}

/**
 * Derives a stable per-product identity used to detect duplicates, independent
 * of the positional `_id`. Prefers the supplier-stable `cacheKey`, then the real
 * product `id`, and finally the `supplier`+`url` pair.
 * @param product - The product to key.
 * @returns A string identity unique to the underlying product.
 * @example
 * ```ts
 * productIdentity({ cacheKey: "P000805666", ... }); // "ck:P000805666"
 * ```
 * @source
 */
function productIdentity(product: Product): string {
  if (product.cacheKey) {
    return `ck:${product.cacheKey}`;
  }
  if (product.id != null) {
    return `id:${String(product.id)}`;
  }
  return `su:${product.supplier}:${product.url}`;
}

/**
 * Finds product identities that appear more than once, keyed by
 * `productIdentity` (ignoring the positional `_id`). This is detection, not
 * repair: the same product appearing twice means the search almost certainly ran
 * twice, so callers surface it rather than silently removing the duplicates.
 * @category Utils
 * @param results - The products to scan.
 * @returns The duplicated identities (empty when every product is unique).
 * @example
 * ```ts
 * findDuplicateProductIds([{ id: "A" }, { id: "A" }, { id: "B" }]); // ["id:A"]
 * ```
 * @source
 */
export function findDuplicateProductIds(results: Product[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const product of results) {
    const key = productIdentity(product);
    if (seen.has(key)) {
      duplicates.add(key);
    } else {
      seen.add(key);
    }
  }
  return [...duplicates];
}

/**
 * Persists the current search results (and the query that produced them) to the
 * single `"current"` `search_results` row. Storing the `query` alongside `data`
 * keeps the two in lockstep, so the results header can rehydrate the query even
 * when the transient session copy is gone. Duplicate products are logged (not
 * removed); an empty result set dispatches {@link IDB_SEARCH_RESULTS_CLEARED}.
 * @category Utils
 * @param results - The products to persist.
 * @param query - The originating search query. Omitted for callers with no query
 * context; stored as `undefined` in that case.
 * @example
 * ```ts
 * await setSearchResults([{ id: "A", ... }], "acetone");
 * ```
 * @source
 */
export async function setSearchResults(results: Product[], query?: string): Promise<void> {
  try {
    const db = await getDB();
    // Detect (do NOT silently remove) duplicates before persisting. The same
    // product appearing twice means the search almost certainly fired twice —
    // surface that loudly instead of masking the underlying double-search bug.
    const duplicateIds = findDuplicateProductIds(results);
    if (duplicateIds.length > 0) {
      logger.warn("Duplicate products in search results — the search likely fired twice", {
        duplicateCount: duplicateIds.length,
        duplicateIds,
        total: results.length,
      });
    }
    await db.put(IDB_STORE.SEARCH_RESULTS, { id: "current", data: results, query });
    if (results.length === 0) {
      emitSearchResultsCleared();
    }
  } catch (error) {
    logger.error("Failed to set search results in IndexedDB", { error });
  }
}

/**
 * Clears all persisted search results from IndexedDB.
 * By default this dispatches {@link IDB_SEARCH_RESULTS_CLEARED} so listeners
 * (e.g. the App) can react to an explicit, user-initiated clear. Pass
 * `{ notify: false }` to clear silently — used when resetting the store at the
 * start of a new search, where firing the event would bounce the user off the
 * results panel.
 * @category Utils
 * @param options - Clear behavior.
 * - `notify` - Whether to dispatch {@link IDB_SEARCH_RESULTS_CLEARED} (default `true`).
 * @example
 * ```ts
 * await clearSearchResults();                  // clears + notifies listeners
 * await clearSearchResults({ notify: false }); // clears silently
 * ```
 * @source
 */
export async function clearSearchResults(options: { notify?: boolean } = {}): Promise<void> {
  const { notify = true } = options;
  try {
    const db = await getDB();
    await db.delete(IDB_STORE.SEARCH_RESULTS, "current");
    if (notify) {
      emitSearchResultsCleared();
    }
  } catch (error) {
    logger.error("Failed to clear search results from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                            Search History                                  */
/* -------------------------------------------------------------------------- */

/**
 * Reads every search-history entry, newest first.
 * @category Utils
 * @returns History entries sorted by descending timestamp, or `[]` on failure.
 * @example
 * ```ts
 * const history = await getSearchHistory(); // => [{ query: "acetone", timestamp: 172… }]
 * ```
 * @source
 */
export async function getSearchHistory(): Promise<SearchHistoryEntry[]> {
  try {
    const db = await getDB();
    const all = await db.getAll(IDB_STORE.SEARCH_HISTORY);
    // Return sorted newest-first
    return all.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    logger.error("Failed to get search history from IndexedDB", { error });
    return [];
  }
}

/**
 * Appends a search-history entry, evicting the oldest rows once the store
 * exceeds `maxHistoryEntries` from config.json.
 * @category Utils
 * @param entry - The entry to store; its `timestamp` is the primary key.
 * @returns Resolves once the write (and any eviction) completes.
 * @example
 * ```ts
 * await addSearchHistoryEntry({ query: "acetone", timestamp: Date.now(), resultCount: 12 });
 * ```
 * @source
 */
export async function addSearchHistoryEntry(entry: SearchHistoryEntry): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(IDB_STORE.SEARCH_HISTORY, "readwrite");
    const store = tx.objectStore(IDB_STORE.SEARCH_HISTORY);

    await store.put(entry);

    // Enforce max entries — delete oldest if over limit
    const count = await store.count();
    if (count > MAX_HISTORY_ENTRIES) {
      const excess = count - MAX_HISTORY_ENTRIES;
      let cursor = await store.openCursor();
      let deleted = 0;
      while (cursor && deleted < excess) {
        await cursor.delete();
        deleted++;
        cursor = await cursor.continue();
      }
    }

    await tx.done;
  } catch (error) {
    logger.error("Failed to add search history entry to IndexedDB", { error });
  }
}

/**
 * Backfills the result count on an existing history entry, which is written
 * before the search finishes and so starts out without one. No-ops when the
 * entry is gone (e.g. already evicted).
 * @category Utils
 * @param timestamp - Primary key of the entry to update.
 * @param count - The final number of results for that search.
 * @returns Resolves once the update completes.
 * @example
 * ```ts
 * await updateSearchHistoryResultCount(1712345678901, 42);
 * ```
 * @source
 */
export async function updateSearchHistoryResultCount(
  timestamp: number,
  count: number,
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(IDB_STORE.SEARCH_HISTORY, "readwrite");
    const store = tx.objectStore(IDB_STORE.SEARCH_HISTORY);
    const entry = await store.get(timestamp);
    if (entry) {
      entry.resultCount = count;
      await store.put(entry);
    }
    await tx.done;
  } catch (error) {
    logger.error("Failed to update search history result count in IndexedDB", { error });
  }
}

/**
 * Removes every search-history entry.
 * @category Utils
 * @returns Resolves once the store is empty.
 * @example
 * ```ts
 * await clearSearchHistory();
 * ```
 * @source
 */
export async function clearSearchHistory(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(IDB_STORE.SEARCH_HISTORY);
  } catch (error) {
    logger.error("Failed to clear search history from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                        Supplier Query Cache                                */
/* -------------------------------------------------------------------------- */

/**
 * Reads one supplier query-cache entry — a cached result set keyed by
 * query+supplier — along with its cache metadata.
 * @category Utils
 * @param cacheKey - The composite query+supplier cache key.
 * @returns The cached entry, or `undefined` on a miss or read failure.
 * @example
 * ```ts
 * const hit = await getSupplierQueryCacheEntry("acetone|Loudwolf");
 * hit?.__cacheMetadata.cachedAt; // => 1712345678901
 * ```
 * @source
 */
export async function getSupplierQueryCacheEntry(
  cacheKey: string,
): Promise<CachedData<unknown> | undefined> {
  try {
    const db = await getDB();
    const record = await db.get(IDB_STORE.SUPPLIER_QUERY_CACHE, cacheKey);
    if (!record) return undefined;
    return {
      data: record.data,
      __cacheMetadata: record.__cacheMetadata,
    };
  } catch (error) {
    logger.error("Failed to get supplier query cache entry from IndexedDB", { error });
    return undefined;
  }
}

/**
 * Writes a supplier query-cache entry, evicting the least recently cached row
 * first when the store is at `maxSupplierCacheEntries` capacity.
 * @category Utils
 * @param cacheKey - The composite query+supplier cache key.
 * @param entry - The result set plus its `__cacheMetadata`.
 * @returns Resolves once the write (and any eviction) completes.
 * @example
 * ```ts
 * await putSupplierQueryCacheEntry("acetone|Loudwolf", { data: [], __cacheMetadata: meta });
 * ```
 * @source
 */
export async function putSupplierQueryCacheEntry(
  cacheKey: string,
  entry: CachedData<unknown>,
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(IDB_STORE.SUPPLIER_QUERY_CACHE, "readwrite");
    const store = tx.objectStore(IDB_STORE.SUPPLIER_QUERY_CACHE);

    // Evict oldest if at capacity
    const count = await store.count();
    if (count >= MAX_SUPPLIER_CACHE_ENTRIES) {
      const index = store.index("cachedAt");
      const cursor = await index.openCursor();
      if (cursor) {
        logger.debug("Evicting oldest supplier query cache entry", {
          key: cursor.value.cacheKey,
          age:
            Math.round((Date.now() - cursor.value.__cacheMetadata.cachedAt) / (60 * 60 * 1000)) +
            " hours",
        });
        await cursor.delete();
      }
    }

    await store.put({
      cacheKey,
      data: entry.data,
      __cacheMetadata: entry.__cacheMetadata,
    });

    await tx.done;
  } catch (error) {
    logger.error("Failed to put supplier query cache entry in IndexedDB", { error });
  }
}

/**
 * Removes a single supplier query-cache entry, e.g. when it fails TTL validation.
 * @category Utils
 * @param cacheKey - The composite query+supplier cache key to delete.
 * @returns Resolves once the row is gone.
 * @example
 * ```ts
 * await deleteSupplierQueryCacheEntry("acetone|Loudwolf");
 * ```
 * @source
 */
export async function deleteSupplierQueryCacheEntry(cacheKey: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(IDB_STORE.SUPPLIER_QUERY_CACHE, cacheKey);
  } catch (error) {
    logger.error("Failed to delete supplier query cache entry from IndexedDB", { error });
  }
}

/**
 * Read every entry in the supplier **query** cache — the cached search-result
 * sets keyed by query+supplier. Intended for manual inspection from the debug
 * console; each record carries its `cacheKey`, the dumped `data`, and its
 * `__cacheMetadata` (query, supplier, `cachedAt`, etc.). Returns `[]` on failure.
 * @category Utils
 * @returns All stored query-cache records, or `[]` when the read fails.
 * @example
 * ```ts
 * const entries = await getAllSupplierQueryCacheEntries();
 * entries[0].__cacheMetadata.query; // => "sodium chloride"
 * ```
 * @source
 */
export async function getAllSupplierQueryCacheEntries(): Promise<
  Array<{
    cacheKey: string;
    data: unknown[];
    __cacheMetadata: {
      cachedAt: number;
      version: number;
      query: string;
      supplier: string;
      supplierModule: string;
      resultCount: number;
      limit: number;
    };
  }>
> {
  try {
    const db = await getDB();
    return await db.getAll(IDB_STORE.SUPPLIER_QUERY_CACHE);
  } catch (error) {
    logger.error("Failed to get all supplier query cache entries from IndexedDB", { error });
    return [];
  }
}

/**
 * Empties the supplier query cache, forcing the next search to refetch.
 * @category Utils
 * @returns Resolves once the store is empty.
 * @example
 * ```ts
 * await clearSupplierQueryCache();
 * ```
 * @source
 */
export async function clearSupplierQueryCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(IDB_STORE.SUPPLIER_QUERY_CACHE);
  } catch (error) {
    logger.error("Failed to clear supplier query cache from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                     Supplier Product Data Cache                            */
/* -------------------------------------------------------------------------- */

/**
 * Reads one entry from the supplier **product data** cache, which holds
 * per-product detail fetched lazily after a search.
 * @category Utils
 * @param cacheKey - The product-level cache key.
 * @returns The cached product data and its timestamp, or `undefined` on a miss.
 * @example
 * ```ts
 * const entry = await getSupplierProductDataCacheEntry("Loudwolf|SKU-1");
 * entry?.timestamp; // => 1712345678901
 * ```
 * @source
 */
export async function getSupplierProductDataCacheEntry(
  cacheKey: string,
): Promise<CachedProductEntry | undefined> {
  try {
    const db = await getDB();
    const record = await db.get(IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE, cacheKey);
    if (!record) return undefined;
    return {
      data: record.data,
      timestamp: record.timestamp,
    };
  } catch (error) {
    logger.error("Failed to get supplier product data cache entry from IndexedDB", { error });
    return undefined;
  }
}

/**
 * Writes a supplier product-data cache entry, evicting the oldest row first
 * when the store is at `maxSupplierCacheEntries` capacity.
 * @category Utils
 * @param cacheKey - The product-level cache key.
 * @param entry - The product data and the timestamp it was fetched.
 * @returns Resolves once the write (and any eviction) completes.
 * @example
 * ```ts
 * await putSupplierProductDataCacheEntry("Loudwolf|SKU-1", { data, timestamp: Date.now() });
 * ```
 * @source
 */
export async function putSupplierProductDataCacheEntry(
  cacheKey: string,
  entry: CachedProductEntry,
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE, "readwrite");
    const store = tx.objectStore(IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE);

    // Evict oldest if at capacity
    const count = await store.count();
    if (count >= MAX_SUPPLIER_CACHE_ENTRIES) {
      const index = store.index("timestamp");
      const cursor = await index.openCursor();
      if (cursor) {
        await cursor.delete();
      }
    }

    await store.put({
      cacheKey,
      data: entry.data,
      timestamp: entry.timestamp,
    });

    await tx.done;
  } catch (error) {
    logger.error("Failed to put supplier product data cache entry in IndexedDB", { error });
  }
}

/**
 * Deletes a single product-detail cache entry by its identity key. Used to evict
 * one product from the cache (e.g. the "Remove Product from Cache" context-menu
 * action) so its detail data is re-fetched fresh the next time it is surfaced,
 * without touching the visible results.
 * @category Utils
 * @param cacheKey - The product-detail cache key, from `getProductIdentityKey`.
 * @example
 * ```ts
 * await deleteSupplierProductDataCacheEntry(getProductIdentityKey(product.cacheKey, product.supplier));
 * ```
 * @source
 */
export async function deleteSupplierProductDataCacheEntry(cacheKey: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE, cacheKey);
  } catch (error) {
    logger.error("Failed to delete supplier product data cache entry from IndexedDB", { error });
  }
}

/**
 * Read every entry in the supplier **product-detail** cache — the enriched
 * per-product data keyed by product identity. Intended for manual inspection
 * from the debug console; each record carries its `cacheKey`, the cached `data`,
 * and its last-access `timestamp`. Returns `[]` on failure.
 * @category Utils
 * @returns All stored product-detail records, or `[]` when the read fails.
 * @example
 * ```ts
 * const entries = await getAllSupplierProductDataCacheEntries();
 * entries.length; // => number of cached product-detail rows
 * ```
 * @source
 */
export async function getAllSupplierProductDataCacheEntries(): Promise<
  Array<{ cacheKey: string; data: Record<string, unknown>; timestamp: number }>
> {
  try {
    const db = await getDB();
    return await db.getAll(IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE);
  } catch (error) {
    logger.error("Failed to get all supplier product data cache entries from IndexedDB", { error });
    return [];
  }
}

/**
 * Empties the supplier product-data cache.
 * @category Utils
 * @returns Resolves once the store is empty.
 * @example
 * ```ts
 * await clearSupplierProductDataCache();
 * ```
 * @source
 */
export async function clearSupplierProductDataCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE);
  } catch (error) {
    logger.error("Failed to clear supplier product data cache from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                          Supplier Stats                                    */
/* -------------------------------------------------------------------------- */

/**
 * Reads the per-supplier stats recorded for one day.
 * @category Utils
 * @param dateKey - The day to read, as `YYYY-MM-DD`.
 * @returns That day's stats keyed by supplier, or `undefined` when none exist.
 * @example
 * ```ts
 * const day = await getSupplierStatsEntry("2026-07-18");
 * day?.Loudwolf.queries; // => 3
 * ```
 * @source
 */
export async function getSupplierStatsEntry(
  dateKey: string,
): Promise<Record<string, SupplierDayStats> | undefined> {
  try {
    const db = await getDB();
    const record = await db.get(IDB_STORE.SUPPLIER_STATS, dateKey);
    return record?.suppliers;
  } catch (error) {
    logger.error("Failed to get supplier stats entry from IndexedDB", { error });
    return undefined;
  }
}

/**
 * Writes one day's per-supplier stats and notifies open surfaces by dispatching
 * {@link IDB_SUPPLIER_STATS_UPDATED}, so the stats panel re-reads without polling.
 * @category Utils
 * @param dateKey - The day being written, as `YYYY-MM-DD`.
 * @param suppliers - That day's stats keyed by supplier name.
 * @returns Resolves once the write completes.
 * @example
 * ```ts
 * await putSupplierStatsEntry("2026-07-18", { Loudwolf: { queries: 3, results: 41 } });
 * ```
 * @source
 */
export async function putSupplierStatsEntry(
  dateKey: string,
  suppliers: Record<string, SupplierDayStats>,
): Promise<void> {
  try {
    const db = await getDB();
    await db.put(IDB_STORE.SUPPLIER_STATS, { dateKey, suppliers });
    emitSupplierStatsUpdated();
  } catch (error) {
    logger.error("Failed to put supplier stats entry in IndexedDB", { error });
  }
}

/**
 * Reads every day of supplier stats, flattened into a `dateKey -> suppliers` map.
 * @category Utils
 * @returns All recorded stats, or `{}` when none exist or the read fails.
 * @example
 * ```ts
 * const stats = await getAllSupplierStats();
 * stats["2026-07-18"].Loudwolf.queries; // => 3
 * ```
 * @source
 */
export async function getAllSupplierStats(): Promise<SupplierStatsData> {
  try {
    const db = await getDB();
    const all = await db.getAll(IDB_STORE.SUPPLIER_STATS);
    const result: SupplierStatsData = {};
    for (const record of all) {
      result[record.dateKey] = record.suppliers;
    }
    return result;
  } catch (error) {
    logger.error("Failed to get all supplier stats from IndexedDB", { error });
    return {};
  }
}

/**
 * Deletes specific days of supplier stats in one transaction, used to prune
 * days that have aged out of the retention window.
 * @category Utils
 * @param dateKeys - The days to delete, as `YYYY-MM-DD` strings.
 * @returns Resolves once every row is deleted.
 * @example
 * ```ts
 * await deleteSupplierStatsEntries(["2026-06-01", "2026-06-02"]);
 * ```
 * @source
 */
export async function deleteSupplierStatsEntries(dateKeys: string[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(IDB_STORE.SUPPLIER_STATS, "readwrite");
    for (const dateKey of dateKeys) {
      tx.store.delete(dateKey);
    }
    await tx.done;
  } catch (error) {
    logger.error("Failed to delete supplier stats entries from IndexedDB", { error });
  }
}

/**
 * Removes all recorded supplier stats.
 * @category Utils
 * @returns Resolves once the store is empty.
 * @example
 * ```ts
 * await clearSupplierStats();
 * ```
 * @source
 */
export async function clearSupplierStats(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(IDB_STORE.SUPPLIER_STATS);
  } catch (error) {
    logger.error("Failed to clear supplier stats from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                          Excluded Products                                 */
/* -------------------------------------------------------------------------- */

/**
 * Load the user's excluded-products map from the `excludedProducts` object
 * store. The whole map lives under a single row keyed by `"current"` (same
 * single-row pattern used by `searchResults`), so this is a single read.
 * Returns `{}` when the store is empty or the read fails, letting callers
 * treat the result as always-valid without null-checking.
 * @category Utils
 * @returns Map of md5 exclusion key → entry, or `{}` when absent.
 * @example
 * ```ts
 * const excluded = await getExcludedProducts();
 * // => { "a1b2c3…": { url: "https://…", supplier: "Loudwolf",
 * //                   title: "Acetone 500ml", excludedAt: 1713301200000 } }
 * if (excluded[key]) {
 *   // product is on the ignore list
 * }
 * ```
 * @source
 */
export async function getExcludedProducts(): Promise<ExcludedProductsMap> {
  try {
    const db = await getDB();
    const record = await db.get(IDB_STORE.EXCLUDED_PRODUCTS, "current");
    return record?.map ?? {};
  } catch (error) {
    logger.error("Failed to get excluded products from IndexedDB", { error });
    return {};
  }
}

/**
 * Write the full excluded-products map back into IndexedDB, overwriting the
 * previous value. Callers typically read via `getExcludedProducts`, mutate
 * the returned object, and pass it back here — the object store holds one
 * row keyed by `"current"` so each call is a complete replacement.
 * @category Utils
 * @param map - The map to persist. Pass `{}` to effectively clear.
 * @returns Resolves once the write completes; errors are logged, not thrown.
 * @example
 * ```ts
 * const map = await getExcludedProducts();
 * map["a1b2c3…"] = { url, supplier: "Loudwolf", title, excludedAt: Date.now() };
 * await putExcludedProducts(map);
 * ```
 * @source
 */
export async function putExcludedProducts(map: ExcludedProductsMap): Promise<void> {
  try {
    const db = await getDB();
    await db.put(IDB_STORE.EXCLUDED_PRODUCTS, { id: "current", map });
  } catch (error) {
    logger.error("Failed to put excluded products in IndexedDB", { error });
  }
}

/**
 * Remove the excluded-products row from IndexedDB entirely. After this, a
 * subsequent `getExcludedProducts()` returns `{}`. Used by the bulk
 * `clearAllCaches` flow; callers don't typically invoke this directly.
 * @category Utils
 * @returns Resolves once the delete completes; errors are logged, not thrown.
 * @example
 * ```ts
 * await clearExcludedProducts();
 * const excluded = await getExcludedProducts(); // => {}
 * ```
 * @source
 */
export async function clearExcludedProducts(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(IDB_STORE.EXCLUDED_PRODUCTS, "current");
  } catch (error) {
    logger.error("Failed to clear excluded products from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                              Price History                                 */
/* -------------------------------------------------------------------------- */

/**
 * Read a single price-history series by its id. The id is the product's
 * identity key for the base row, or `${productKey}::${variantKey}` for a
 * variant row. Returns `undefined` when no series exists yet (the first time a
 * product/variant is seen) or when the read fails.
 * @category Utils
 * @param id - The series id.
 * @returns The stored {@link PriceHistoryEntry}, or `undefined` when absent.
 * @example
 * ```ts
 * const series = await getPriceSeries("3f9c2a…");
 * const last = series?.points.at(-1)?.usd; // most recent USD price
 * ```
 * @source
 */
export async function getPriceSeries(id: string): Promise<PriceHistoryEntry | undefined> {
  try {
    const db = await getDB();
    return await db.get(IDB_STORE.PRICE_HISTORY, id);
  } catch (error) {
    logger.error("Failed to get price series from IndexedDB", { error });
    return undefined;
  }
}

/**
 * Write a price-history series, overwriting any existing row with the same id.
 * Callers read via {@link getPriceSeries}, append a point, then pass the whole
 * entry back — the store holds one row per series (keyed by `id`) so each call
 * is a complete replacement.
 * @category Utils
 * @param entry - The series to persist.
 * @returns Resolves once the write completes; errors are logged, not thrown.
 * @example
 * ```ts
 * await putPriceSeries({
 *   id: "3f9c2a…", productKey: "3f9c2a…", supplier: "Loudwolf",
 *   title: "Acetone 500ml", points: [{ t: Date.now(), usd: 19.99 }],
 *   updatedAt: Date.now(),
 * });
 * ```
 * @source
 */
export async function putPriceSeries(entry: PriceHistoryEntry): Promise<void> {
  try {
    const db = await getDB();
    await db.put(IDB_STORE.PRICE_HISTORY, entry);
  } catch (error) {
    logger.error("Failed to put price series in IndexedDB", { error });
  }
}

/**
 * Read every price-history series belonging to a product — its base row plus
 * one row per tracked variant — via the `productKey` index. Used by the detail
 * panel to render a product's full price history in one query. Returns `[]`
 * when the product has no recorded history or the read fails.
 * @category Utils
 * @param productKey - The product's identity key (shared by base and variants).
 * @returns All matching series (order unspecified), or `[]` when none.
 * @example
 * ```ts
 * const series = await getPriceSeriesByProduct("3f9c2a…");
 * // => [ base series, variant series, … ]
 * ```
 * @source
 */
export async function getPriceSeriesByProduct(productKey: string): Promise<PriceHistoryEntry[]> {
  try {
    const db = await getDB();
    return await db.getAllFromIndex(IDB_STORE.PRICE_HISTORY, "productKey", productKey);
  } catch (error) {
    logger.error("Failed to get price series by product from IndexedDB", { error });
    return [];
  }
}

/**
 * Read every stored price-history series (all base rows and variant rows across
 * every product). The app reads per-product via {@link getPriceSeriesByProduct};
 * this full-store read backs dev/debug tooling that needs the whole set.
 * @category Utils
 * @returns All price-history series, or `[]` when none / on error.
 * @example
 * ```ts
 * const all = await getAllPriceSeries();
 * all.length; // total number of tracked series
 * ```
 * @source
 */
export async function getAllPriceSeries(): Promise<PriceHistoryEntry[]> {
  try {
    const db = await getDB();
    return await db.getAll(IDB_STORE.PRICE_HISTORY);
  } catch (error) {
    logger.error("Failed to get all price series from IndexedDB", { error });
    return [];
  }
}

/**
 * Delete all price-history series. Exposed via the "Clear price history" button
 * in the settings panel. Deliberately kept out of {@link clearAllCaches} so a
 * routine cache clear never destroys the user's accumulated price history.
 * @category Utils
 * @returns Resolves once the store is cleared; errors are logged, not thrown.
 * @example
 * ```ts
 * await clearPriceHistory();
 * const series = await getPriceSeriesByProduct("3f9c2a…"); // => []
 * ```
 * @source
 */
export async function clearPriceHistory(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(IDB_STORE.PRICE_HISTORY);
  } catch (error) {
    logger.error("Failed to clear price history from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                                App Meta                                    */
/* -------------------------------------------------------------------------- */

/**
 * Read the app version that last wrote or migrated the cache, from the single
 * `app_meta` row keyed `"current"`. Returns `undefined` on a fresh install (the
 * row has never been written) or when the read fails — callers treat `undefined`
 * as "no marker yet" and seed the current version instead of migrating.
 * @category Utils
 * @returns The stored semver string (e.g. `"1.0.0"`), or `undefined` when unset.
 * @example
 * ```ts
 * const from = await getStoredAppVersion(); // => "1.0.0" | undefined
 * ```
 * @source
 */
export async function getStoredAppVersion(): Promise<string | undefined> {
  try {
    const db = await getDB();
    const record = await db.get(IDB_STORE.APP_META, APP_META_KEY);
    return record?.appVersion;
  } catch (error) {
    logger.error("Failed to get stored app version from IndexedDB", { error });
    return undefined;
  }
}

/**
 * Record the app version that now owns the cache, overwriting the single
 * `app_meta` row. Called after migrations complete, after a fresh-install seed,
 * and after a Cancel/reset, so the stored marker always reflects the version
 * whose data shape is currently in IndexedDB.
 * @category Utils
 * @param appVersion - The semver string to persist (typically `__APP_VERSION__`).
 * @returns Resolves once the write completes; errors are logged, not thrown.
 * @example
 * ```ts
 * await setStoredAppVersion("1.1.0");
 * await getStoredAppVersion(); // => "1.1.0"
 * ```
 * @source
 */
export async function setStoredAppVersion(appVersion: string): Promise<void> {
  try {
    const db = await getDB();
    await db.put(IDB_STORE.APP_META, {
      id: APP_META_KEY,
      appVersion,
      updatedAt: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to set stored app version in IndexedDB", { error });
  }
}

/**
 * Open the ChemPal database as an **untyped** `idb` handle for migration steps.
 * Unlike `getDB`, this returns `IDBPDatabase` without the schema generic, so
 * step code can read and write records in stores whose current-schema shape no
 * longer matches the data on disk (renamed stores, old record shapes) using plain
 * `string` store names — no type assertions required. The structural schema is
 * still owned by `getDB`'s `upgrade`; this connection never upgrades.
 * @category Utils
 * @returns A fresh untyped connection to the same `chempal` database.
 * @example
 * ```ts
 * const db = await getMigrationDb();
 * const rows = await db.getAll("supplier_query_cache");
 * ```
 * @source
 */
export async function getMigrationDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION);
}

/* -------------------------------------------------------------------------- */
/*                              Storage stats                                 */
/* -------------------------------------------------------------------------- */

/**
 * Per-store record count + serialized JSON size, plus the summed total.
 * @category Utils
 */
export interface IdbStorageBreakdown {
  byStore: Record<IdbStore, { count: number; bytes: number }>;
  totalBytes: number;
}

/**
 * Measure every IndexedDB object store: the number of records it holds and the
 * byte size of its contents when serialized to JSON. Used by the settings panel
 * to show cache/price-history sizes; the summed `totalBytes` can be paired with
 * `navigator.storage.estimate()` to scale each store's JSON size up to its true
 * on-disk footprint (indexes, keys, structured-clone overhead). Returns all-zero
 * counts on failure.
 * @category Utils
 * @returns A per-store breakdown of record counts and JSON byte sizes, plus the total.
 * @example
 * ```ts
 * const { byStore, totalBytes } = await getIdbStorageBreakdown();
 * byStore["price_history"].count; // => number of price series
 * totalBytes;                     // => summed JSON bytes across all stores
 * ```
 * @source
 */
export async function getIdbStorageBreakdown(): Promise<IdbStorageBreakdown> {
  const byStore: Record<IdbStore, { count: number; bytes: number }> = {
    [IDB_STORE.SEARCH_RESULTS]: { count: 0, bytes: 0 },
    [IDB_STORE.SEARCH_HISTORY]: { count: 0, bytes: 0 },
    [IDB_STORE.SUPPLIER_QUERY_CACHE]: { count: 0, bytes: 0 },
    [IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE]: { count: 0, bytes: 0 },
    [IDB_STORE.SUPPLIER_STATS]: { count: 0, bytes: 0 },
    [IDB_STORE.EXCLUDED_PRODUCTS]: { count: 0, bytes: 0 },
    [IDB_STORE.PRICE_HISTORY]: { count: 0, bytes: 0 },
    [IDB_STORE.APP_META]: { count: 0, bytes: 0 },
  };
  try {
    const db = await getDB();
    for (const store of Object.values(IDB_STORE)) {
      const entries = await db.getAll(store);
      byStore[store] = {
        count: entries.length,
        bytes: new Blob([JSON.stringify(entries)]).size,
      };
    }
  } catch (error) {
    logger.error("Failed to compute IndexedDB storage breakdown", { error });
  }
  const totalBytes = Object.values(byStore).reduce((sum, entry) => sum + entry.bytes, 0);
  return { byStore, totalBytes };
}

/* -------------------------------------------------------------------------- */
/*                                 Bulk                                       */
/* -------------------------------------------------------------------------- */

/**
 * Clears every cache-bearing store in one transaction: search results, history,
 * both supplier caches, stats, and excluded products. Backs the "clear cache"
 * action in settings.
 * @category Utils
 * @returns Resolves once all stores are empty.
 * @example
 * ```ts
 * await clearAllCaches();
 * ```
 * @source
 */
export async function clearAllCaches(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(
      [
        IDB_STORE.SEARCH_RESULTS,
        IDB_STORE.SEARCH_HISTORY,
        IDB_STORE.SUPPLIER_QUERY_CACHE,
        IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE,
        IDB_STORE.SUPPLIER_STATS,
        IDB_STORE.EXCLUDED_PRODUCTS,
      ],
      "readwrite",
    );
    await Promise.all([
      tx.objectStore(IDB_STORE.SEARCH_RESULTS).clear(),
      tx.objectStore(IDB_STORE.SEARCH_HISTORY).clear(),
      tx.objectStore(IDB_STORE.SUPPLIER_QUERY_CACHE).clear(),
      tx.objectStore(IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE).clear(),
      tx.objectStore(IDB_STORE.SUPPLIER_STATS).clear(),
      tx.objectStore(IDB_STORE.EXCLUDED_PRODUCTS).clear(),
      tx.done,
    ]);
    emitSearchResultsCleared();
  } catch (error) {
    logger.error("Failed to clear all IndexedDB caches", { error });
  }
}
