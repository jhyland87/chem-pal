import { cstorage } from "@/utils/storage";
import Logger from "@/utils/Logger";
import {
  setSearchResults,
  addSearchHistoryEntry,
  putSupplierQueryCacheEntry,
  putSupplierProductDataCacheEntry,
} from "@/utils/idbCache";
import type { CachedData } from "@/suppliers/SupplierBase";

const logger = new Logger("idbMigration");

const MIGRATION_FLAG = "__idb_migrated";

/**
 * Legacy chrome.storage keys that are being migrated to IndexedDB.
 * These are hardcoded strings (not from the CACHE enum) because the enum
 * entries will be removed as part of this migration.
 */
const LEGACY_KEYS = {
  SEARCH_RESULTS: "search_results",
  SEARCH_HISTORY: "search_history",
  SUPPLIER_QUERY_CACHE: "supplier_query_cache",
  SUPPLIER_PRODUCT_DATA_CACHE: "supplier_product_data_cache",
  QUERY_RESULTS_CACHE: "query_results_cache",
  PRODUCT_DATA_CACHE: "product_data_cache",
} as const;

/**
 * One-time migration from chrome.storage to IndexedDB.
 * Reads existing cached data from chrome.storage.local and chrome.storage.session,
 * writes it into IndexedDB, then removes the old keys. Idempotent — checks a
 * `__idb_migrated` flag in chrome.storage.local and skips if already done.
 *
 * Called once from main.tsx before the React app renders.
 */
export async function migrateFromChromeStorage(): Promise<void> {
  try {
    // Check if migration has already been performed
    const flagCheck = await cstorage.local.get(MIGRATION_FLAG);
    if (flagCheck[MIGRATION_FLAG]) {
      return;
    }

    logger.debug("Starting one-time migration from chrome.storage to IndexedDB");

    // Read all legacy data in parallel
    const [localData, sessionData] = await Promise.all([
      cstorage.local.get([
        LEGACY_KEYS.SEARCH_HISTORY,
        LEGACY_KEYS.SUPPLIER_QUERY_CACHE,
        LEGACY_KEYS.SUPPLIER_PRODUCT_DATA_CACHE,
      ]),
      cstorage.session.get([LEGACY_KEYS.SEARCH_RESULTS]),
    ]);

    // Migrate search results (session → IndexedDB)
    const searchResults = sessionData[LEGACY_KEYS.SEARCH_RESULTS];
    if (Array.isArray(searchResults) && searchResults.length > 0) {
      await setSearchResults(searchResults as Product[]);
      logger.debug("Migrated search_results", { count: searchResults.length });
    }

    // Migrate search history (local → IndexedDB)
    const searchHistory = localData[LEGACY_KEYS.SEARCH_HISTORY];
    if (Array.isArray(searchHistory) && searchHistory.length > 0) {
      for (const entry of searchHistory as SearchHistoryEntry[]) {
        await addSearchHistoryEntry(entry);
      }
      logger.debug("Migrated search_history", { count: searchHistory.length });
    }

    // Migrate supplier query cache (local → IndexedDB)
    const supplierQueryCache = localData[LEGACY_KEYS.SUPPLIER_QUERY_CACHE];
    if (supplierQueryCache && typeof supplierQueryCache === "object") {
      const entries = Object.entries(supplierQueryCache as Record<string, CachedData<unknown>>);
      for (const [key, entry] of entries) {
        await putSupplierQueryCacheEntry(key, entry);
      }
      logger.debug("Migrated supplier_query_cache", { count: entries.length });
    }

    // Migrate supplier product data cache (local → IndexedDB)
    const supplierProductDataCache = localData[LEGACY_KEYS.SUPPLIER_PRODUCT_DATA_CACHE];
    if (supplierProductDataCache && typeof supplierProductDataCache === "object") {
      const entries = Object.entries(
        supplierProductDataCache as Record<string, CachedProductEntry>,
      );
      for (const [key, entry] of entries) {
        await putSupplierProductDataCacheEntry(key, entry);
      }
      logger.debug("Migrated supplier_product_data_cache", { count: entries.length });
    }

    // Remove all legacy keys from chrome.storage
    await Promise.all([
      cstorage.local.remove([
        LEGACY_KEYS.SEARCH_HISTORY,
        LEGACY_KEYS.SUPPLIER_QUERY_CACHE,
        LEGACY_KEYS.SUPPLIER_PRODUCT_DATA_CACHE,
        LEGACY_KEYS.QUERY_RESULTS_CACHE,
        LEGACY_KEYS.PRODUCT_DATA_CACHE,
      ]),
      cstorage.session.remove([LEGACY_KEYS.SEARCH_RESULTS]),
    ]);

    // Set migration flag
    await cstorage.local.set({ [MIGRATION_FLAG]: true });

    logger.debug("Migration from chrome.storage to IndexedDB complete");
  } catch (error) {
    logger.error("Failed to migrate from chrome.storage to IndexedDB", { error });
    // Don't set the flag so migration can be retried next time
  }
}
