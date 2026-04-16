import type { CachedData } from "@/suppliers/SupplierBase";
import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import Logger from "@/utils/Logger";

/**
 * Custom event name dispatched when search results are cleared.
 * Consumers listen for this via `window.addEventListener` to replace
 * the former `cstorage.onChanged` pattern for `search_results`.
 */
export const IDB_SEARCH_RESULTS_CLEARED = "idb:search-results-cleared";

/**
 * Custom event name dispatched when supplier stats are updated.
 * Consumers listen for this to live-refresh stats during searches.
 */
export const IDB_SUPPLIER_STATS_UPDATED = "idb:supplier-stats-updated";

const logger = new Logger("idbCache");

const DB_NAME = "chempal";
const DB_VERSION = 2;
const MAX_SUPPLIER_CACHE_ENTRIES = 100;
const MAX_HISTORY_ENTRIES = 100;

interface ChemPalDBSchema extends DBSchema {
  searchResults: {
    key: string;
    value: {
      id: string;
      data: Product[];
    };
  };
  searchHistory: {
    key: number;
    value: SearchHistoryEntry;
  };
  supplierQueryCache: {
    key: string;
    value: {
      cacheKey: string;
      data: unknown[];
      // eslint-disable-next-line @typescript-eslint/naming-convention
      __cacheMetadata: {
        cachedAt: number;
        version: number;
        query: string;
        supplier: string;
        resultCount: number;
        limit: number;
      };
    };
    indexes: {
      cachedAt: number;
    };
  };
  supplierProductDataCache: {
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
  supplierStats: {
    key: string;
    value: {
      dateKey: string;
      suppliers: Record<string, SupplierDayStats>;
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
        if (!db.objectStoreNames.contains("searchResults")) {
          db.createObjectStore("searchResults", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("searchHistory")) {
          db.createObjectStore("searchHistory", { keyPath: "timestamp" });
        }

        if (!db.objectStoreNames.contains("supplierQueryCache")) {
          const sqc = db.createObjectStore("supplierQueryCache", { keyPath: "cacheKey" });
          sqc.createIndex("cachedAt", "__cacheMetadata.cachedAt");
        }

        if (!db.objectStoreNames.contains("supplierProductDataCache")) {
          const spdc = db.createObjectStore("supplierProductDataCache", { keyPath: "cacheKey" });
          spdc.createIndex("timestamp", "timestamp");
        }

        if (!db.objectStoreNames.contains("supplierStats")) {
          db.createObjectStore("supplierStats", { keyPath: "dateKey" });
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

export async function getSearchResults(): Promise<Product[]> {
  try {
    const db = await getDB();
    const record = await db.get("searchResults", "current");
    return record?.data ?? [];
  } catch (error) {
    logger.error("Failed to get search results from IndexedDB", { error });
    return [];
  }
}

export async function setSearchResults(results: Product[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put("searchResults", { id: "current", data: results });
    if (results.length === 0) {
      emitSearchResultsCleared();
    }
  } catch (error) {
    logger.error("Failed to set search results in IndexedDB", { error });
  }
}

export async function clearSearchResults(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("searchResults", "current");
    emitSearchResultsCleared();
  } catch (error) {
    logger.error("Failed to clear search results from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                            Search History                                  */
/* -------------------------------------------------------------------------- */

export async function getSearchHistory(): Promise<SearchHistoryEntry[]> {
  try {
    const db = await getDB();
    const all = await db.getAll("searchHistory");
    // Return sorted newest-first
    return all.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    logger.error("Failed to get search history from IndexedDB", { error });
    return [];
  }
}

export async function addSearchHistoryEntry(entry: SearchHistoryEntry): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction("searchHistory", "readwrite");
    const store = tx.objectStore("searchHistory");

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

export async function updateSearchHistoryResultCount(
  timestamp: number,
  count: number,
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction("searchHistory", "readwrite");
    const store = tx.objectStore("searchHistory");
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

export async function clearSearchHistory(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear("searchHistory");
  } catch (error) {
    logger.error("Failed to clear search history from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                        Supplier Query Cache                                */
/* -------------------------------------------------------------------------- */

export async function getSupplierQueryCacheEntry(
  cacheKey: string,
): Promise<CachedData<unknown> | undefined> {
  try {
    const db = await getDB();
    const record = await db.get("supplierQueryCache", cacheKey);
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

export async function putSupplierQueryCacheEntry(
  cacheKey: string,
  entry: CachedData<unknown>,
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction("supplierQueryCache", "readwrite");
    const store = tx.objectStore("supplierQueryCache");

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

export async function deleteSupplierQueryCacheEntry(cacheKey: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("supplierQueryCache", cacheKey);
  } catch (error) {
    logger.error("Failed to delete supplier query cache entry from IndexedDB", { error });
  }
}

export async function clearSupplierQueryCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear("supplierQueryCache");
  } catch (error) {
    logger.error("Failed to clear supplier query cache from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                     Supplier Product Data Cache                            */
/* -------------------------------------------------------------------------- */

export async function getSupplierProductDataCacheEntry(
  cacheKey: string,
): Promise<CachedProductEntry | undefined> {
  try {
    const db = await getDB();
    const record = await db.get("supplierProductDataCache", cacheKey);
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

export async function putSupplierProductDataCacheEntry(
  cacheKey: string,
  entry: CachedProductEntry,
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction("supplierProductDataCache", "readwrite");
    const store = tx.objectStore("supplierProductDataCache");

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

export async function clearSupplierProductDataCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear("supplierProductDataCache");
  } catch (error) {
    logger.error("Failed to clear supplier product data cache from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                          Supplier Stats                                    */
/* -------------------------------------------------------------------------- */

export async function getSupplierStatsEntry(
  dateKey: string,
): Promise<Record<string, SupplierDayStats> | undefined> {
  try {
    const db = await getDB();
    const record = await db.get("supplierStats", dateKey);
    return record?.suppliers;
  } catch (error) {
    logger.error("Failed to get supplier stats entry from IndexedDB", { error });
    return undefined;
  }
}

export async function putSupplierStatsEntry(
  dateKey: string,
  suppliers: Record<string, SupplierDayStats>,
): Promise<void> {
  try {
    const db = await getDB();
    await db.put("supplierStats", { dateKey, suppliers });
    emitSupplierStatsUpdated();
  } catch (error) {
    logger.error("Failed to put supplier stats entry in IndexedDB", { error });
  }
}

export async function getAllSupplierStats(): Promise<SupplierStatsData> {
  try {
    const db = await getDB();
    const all = await db.getAll("supplierStats");
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

export async function deleteSupplierStatsEntries(dateKeys: string[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction("supplierStats", "readwrite");
    for (const dateKey of dateKeys) {
      tx.store.delete(dateKey);
    }
    await tx.done;
  } catch (error) {
    logger.error("Failed to delete supplier stats entries from IndexedDB", { error });
  }
}

export async function clearSupplierStats(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear("supplierStats");
  } catch (error) {
    logger.error("Failed to clear supplier stats from IndexedDB", { error });
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Bulk                                       */
/* -------------------------------------------------------------------------- */

export async function clearAllCaches(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(
      [
        "searchResults",
        "searchHistory",
        "supplierQueryCache",
        "supplierProductDataCache",
        "supplierStats",
      ],
      "readwrite",
    );
    await Promise.all([
      tx.objectStore("searchResults").clear(),
      tx.objectStore("searchHistory").clear(),
      tx.objectStore("supplierQueryCache").clear(),
      tx.objectStore("supplierProductDataCache").clear(),
      tx.objectStore("supplierStats").clear(),
      tx.done,
    ]);
    emitSearchResultsCleared();
  } catch (error) {
    logger.error("Failed to clear all IndexedDB caches", { error });
  }
}
