import Logger from "@/utils/Logger";
import { md5 } from "js-md5";

/**
 * Metadata about cached results including timestamp and version information.
 * This helps determine if cached data is stale or needs to be refreshed.
 */
interface CacheMetadata {
  /** When the data was cached */
  cachedAt: number;
  /** Version of the cache format - useful for cache invalidation */
  version: number;
  /** Original query that produced these results */
  query: string;
  /** Supplier that provided these results */
  supplier: string;
  /** Number of results in the cache */
  resultCount: number;
  /** Limit used to generate this cache */
  limit: number;
}

/**
 * Type for cached data including the results and metadata
 */
interface CachedData<T> {
  /** The actual cached results */
  data: T[];
  /** Metadata about the cache entry */
  __cacheMetadata: CacheMetadata;
}

/**
 * Utility class for handling supplier caching operations.
 * Provides methods for managing both query results and product detail caches.
 */
export default class SupplierCache {
  private static readonly queryCacheKey = "supplier_query_cache";
  private static readonly productDataCacheKey = "supplier_product_data_cache";
  private static readonly CACHE_VERSION = 1;
  private static readonly cacheSize = 100;
  private static readonly productDataCacheSize = 100;

  private logger: Logger;

  constructor(supplierName: string) {
    this.logger = new Logger(supplierName);
  }

  /**
   * Generates a cache key based on the query and supplier name.
   * The limit is intentionally excluded as it only affects how many results are returned,
   * not the actual search results themselves.
   */
  generateCacheKey(query: string, supplierName: string): string {
    const data = `${query || ""}:${supplierName || ""}`;
    this.logger.debug("Generating cache key with:", {
      query,
      supplierName,
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
          this.logger.debug("Generated cache key (Buffer):", key);
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
        this.logger.debug("Generated cache key (hash):", key);
        return key;
      } catch (error) {
        this.logger.error("Error generating cache key:", error);
        // Fallback to a simple string if all else fails
        const key = data.replace(/[^a-zA-Z0-9]/g, "_");
        this.logger.debug("Generated cache key (fallback):", key);
        return key;
      }
    }
  }

  /**
   * Generates a cache key for product detail data based only on the HTTP request URL and params.
   * This ensures that identical detail requests (even from different queries) share the same cache entry.
   */
  getProductDataCacheKey(
    url: string,
    supplierName: string,
    params?: Record<string, string>,
  ): string {
    const data = {
      url, // Must match the actual HTTP request URL
      params: params || {}, // Must match the actual HTTP request params
      supplier: supplierName, // Optional: for multi-supplier safety
    };
    return md5(JSON.stringify(data));
  }

  /**
   * Stores query results in the cache.
   */
  async cacheQueryResults(
    query: string,
    supplierName: string,
    results: unknown[],
    limit: number,
  ): Promise<void> {
    try {
      const key = this.generateCacheKey(query, supplierName);
      const result = await chrome.storage.local.get(SupplierCache.queryCacheKey);
      const cache =
        (result[SupplierCache.queryCacheKey] as Record<string, CachedData<unknown>>) || {};

      // If cache is full, remove oldest entry
      if (Object.keys(cache).length >= SupplierCache.cacheSize) {
        const oldestKey = Object.entries(cache).sort(
          ([, a], [, b]) => a.__cacheMetadata.cachedAt - b.__cacheMetadata.cachedAt,
        )[0][0];
        this.logger.debug("Removing oldest cache entry", {
          key: oldestKey,
          age:
            Math.round(
              (Date.now() - cache[oldestKey].__cacheMetadata.cachedAt) / (60 * 60 * 1000),
            ) + " hours",
        });
        delete cache[oldestKey];
      }

      cache[key] = {
        data: results,
        __cacheMetadata: {
          cachedAt: Date.now(),
          version: SupplierCache.CACHE_VERSION,
          query,
          supplier: supplierName,
          resultCount: results.length,
          limit,
        },
      };

      this.logger.debug("Cached query results", {
        key,
        metadata: cache[key].__cacheMetadata,
      });

      await chrome.storage.local.set({ [SupplierCache.queryCacheKey]: cache });
    } catch (error) {
      this.logger.error("Error storing query results in cache:", error);
    }
  }

  /**
   * Retrieves cached product data for a given key.
   */
  async getCachedProductData(key: string): Promise<Maybe<Record<string, unknown>>> {
    try {
      const result = await chrome.storage.local.get(SupplierCache.productDataCacheKey);
      const cache =
        (result[SupplierCache.productDataCacheKey] as Record<
          string,
          { data: Record<string, unknown>; timestamp: number }
        >) || {};
      const cached = cache[key];
      if (cached) {
        await this.updateProductDataCacheTimestamp(key);
        return cached.data;
      }
      return undefined;
    } catch (error) {
      this.logger.error("Error retrieving product data from cache:", error);
      return undefined;
    }
  }

  /**
   * Updates the timestamp for a cached product data entry.
   */
  async updateProductDataCacheTimestamp(key: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(SupplierCache.productDataCacheKey);
      const cache =
        (result[SupplierCache.productDataCacheKey] as Record<
          string,
          { data: Record<string, unknown>; timestamp: number }
        >) || {};
      if (cache[key]) {
        cache[key].timestamp = Date.now();
        await chrome.storage.local.set({ [SupplierCache.productDataCacheKey]: cache });
      }
    } catch (error) {
      this.logger.error("Error updating product data cache timestamp:", error);
    }
  }

  /**
   * Stores product data in the cache.
   */
  async cacheProductData(key: string, data: Record<string, unknown>): Promise<void> {
    try {
      const result = await chrome.storage.local.get(SupplierCache.productDataCacheKey);
      const cache =
        (result[SupplierCache.productDataCacheKey] as Record<
          string,
          { data: Record<string, unknown>; timestamp: number }
        >) || {};
      if (Object.keys(cache).length >= SupplierCache.productDataCacheSize) {
        const oldestKey = Object.entries(cache).sort(
          ([, a], [, b]) => a.timestamp - b.timestamp,
        )[0][0];
        delete cache[oldestKey];
      }
      cache[key] = {
        data,
        timestamp: Date.now(),
      };
      await chrome.storage.local.set({ [SupplierCache.productDataCacheKey]: cache });
    } catch (error) {
      this.logger.error("Error storing product data in cache:", error);
    }
  }

  /**
   * Gets the query cache key used in storage.
   */
  static getQueryCacheKey(): string {
    return SupplierCache.queryCacheKey;
  }

  /**
   * Gets the product data cache key used in storage.
   */
  static getProductDataCacheKey(): string {
    return SupplierCache.productDataCacheKey;
  }
}
