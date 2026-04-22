import type { CachedData } from "@/suppliers/SupplierBase";
import Logger from "@/utils/Logger";
import {
  clearSupplierProductDataCache,
  clearSupplierQueryCache,
  getSupplierProductDataCacheEntry,
  getSupplierQueryCacheEntry,
  putSupplierProductDataCacheEntry,
  putSupplierQueryCacheEntry,
} from "@/utils/idbCache";
import { md5 } from "js-md5";

/**
 * Utility class for managing supplier data caching in IndexedDB.
 * Provides a robust caching system for both query results and product detail data.
 *
 * @remarks
 * The cache system uses two IndexedDB object stores:
 * 1. `supplierQueryCache` - Stores search query results (one record per query+supplier)
 * 2. `supplierProductDataCache` - Stores detailed product data (one record per product)
 *
 * Each store supports max 100 entries with LRU eviction handled by idbCache.
 * @category Utils
 * @typeParam T - The type of data being cached
 * @source
 */
export default class SupplierCache {
  //The version of the cache format.
  private static readonly CACHE_VERSION = 1;

  // The logger instance.
  private logger: Logger;

  // Name of the supplier this cache is bound to. Mixed into query keys and
  // product-data keys so two suppliers that happen to share a URL or query
  // string don't collide.
  private supplierName: string;

  // When false, all reads return undefined and all writes no-op. Lets callers
  // honor userSettings.caching without every cache-call site needing its own
  // guard.
  private enabled: boolean;

  constructor(supplierName: string, enabled: boolean = true) {
    this.logger = new Logger(supplierName);
    this.supplierName = supplierName;
    this.enabled = enabled;
    this.logger.debug("SupplierCache initialized", { supplierName, enabled });
  }

  /**
   * Generates a cache key based on the query and the bound supplier name.
   * The limit is intentionally excluded as it only affects how many results are returned,
   * not the actual search results themselves.
   * @source
   */
  generateCacheKey(query: string): string {
    const data = `${query || ""}:${this.supplierName}`;
    this.logger.debug("Generating cache key with:", {
      query,
      supplierName: this.supplierName,
      data,
    });
    try {
      // Try browser's btoa first
      const key = btoa(data);
      this.logger.debug("Generated cache key:", key);
      return key;
    } catch {
      try {
        // Fallback to Node's Buffer if available
        if (typeof Buffer !== "undefined") {
          const key = Buffer.from(data).toString("base64");
          this.logger.debug("Generated cache key (Buffer):", { key });
          return key;
        }
        // If neither is available, use a simple hash function
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
          const char = data.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        const key = hash.toString(36);
        this.logger.debug("Generated cache key (hash):", { key });
        return key;
      } catch (error) {
        this.logger.error("Error generating cache key:", error);
        // Fallback to a simple string if all else fails
        const key = data.replace(/[^a-zA-Z0-9]/g, "_");
        this.logger.debug("Generated cache key (fallback):", { key });
        return key;
      }
    }
  }

  /**
   * Generates a cache key for product detail data based on the HTTP request URL,
   * params, and the bound supplier name.
   * This ensures that identical detail requests (even from different queries) share the same cache entry.
   * @source
   */
  getProductDataCacheKey(url: string, params?: QueryParams): string {
    const data = {
      url, // Must match the actual HTTP request URL
      params: params || {}, // Must match the actual HTTP request params
      supplier: this.supplierName, // Multi-supplier safety
    };
    return md5(JSON.stringify(data));
  }

  /**
   * Stores query results in the cache.
   * LRU eviction (max 100 entries) is handled by idbCache.
   * @source
   */
  async cacheQueryResults(query: string, results: unknown[], limit: number): Promise<void> {
    if (!this.enabled) return;
    this.logger.debug("[SupplierCache] Caching query results", {
      query,
      supplierName: this.supplierName,
      results,
      limit,
    });

    try {
      const key = this.generateCacheKey(query);

      const entry: CachedData<unknown> = {
        data: results,
        __cacheMetadata: {
          cachedAt: Date.now(),
          version: SupplierCache.CACHE_VERSION,
          query,
          supplier: this.supplierName,
          resultCount: results.length,
          limit,
        },
      };

      this.logger.debug("Cached query results", {
        key,
        metadata: entry.__cacheMetadata,
      });

      await putSupplierQueryCacheEntry(key, entry);
    } catch (error) {
      this.logger.error("Error storing query results in cache:", { error });
    }
  }

  /**
   * Retrieves cached product data for a given key.
   * Updates the timestamp on access to prevent premature eviction.
   * @source
   */
  async getCachedProductData(key: string): Promise<Maybe<Record<string, unknown>>> {
    if (!this.enabled) return undefined;
    this.logger.debug("[SupplierCache] Getting cached product data", { key });
    try {
      const cached = await getSupplierProductDataCacheEntry(key);
      if (cached) {
        // Refresh timestamp on access
        await putSupplierProductDataCacheEntry(key, {
          data: cached.data,
          timestamp: Date.now(),
        });
        return cached.data;
      }
      return undefined;
    } catch (error) {
      this.logger.error("Error retrieving product data from cache:", { error });
      return undefined;
    }
  }

  /**
   * Stores product data in the cache.
   * LRU eviction (max 100 entries) is handled by idbCache.
   * @source
   */
  async cacheProductData(key: string, data: Record<string, unknown>): Promise<void> {
    if (!this.enabled) return;
    this.logger.debug("Caching product data", { key, data });
    try {
      await putSupplierProductDataCacheEntry(key, {
        data,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error("Error storing product data in cache:", { error });
    }
  }

  /**
   * Retrieves a cached query entry by key.
   * @source
   */
  async getCachedQueryEntry(key: string): Promise<CachedData<unknown> | undefined> {
    if (!this.enabled) return undefined;
    this.logger.debug("Getting cached query entry", { key });
    try {
      return await getSupplierQueryCacheEntry(key);
    } catch (error) {
      this.logger.error("Error retrieving query cache entry:", { error });
      return undefined;
    }
  }

  /**
   * Clears both the query cache and product data cache from IndexedDB.
   * @source
   */
  static async clearAll(): Promise<void> {
    await Promise.all([clearSupplierQueryCache(), clearSupplierProductDataCache()]);
  }
}
