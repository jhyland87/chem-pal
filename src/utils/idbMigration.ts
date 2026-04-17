import { cstorage } from "@/utils/storage";
import Logger from "@/utils/Logger";
import {
  setSearchResults,
  addSearchHistoryEntry,
  putSupplierQueryCacheEntry,
  putSupplierProductDataCacheEntry,
  putSupplierStatsEntry,
  putExcludedProducts,
} from "@/utils/idbCache";
import type { CachedData } from "@/suppliers/SupplierBase";
import type { ExcludedProductsMap } from "@/helpers/excludedProducts";

const logger = new Logger("idbMigration");

// Bumped from v1 → v2 when `excluded_products` was added to the migration.
// Users on v1 still have an `excluded_products` entry in chrome.storage that
// needs to move over; the old LEGACY_KEYS entries are already gone for them
// so those steps no-op.
const MIGRATION_FLAG = "__idb_migrated_v2";
const LEGACY_MIGRATION_FLAG = "__idb_migrated";

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
  EXCLUDED_PRODUCTS: "excluded_products",
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
        LEGACY_KEYS.EXCLUDED_PRODUCTS,
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

    // Migrate excluded products (local → IndexedDB)
    const excludedProducts = localData[LEGACY_KEYS.EXCLUDED_PRODUCTS];
    if (excludedProducts && typeof excludedProducts === "object") {
      await putExcludedProducts(excludedProducts as ExcludedProductsMap);
      logger.debug("Migrated excluded_products", {
        count: Object.keys(excludedProducts).length,
      });
    }

    // Migrate supplier stats (dynamic keys: supplier_stats_MMDDYYYY and legacy supplierStats)
    const allLocalData = await cstorage.local.get(null);
    const statsKeysToRemove: string[] = [];

    // Migrate per-day stats keys (supplier_stats_MMDDYYYY)
    const STATS_PREFIX = "supplier_stats_";
    for (const [key, value] of Object.entries(allLocalData)) {
      if (!key.startsWith(STATS_PREFIX)) continue;
      statsKeysToRemove.push(key);
      if (typeof value !== "object" || value === null) continue;

      // Convert MMDDYYYY storage key to YYYY-MM-DD date key
      const suffix = key.replace(STATS_PREFIX, "");
      if (suffix.length !== 8) continue;
      const mm = suffix.slice(0, 2);
      const dd = suffix.slice(2, 4);
      const yyyy = suffix.slice(4, 8);
      const dateKey = `${yyyy}-${mm}-${dd}`;

      await putSupplierStatsEntry(dateKey, value as Record<string, SupplierDayStats>);
    }

    // Migrate legacy single-object supplierStats key
    if (allLocalData.supplierStats && typeof allLocalData.supplierStats === "object") {
      const legacy = allLocalData.supplierStats as SupplierStatsData;
      for (const [dateKey, suppliers] of Object.entries(legacy)) {
        await putSupplierStatsEntry(dateKey, suppliers);
      }
      statsKeysToRemove.push("supplierStats");
    }

    if (statsKeysToRemove.length > 0) {
      logger.debug("Migrated supplier stats", { count: statsKeysToRemove.length });
    }

    // Remove all legacy keys from chrome.storage (including the v1 flag, so
    // it doesn't linger as dead state once the v2 flag is in play).
    await Promise.all([
      cstorage.local.remove([
        LEGACY_KEYS.SEARCH_HISTORY,
        LEGACY_KEYS.SUPPLIER_QUERY_CACHE,
        LEGACY_KEYS.SUPPLIER_PRODUCT_DATA_CACHE,
        LEGACY_KEYS.QUERY_RESULTS_CACHE,
        LEGACY_KEYS.PRODUCT_DATA_CACHE,
        LEGACY_KEYS.EXCLUDED_PRODUCTS,
        LEGACY_MIGRATION_FLAG,
        ...statsKeysToRemove,
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
