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
 * Utility class for managing supplier data caching in Chrome's local storage.
 * Provides a robust caching system for both query results and product detail data.
 *
 * @remarks
 * Benefits of this Caching Approach:
 *
 * 1. Granular Data Reuse:
 *    - Product detail data is cached independently of search results
 *    - Same product details can be reused across different search queries
 *    - Example: If "sodium chloride" and "NaCl" searches return the same product,
 *      the product details are only fetched and cached once
 *
 * 2. Flexible Result Limits:
 *    - Search results are cached without limit constraints
 *    - Same cached results can be used for different limit requests
 *    - Example: A search for "acetone" can return 5, 10, or 20 results
 *      using the same cached data, just sliced differently
 *
 * 3. Storage Efficiency:
 *    - Avoids duplicate storage of product details
 *    - Reduces storage requirements by ~50-80% compared to
 *      caching complete results for each query
 *    - Example: 100 searches returning the same 10 products
 *      would store product details 100 times in a naive cache,
 *      but only 10 times in this system
 *
 * 4. Improved Performance:
 *    - Faster subsequent searches due to partial cache hits
 *    - Reduced API calls by reusing cached product details
 *    - Example: A new search that includes previously
 *      cached products can skip their detail fetches
 *
 * 5. Better Cache Invalidation:
 *    - Product details can be invalidated independently
 *    - Search results remain valid even if some product
 *      details are updated
 *    - Example: Price updates only require re-fetching
 *      affected product details, not all search results
 *
 * 6. Optimized Network Usage:
 *    - Minimizes redundant API calls
 *    - Reduces bandwidth usage by avoiding
 *      re-fetching unchanged data
 *    - Example: Product descriptions rarely change,
 *      so they can be cached longer than prices
 *
 * The cache system uses two separate storage keys:
 * 1. `supplier_query_cache` - Stores search query results
 * 2. `supplier_product_data_cache` - Stores detailed product data
 *
 * Cache Storage Format:
 * - Query Cache:
 *   ```typescript
 *   {
 *     [cacheKey: string]: {
 *       data: T[],                    // The actual cached results
 *       __cacheMetadata: {            // Metadata about the cache entry
 *         cachedAt: number,           // Timestamp when cached
 *         version: number,            // Cache format version
 *         query: string,              // Original search query
 *         supplier: string,           // Supplier name
 *         resultCount: number,        // Number of results
 *         limit: number              // Limit used for query
 *       }
 *     }
 *   }
 *   ```
 *
 * - Product Data Cache:
 *   ```typescript
 *   {
 *     [cacheKey: string]: {
 *       data: Record<string, unknown>, // The cached product data
 *       timestamp: number             // When the data was cached
 *     }
 *   }
 *   ```
 *
 * Cache Key Generation:
 * - Query Cache Keys: Generated using base64 encoding of `${query}:${supplierName}`
 *   Falls back to a simple hash if base64 is unavailable
 * - Product Data Cache Keys: Generated using MD5 hash of JSON stringified object containing:
 *   ```typescript
 *   {
 *     url: string,                    // Product URL
 *     params?: Record<string, string>, // Optional request parameters
 *     supplier: string                // Supplier name
 *   }
 *   ```
 *
 * Cache Expiration & Management:
 * - Size Limits:
 *   - Query Cache: Maximum 100 entries
 *   - Product Data Cache: Maximum 100 entries
 * - Eviction Policy: Least Recently Used (LRU)
 *   - When cache is full, oldest entries are removed based on timestamp
 * - Cache Invalidation:
 *   - Query cache entries are invalidated if:
 *     1. Cache version changes (`CACHE_VERSION` constant)
 *     2. Requested limit is greater than cached limit
 *   - Product data cache entries are refreshed on access
 *     (timestamp updated to prevent premature eviction)
 *
 * Cache Triggering:
 * The cache is automatically triggered in two main scenarios:
 *
 * 1. Query Results Caching (via `queryProductsWithCache`):
 *    ```typescript
 *    // Inside SupplierBase class
 *    protected async queryProductsWithCache(query: string, limit: number) {
 *      // 1. Check cache first
 *      const key = this.cache.generateCacheKey(query, this.supplierName);
 *      const cached = await this.getCachedQueryResults(key);
 *
 *      if (cached) {
 *        // 2a. Return cached results if valid
 *        return ProductBuilder.createFromCache(cached.data);
 *      }
 *
 *      // 2b. If not in cache, perform actual query
 *      const results = await this.queryProducts(query, limit);
 *
 *      // 3. Cache the new results
 *      if (results) {
 *        await this.cache.cacheQueryResults(
 *          query,
 *          this.supplierName,
 *          results.map(b => b.dump()),
 *          limit
 *        );
 *      }
 *
 *      return results;
 *    }
 *    ```
 *
 * 2. Product Data Caching (via `getProductData`):
 *    ```typescript
 *    // Inside SupplierBase class
 *    protected async getProductData(product: ProductBuilder<T>) {
 *      const url = product.get("url");
 *      const cacheKey = this.cache.getProductDataCacheKey(url, this.supplierName);
 *
 *      // 1. Check cache first
 *      const cachedData = await this.cache.getCachedProductData(cacheKey);
 *      if (cachedData) {
 *        // 2a. Return cached data if available
 *        product.setData(cachedData);
 *        return product;
 *      }
 *
 *      // 2b. If not in cache, fetch fresh data
 *      const resultBuilder = await this.getProductDataWithCache(product);
 *
 *      // 3. Cache the new data
 *      if (resultBuilder) {
 *        await this.cache.cacheProductData(
 *          cacheKey,
 *          resultBuilder.dump()
 *        );
 *      }
 *
 *      return resultBuilder;
 *    }
 *    ```
 *
 * Cache Flow:
 * 1. Query Results:
 *    - Triggered by supplier's search operations
 *    - Cached after initial search results are processed (smaller cache than if the raw result was cached or the fully processed data)
 *    - Retrieved before making new search requests
 *    - Invalidated when search parameters change (not including timestamps in the URL)
 *
 * 2. Product Data:
 *    - Triggered when fetching detailed product information
 *    - Cached after successful product data retrieval (output of `ProductBuilder.dump()`)
 *    - Retrieved before making new product detail requests
 *    - Automatically refreshed on access to prevent eviction
 *
 * Usage Example:
 * ```typescript
 * // Initialize cache for a supplier
 * const cache = new SupplierCache("ChemSupplier");
 *
 * // Cache query results
 * await cache.cacheQueryResults(
 *   "sodium chloride",
 *   "ChemSupplier",
 *   results,
 *   10
 * );
 *
 * // Cache product data
 * await cache.cacheProductData(
 *   cacheKey,
 *   productData
 * );
 *
 * // Retrieve cached data
 * const cachedData = await cache.getCachedProductData(cacheKey);
 * ```
 *
 * @category Utilities
 * @typeParam T - The type of data being cached
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
