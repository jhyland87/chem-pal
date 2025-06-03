/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchDecorator, isFullURL } from "@/helpers/request";
import Logger from "@/utils/Logger";
import ProductBuilder from "@/utils/ProductBuilder";
import {
  isHtmlResponse,
  isHttpResponse,
  isJsonResponse,
  isMinimalProduct,
} from "@/utils/typeGuards/common";
import { extract, WRatio } from "fuzzball";
import { md5 } from "js-md5";
import { type JsonValue } from "type-fest";

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
 * The base class for all suppliers.
 * @abstract
 * @category Suppliers
 * @typeParam S - the partial product
 * @typeParam T - The product type
 * @example
 * ```typescript
 * const supplier = new SupplierBase<Product>();
 * ```
 */
export default abstract class SupplierBase<S, T extends Product> implements AsyncIterable<Product> {
  // The name of the supplier (used for display name, lists, etc)
  public abstract readonly supplierName: string;

  // The base URL for the supplier.
  protected abstract baseURL: string;

  /**
   * The shipping scope of the supplier.
   * This is used to determine the shipping scope of the supplier.
   */
  public abstract readonly shipping: ShippingRange;

  /**
   * The country code of the supplier.
   * This is used to determine the currency and other country-specific information.
   */
  public abstract readonly country: CountryCode;

  /**
   * String to query for (Product name, CAS, etc).
   * This is the search term that will be used to find products.
   * Set during construction and used throughout the supplier's lifecycle.
   *
   * @example
   * ```typescript
   * const supplier = new MySupplier("sodium chloride", 10);
   * console.log(supplier.query); // "sodium chloride"
   * ```
   */
  protected query: string;

  /**
   * If the products first require a query of a search page that gets iterated over,
   * those results are stored here. This acts as a cache for the initial search results
   * before they are processed into full product objects.
   *
   * @example
   * ```typescript
   * // After a search query
   * await supplier.queryProducts("acetone");
   * console.log(`Found ${supplier.queryResults.length} initial results`);
   * ```
   */
  protected queryResults: Array<S> = [];

  /**
   * The base search parameters that are always included in search requests.
   * These parameters are merged with any additional search parameters
   * when making requests to the supplier's API.
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBase<Product> {
   *   constructor() {
   *     super();
   *     this.baseSearchParams = {
   *       format: "json",
   *       version: "2.0"
   *     };
   *   }
   * }
   * ```
   */
  protected baseSearchParams: Record<string, string | number> = {};

  /**
   * The AbortController instance used to manage and cancel ongoing requests.
   * This allows for cancellation of in-flight requests when needed,
   * such as when a new search is started or the supplier is disposed.
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * const supplier = new MySupplier("acetone", 5, controller);
   *
   * // Later, to cancel all pending requests:
   * controller.abort();
   * ```
   */
  protected controller: AbortController;

  /**
   * The maximum number of results to return for a search query.
   * This is not a limit on HTTP requests, but rather the number of
   * products that will be returned to the caller.
   *
   * @example
   * ```typescript
   * const supplier = new MySupplier("acetone", 5); // Limit to 5 results
   * for await (const product of supplier) {
   *   // Will yield at most 5 products
   * }
   * ```
   */
  protected limit: number;

  /**
   * The products that are currently being built by the supplier.
   * This array holds ProductBuilder instances that are in the process
   * of being transformed into complete Product objects.
   *
   * @example
   * ```typescript
   * await supplier.queryProducts("acetone");
   * console.log(`Building ${supplier.products.length} products`);
   * for (const builder of supplier.products) {
   *   const product = await builder.build();
   *   console.log("Built product:", product.title);
   * }
   * ```
   */
  protected products: ProductBuilder<T>[] = [];

  /**
   * Maximum number of HTTP requests allowed per search query.
   * This is a hard limit to prevent excessive requests to the supplier's API.
   * If this limit is reached, the supplier will stop making new requests.
   *
   * @defaultValue 50
   * @example
   * ```typescript
   * class MySupplier extends SupplierBase<Product> {
   *   constructor() {
   *     super();
   *     this.httpRequestHardLimit = 100; // Allow more requests
   *   }
   * }
   * ```
   */
  protected httpRequestHardLimit: number = 50;

  /**
   * Counter for HTTP requests made during the current query execution.
   * This is used to track the number of requests and ensure we don't
   * exceed the httpRequestHardLimit.
   *
   * @defaultValue 0
   * @example
   * ```typescript
   * await supplier.queryProducts("acetone");
   * console.log(`Made ${supplier.requestCount} requests`);
   * if (supplier.requestCount >= supplier.httpRequestHardLimit) {
   *   console.log("Reached request limit");
   * }
   * ```
   */
  protected requestCount: number = 0;

  /**
   * Number of requests to process in parallel when fetching product details.
   * This controls the batch size for concurrent requests to avoid overwhelming
   * the supplier's API and the user's bandwidth.
   *
   * @defaultValue 10
   * @example
   * ```typescript
   * class MySupplier extends SupplierBase<Product> {
   *   constructor() {
   *     super();
   *     // Process 5 requests at a time
   *     this.httpRequestBatchSize = 5;
   *   }
   * }
   * ```
   */
  protected httpRequestBatchSize: number = 10;

  /**
   * HTTP headers used as a basis for all requests to the supplier.
   * These headers are merged with any request-specific headers when
   * making HTTP requests.
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBase<Product> {
   *   constructor() {
   *     super();
   *     this.headers = {
   *       "Accept": "application/json",
   *       "User-Agent": "ChemCrawler/1.0"
   *     };
   *   }
   * }
   * ```
   */
  protected headers: HeadersInit = {};

  // Logger for the supplier. This gets initialized in this constructor with the
  // name of the inheriting class.
  protected logger: Logger;
  // Cache configuration
  private static readonly cacheKey = "supplier_cache";

  // Maximum number of cached results
  private static readonly cacheSize = 100;

  // Default values for products. These will get overridden if they're found in the product data.
  protected productDefaults = {
    uom: "ea",
    quantity: 1,
    currencyCode: "USD",
    currencySymbol: "$",
  };

  // --- Product Data Cache Logic ---
  protected static readonly productDataCacheKey = "supplier_product_data_cache";

  // Cache configuration for query results
  private static readonly queryCacheKey = "supplier_query_cache";
  // Cache version - increment this when cache format changes
  private static readonly CACHE_VERSION = 1;

  /**
   * Creates a new instance of the supplier base class.
   * Initializes the supplier with query parameters, request limits, and abort controller.
   * Sets up logging and default product values.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to return (default: 5)
   * @param controller - AbortController instance for managing request cancellation
   *
   * @example
   * ```typescript
   * // Create a supplier with default limit
   * const supplier = new MySupplier("sodium chloride", undefined, new AbortController());
   *
   * // Create a supplier with custom limit
   * const supplier = new MySupplier("acetone", 10, new AbortController());
   *
   * // Create a supplier and handle cancellation
   * const controller = new AbortController();
   * const supplier = new MySupplier("ethanol", 5, controller);
   *
   * // Later, to cancel all pending requests:
   * controller.abort();
   * ```
   */
  constructor(query: string, limit: number = 5, controller?: AbortController) {
    this.logger = new Logger(this.constructor.name);
    this.query = query;
    this.limit = limit;
    if (controller) {
      this.controller = controller;
    } else {
      this.logger.debug("Made a new AbortController");
      this.controller = new AbortController();
    }
  }

  /**
   * This is a placeholder for any setup that needs to be done before the query is made.
   * @returns A promise that resolves when the setup is complete.
   */
  protected async setup(): Promise<void> {}

  /**
   * Retrieves HTTP headers from a URL using a HEAD request.
   * Useful for checking content types, caching headers, and other metadata without downloading the full response.
   *
   * @param url - The URL to fetch headers from
   * @returns Promise resolving to the response headers or void if request fails
   * @example
   * ```typescript
   * const headers = await this.httpGetHeaders('https://example.com/product/123');
   * if (headers) {
   *   console.log('Content-Type:', headers['content-type']);
   *   console.log('Last-Modified:', headers['last-modified']);
   * }
   * ```
   */
  protected async httpGetHeaders(url: string | URL): Promise<Maybe<HeadersInit>> {
    try {
      const requestObj = new Request(this.href(url), {
        signal: this.controller.signal,
        headers: new Headers(this.headers),
        referrer: this.baseURL,
        referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        method: "HEAD",
        mode: "cors",
        credentials: "include",
      });

      const httpResponse = await this.fetch(requestObj);

      return Object.fromEntries(httpResponse.headers.entries()) satisfies HeadersInit;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.warn("Request was aborted", { error, signal: this.controller.signal });
        this.controller.abort();
      } else {
        this.logger.error("Error received during fetch:", {
          error,
          signal: this.controller.signal,
        });
      }
    }
  }

  /**
   * Sends a POST request to the given URL with the given body and headers.
   * Handles request setup, error handling, and response caching.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the Response object or void if request fails
   * @example
   * ```typescript
   * // Basic POST request
   * const response = await this.httpPost({
   *   path: "/api/v1/products",
   *   body: { name: "Test Chemical" }
   * });
   *
   * // POST with custom host and params
   * const response = await this.httpPost({
   *   path: "/api/v1/products",
   *   host: "api.example.com",
   *   body: { name: "Test Chemical" },
   *   params: { version: "2" },
   *   headers: { "Content-Type": "application/json" }
   * });
   * ```
   */
  protected async httpPost({
    path,
    host,
    body,
    params,
    headers,
  }: RequestOptions): Promise<Maybe<Response>> {
    const method = "POST";
    const mode = "cors";
    const referrer = this.baseURL;
    const referrerPolicy = "strict-origin-when-cross-origin";
    const signal = this.controller.signal;
    const bodyStr = typeof body === "string" ? body : (JSON.stringify(body) ?? null);
    const headersObj = new Headers({
      ...this.headers,
      ...(headers as HeadersInit),
    });
    const url = this.href(path, params, host);

    const requestObj = new Request(url, {
      signal,
      headers: headersObj,
      referrer,
      referrerPolicy,
      body: bodyStr,
      method,
      mode,
    });

    // Fetch the goods
    const httpRequest = await this.fetch(requestObj);

    if (!isHttpResponse(httpRequest)) {
      const badResponse = await (httpRequest as unknown as Response)?.text();
      this.logger.error("Invalid POST response: ", badResponse);
      throw new TypeError(`Invalid POST response: ${httpRequest}`);
    }

    return httpRequest;
  }

  /**
   * Send a POST request to the given URL with the given body and headers and return the response as a JSON object.
   *
   * @param params - The parameters for the POST request.
   * @returns The response from the POST request as a JSON object.
   * @example
   * ```typescript
   * // Assume the baseURL is https://example.com
   * const responseJSON = await this.httpPostJson({
   *    path: "/api/v1/products",
   *    body: { name: "John" },
   *    headers: { "Content-Type": "application/json" }
   * });
   * // Sends HTTP POST request to https://example.com/api/v1/products with `{"name":"John"}` body.
   * // Returns a JSON object.
   *
   * const responseJSON = await this.httpPostJson({
   *    path: "/api/v1/products",
   *    host: "api.example.com",
   *    body: { name: "John" },
   *    params: { a: "b", c: "d" },
   *    headers: { "Content-Type": "application/json" }
   * });
   * // Sends HTTP POST request to https://api.example.com/api/v1/products?a=b&c=d with `{"name":"John"}` body.
   * // Returns a JSON object.
   * ```
   */
  protected async httpPostJson({
    path,
    host,
    body,
    params,
    headers,
  }: RequestOptions): Promise<Maybe<JsonValue>> {
    const httpRequest = await this.httpPost({ path, host, body, params, headers });
    if (!isJsonResponse(httpRequest)) {
      throw new TypeError(`httpPostJson| Invalid POST response: ${httpRequest}`);
    }
    return await httpRequest.json();
  }

  /**
   * Sends a GET request to the given URL with the specified options.
   * Handles request setup, error handling, and response caching.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the Response object or void if request fails
   * @example
   * ```typescript
   * // Basic GET request
   * const response = await this.httpGet({
   *   path: "/products/search",
   *   params: { query: "sodium chloride" }
   * });
   *
   * // GET with custom host and headers
   * const response = await this.httpGet({
   *   path: "/api/products",
   *   host: "api.example.com",
   *   params: { category: "chemicals" },
   *   headers: { "Accept": "application/json" }
   * });
   * ```
   */
  protected async httpGet({
    path,
    params,
    headers,
    host,
  }: RequestOptions): Promise<Maybe<Response>> {
    try {
      // Check if the request has been aborted before proceeding
      if (this.controller.signal.aborted) {
        this.logger.warn("Request was aborted before fetch", {
          signal: this.controller.signal,
        });
        return;
      }

      const headersRaw = { ...this.headers };

      Object.assign(headersRaw, {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        ...(headers ?? {}),
      });

      const requestObj = new Request(this.href(path, params, host), {
        signal: this.controller.signal,
        headers: new Headers(headersRaw),
        referrer: this.baseURL,
        referrerPolicy: "no-referrer",
        body: null,
        method: "GET",
        mode: "cors",
        credentials: "include",
      });

      // Fetch the goods
      const httpResponse = await this.fetch(requestObj.url, requestObj);
      //const httpResponse = await fetchDecorator(requestObj.url, requestObj);

      return httpResponse;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.warn("Request was aborted", { error, signal: this.controller.signal });
        this.controller.abort();
      } else {
        this.logger.error("Error received during fetch:", {
          error,
          signal: this.controller.signal,
        });
      }
    }
  }

  /**
   * Filters an array of data using fuzzy string matching to find items that closely match a query string.
   * Uses the WRatio algorithm from fuzzball for string similarity comparison.
   *
   * @param query - The search string to match against
   * @param data - Array of data objects to search through
   * @param cutoff - Minimum similarity score (0-100) for a match to be included (default: 40)
   * @returns Array of matching data objects with added fuzzy match metadata
   *
   * @example
   * ```typescript
   * // Example with simple string array
   * const products = [
   *   { title: "Sodium Chloride", price: 29.99 },
   *   { title: "Sodium Hydroxide", price: 39.99 },
   *   { title: "Potassium Chloride", price: 19.99 }
   * ];
   *
   * const matches = this.fuzzyFilter("sodium chloride", products);
   * // Returns: [
   * //   {
   * //     title: "Sodium Chloride",
   * //     price: 29.99,
   * //     ___fuzz: { score: 100, idx: 0 }
   * //   },
   * //   {
   * //     title: "Sodium Hydroxide",
   * //     price: 39.99,
   * //     ___fuzz: { score: 85, idx: 1 }
   * //   }
   * // ]
   *
   * // Example with custom cutoff
   * const strictMatches = this.fuzzyFilter("sodium chloride", products, 90);
   * // Returns only exact matches with score >= 90
   *
   * // Example with different data structure
   * const chemicals = [
   *   { name: "NaCl", formula: "Sodium Chloride" },
   *   { name: "NaOH", formula: "Sodium Hydroxide" }
   * ];
   *
   * // Override titleSelector to use formula field
   * this.titleSelector = (data) => data.formula;
   * const formulaMatches = this.fuzzyFilter("sodium chloride", chemicals);
   * ```
   */
  protected fuzzyFilter<X>(query: string, data: X[], cutoff: number = 40): X[] {
    const res = extract(query, data, {
      scorer: WRatio,
      processor: this.titleSelector as (choice: unknown) => string,
      cutoff: cutoff,
      sortBySimilarity: true,
    }).reduce(
      (acc, [obj, score, idx]) => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        acc[idx] = Object.assign(obj, { ___fuzz: { score, idx } });
        return acc;
      },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      [] as Array<X & { ___fuzz: { score: number; idx: number } }>,
    ) as X[];

    this.logger.debug("fuzzed search results:", res);

    // Get rid of any empty items that didn't match closely enough
    return res.filter((item) => !!item);
  }

  /**
   * Abstract method to select the title from the initial raw search data.
   * This method should be implemented by each supplier to handle their specific data structure.
   * The selected title is used by fuzzyFilter for string similarity matching.
   *
   * @param data - The data object to extract the title from
   * @returns The title string to use for fuzzy matching
   * @abstract
   * @example
   * ```typescript
   * // Example implementation for a supplier with simple title field
   * protected titleSelector(data: Cheerio<Element>): string {
   *   return data.text();
   * }
   *
   * // Example implementation for a supplier with nested title
   * protected titleSelector(data: SupplierProduct): string {
   *   return data.productInfo.name;
   * }
   *
   * // Example implementation for a supplier with multiple possible title fields
   * protected titleSelector(data: SupplierProduct): string {
   *   return data.displayName || data.productName || data.name || '';
   * }
   *
   * // Example implementation for a supplier with formatted title
   * protected titleSelector(data: SupplierProduct): string {
   *   return `${data.name} ${data.grade} ${data.purity}`.trim();
   * }
   * ```
   */
  protected abstract titleSelector(data: any): string;

  /**
   * Makes an HTTP GET request and returns the response as a string.
   * Handles request configuration, error handling, and HTML parsing.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the HTML response as a string or void if request fails
   * @throws TypeError - If the response is not valid HTML content
   *
   * @example
   * ```typescript
   * // Basic GET request
   * const html = await this.httpGetHtml({
   *   path: "/api/products",
   *   params: { search: "sodium" }
   * });
   *
   * // GET request with custom headers
   * const html = await this.httpGetHtml({
   *   path: "/api/products",
   *   headers: {
   *     "Authorization": "Bearer token123",
   *     "Accept": "text/html"
   *   }
   * });
   *
   * // GET request with custom host
   * const html = await this.httpGetHtml({
   *   path: "/products",
   *   host: "api.supplier.com",
   *   params: { limit: 10 }
   * });
   * ```
   */
  protected async httpGetHtml({
    path,
    params,
    headers,
    host,
  }: RequestOptions): Promise<Maybe<string>> {
    const httpResponse = await this.httpGet({ path, params, headers, host });
    if (!isHtmlResponse(httpResponse)) {
      throw new TypeError(`httpGetHtml| Invalid GET response: ${httpResponse}`);
    }
    return await httpResponse.text();
  }

  /**
   * Makes an HTTP GET request and returns the response as parsed JSON.
   * Handles request configuration, error handling, and JSON parsing.
   * Includes automatic retry logic for rate limiting and network errors.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the parsed JSON response or void if request fails
   * @throws TypeError - If the response is not valid JSON content
   *
   * @example
   * ```typescript
   * // Basic GET request
   * const data = await this.httpGetJson({
   *   path: "/api/products",
   *   params: { search: "sodium" }
   * });
   *
   * // GET request with custom headers
   * const data = await this.httpGetJson({
   *   path: "/api/products",
   *   headers: {
   *     "Authorization": "Bearer token123",
   *     "Accept": "application/json"
   *   }
   * });
   *
   * // GET request with custom host
   * const data = await this.httpGetJson({
   *   path: "/products",
   *   host: "api.supplier.com",
   *   params: { limit: 10 }
   * });
   *
   * // Error handling
   * try {
   *   const data = await this.httpGetJson({
   *     path: "/api/products"
   *   });
   *   if (data) {
   *     console.log("Products:", data);
   *   }
   * } catch (error) {
   *   console.error("Failed to fetch products:", error);
   * }
   * ```
   */
  protected async httpGetJson({
    path,
    params,
    headers,
    host,
  }: RequestOptions): Promise<Maybe<JsonValue>> {
    const httpRequest = await this.httpGet({ path, params, headers, host });

    if (!isJsonResponse(httpRequest)) {
      const badResponse = await (httpRequest as unknown as Response)?.text();
      this.logger.error("Invalid HTTP GET response: ", badResponse);
      return;
    }

    return await httpRequest.json();
  }

  /**
   * Generates a cache key based on the query and supplier name.
   * The limit is intentionally excluded as it only affects how many results are returned,
   * not the actual search results themselves.
   *
   * @returns A string hash that uniquely identifies this search request
   */
  private generateCacheKey(): string {
    const data = `${this.query || ""}:${this.supplierName || ""}`;
    this.logger.debug("Generating cache key with:", {
      query: this.query,
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
   * Gets cached query results if they exist.
   * @param query - The search query
   * @returns Promise resolving to cached query results or undefined if not found
   */
  private async getCachedQueryResults(query: string): Promise<Maybe<unknown[]>> {
    try {
      const key = this.generateCacheKey();
      const result = await chrome.storage.local.get(SupplierBase.queryCacheKey);
      const cache =
        (result[SupplierBase.queryCacheKey] as Record<string, CachedData<unknown>>) || {};
      const cached = cache[key];

      if (cached) {
        if (this.isCacheStale(cached.__cacheMetadata)) {
          this.logger.debug("Cache entry is stale, removing", cached.__cacheMetadata);
          delete cache[key];
          await chrome.storage.local.set({ [SupplierBase.queryCacheKey]: cache });
          return undefined;
        }
        await this.updateQueryCacheTimestamp(key);
        return cached.data;
      }
      return undefined;
    } catch (error) {
      this.logger.error("Error retrieving query results from cache:", error);
      return undefined;
    }
  }

  /**
   * Stores query results in the cache.
   * @param query - The search query
   * @param results - The processed query results to cache (array of objects for ProductBuilder)
   */
  private async cacheQueryResults(query: string, results: unknown[], limit: number): Promise<void> {
    try {
      const key = this.generateCacheKey();
      const result = await chrome.storage.local.get(SupplierBase.queryCacheKey);
      const cache =
        (result[SupplierBase.queryCacheKey] as Record<string, CachedData<unknown>>) || {};

      // If cache is full, remove oldest entry
      if (Object.keys(cache).length >= SupplierBase.cacheSize) {
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
          version: SupplierBase.CACHE_VERSION,
          query,
          supplier: this.supplierName,
          resultCount: results.length,
          limit, // Store the limit used to generate this cache
        },
      };

      this.logger.debug("Cached query results", {
        key,
        metadata: cache[key].__cacheMetadata,
      });

      await chrome.storage.local.set({ [SupplierBase.queryCacheKey]: cache });
    } catch (error) {
      this.logger.error("Error storing query results in cache:", error);
    }
  }

  /**
   * Creates ProductBuilder instances from cached standardized product data.
   * This is used to restore builders from the query-level cache.
   * @param data - Array of cached product data (from .dump())
   * @returns Array of ProductBuilder instances
   */
  protected initProductBuildersFromCache(data: unknown[]): ProductBuilder<T>[] {
    return data.map((d) => {
      const builder = new ProductBuilder<T>(this.baseURL);
      builder.setData(d as Partial<T>);
      return builder;
    });
  }

  /**
   * Executes a product search query with caching support.
   * First checks the cache for existing results, then falls back to the actual query if needed.
   * The limit parameter is only used for the actual query and doesn't affect caching.
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to return
   * @returns Promise resolving to array of product builders or void if search fails
   */
  protected async queryProductsWithCache(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<T>[] | void> {
    // Check cache first (processed product data)
    const key = this.generateCacheKey();
    const result = await chrome.storage.local.get(SupplierBase.queryCacheKey);
    const cache = (result[SupplierBase.queryCacheKey] as Record<string, CachedData<unknown>>) || {};
    const cached = cache[key];
    if (cached) {
      // If the cached limit is less than the requested limit, invalidate the cache
      if (
        typeof cached.__cacheMetadata.limit === "number" &&
        cached.__cacheMetadata.limit < limit
      ) {
        this.logger.debug("Invalidating query cache due to insufficient limit", {
          cachedLimit: cached.__cacheMetadata.limit,
          requestedLimit: limit,
        });
        delete cache[key];
        await chrome.storage.local.set({ [SupplierBase.queryCacheKey]: cache });
      } else {
        this.logger.debug("Returning cached query results");
        // Re-initialize product builders from cached processed data
        return this.initProductBuildersFromCache(cached.data.slice(0, limit));
      }
    }

    // If not in cache, perform the actual query
    const results = await this.queryProducts(query, limit);
    if (results) {
      // Store processed results in cache (dumped/serialized form) and the limit used
      await this.cacheQueryResults(
        query,
        results.map((b) => b.dump()),
        limit,
      );
    }
    return results;
  }

  /**
   * Determines if a cache entry is stale based on its metadata.
   * @param metadata - The cache metadata to check
   * @returns true if the cache entry should be considered stale
   */
  private isCacheStale(metadata: CacheMetadata): boolean {
    if (metadata.version !== SupplierBase.CACHE_VERSION) {
      this.logger.debug("Cache version mismatch", {
        cached: metadata.version,
        current: SupplierBase.CACHE_VERSION,
      });
      return true;
    }
    const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
    const age = Date.now() - metadata.cachedAt;
    if (age > CACHE_MAX_AGE) {
      this.logger.debug("Cache entry too old", {
        age: Math.round(age / (60 * 60 * 1000)) + " hours",
        maxAge: CACHE_MAX_AGE / (60 * 60 * 1000) + " hours",
      });
      return true;
    }
    return false;
  }

  /**
   * Updates the timestamp for a query cache entry.
   * @param key - The cache key to update
   */
  private async updateQueryCacheTimestamp(key: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(SupplierBase.queryCacheKey);
      const cache =
        (result[SupplierBase.queryCacheKey] as Record<string, CachedData<unknown>>) || {};
      if (cache[key]) {
        cache[key].__cacheMetadata.cachedAt = Date.now();
        await chrome.storage.local.set({ [SupplierBase.queryCacheKey]: cache });
      }
    } catch (error) {
      this.logger.error("Error updating query cache timestamp:", error);
    }
  }

  /**
   * The function asynchronously iterates over query results, retrieves product data, and yields valid
   * results.
   * @returns An async generator that yields valid results.
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<Product, void, unknown> {
    try {
      await this.setup();
      // Use queryProductsWithCache to get processed product data (from cache or fresh)
      const results = await this.queryProductsWithCache(this.query, this.limit);
      if (typeof results === "undefined" || results.length === 0) {
        this.logger.debug(`No query results found`);
        return;
      }
      this.products = results;

      // Process results in batches to maintain controlled concurrency
      for (let i = 0; i < this.products.length; i += this.httpRequestBatchSize) {
        const batch = this.products.slice(i, i + this.httpRequestBatchSize);
        const batchPromises = batch.map((r: unknown) => {
          if (r instanceof ProductBuilder === false) {
            this.logger.error("Invalid product builder:", r);
            return Promise.reject(new Error("Invalid product builder"));
          }
          // getProductData uses its own per-product detail cache
          return this.getProductData(r as ProductBuilder<T>);
        });
        const batchResults = await Promise.allSettled(batchPromises);
        for (const result of batchResults) {
          if (this.controller.signal.aborted) throw this.controller.signal.reason;
          if (result.status === "rejected") {
            this.logger.error("Error found when yielding a product:", { result });
            continue;
          }
          try {
            if (typeof result.value === "undefined") {
              this.logger.warn("Product value was undefined", { result });
              continue;
            }
            const finishedProduct = await this.finishProduct(result.value as ProductBuilder<T>);
            if (finishedProduct) {
              yield finishedProduct;
            }
          } catch (err) {
            this.logger.error("Error found when yielding a product:", { err });
            continue;
          }
        }
      }
    } catch (err) {
      if (this.controller.signal.aborted === true) {
        this.logger.warn("Search was aborted");
        return;
      }
      this.logger.error("ERROR in generator fn:", { err });
    }
  }

  /**
   * Finalizes a partial product by adding computed properties and validating the result.
   * This method:
   * 1. Validates the product has minimal required properties
   * 2. Computes USD price if product is in different currency
   * 3. Calculates base quantity using the unit of measure
   * 4. Ensures the product URL is absolute
   *
   * @param product - The ProductBuilder instance containing the partial product to finalize
   * @returns Promise resolving to a complete Product object or void if validation fails
   *
   * @example
   * ```typescript
   * // Example with a valid partial product
   * const builder = new ProductBuilder<Product>(this.baseURL);
   * builder
   *   .setBasicInfo("Sodium Chloride", "/products/nacl", "ChemSupplier")
   *   .setPricing(29.99, "USD", "$")
   *   .setQuantity(500, "g");
   *
   * const finishedProduct = await this.finishProduct(builder);
   * if (finishedProduct) {
   *   console.log("Finalized product:", {
   *     title: finishedProduct.title,
   *     price: finishedProduct.price,
   *     quantity: finishedProduct.quantity,
   *     uom: finishedProduct.uom,
   *     usdPrice: finishedProduct.usdPrice,
   *     baseQuantity: finishedProduct.baseQuantity
   *   });
   * }
   *
   * // Example with an invalid partial product
   * const invalidBuilder = new ProductBuilder<Product>(this.baseURL);
   * invalidBuilder.setBasicInfo("Sodium Chloride", "/products/nacl", "ChemSupplier");
   * // Missing required fields
   *
   * const invalidProduct = await this.finishProduct(invalidBuilder);
   * if (!invalidProduct) {
   *   console.log("Failed to finalize product - missing required fields");
   * }
   * ```
   */
  protected async finishProduct(product: ProductBuilder<Product>): Promise<Maybe<Product>> {
    if (!isMinimalProduct(product.dump())) {
      this.logger.warn("Unable to finish product - Minimum data not set", { product });
      return;
    }

    // Set the country and shipping scope of the supplier. Later these may change if they
    // have different restrictions on different products or countries.
    product.setSupplierCountry(this.country);
    product.setSupplierShipping(this.shipping);

    /*
    const title = product.get("title");
    if (title) {
      const fuzz = this.fuzzyFilter(this.query, [title], 2, 0.5);
      console.log("fuzz score for", title, fuzz[0]?.[1] ?? 0);
    }
    */

    return await product.build();
  }

  /**
   * Takes in either a relative or absolute URL and returns an absolute URL. This is useful for when you aren't
   * sure if the link (retrieved from parsed text, a setting, an element, an anchor value, etc) is absolute or
   * not. Using relative links will result in http://chrome-extension://... being added to the link.
   *
   * @param path - URL object or string
   * @param params - The parameters to add to the URL.
   * @param host - The host to use for overrides (eg: needing to call a different host for an API)
   * @returns absolute URL
   * @example
   * ```typescript
   * this.href('/some/path')
   * // https://supplier_base_url.com/some/path
   *
   * this.href('https://supplier_base_url.com/some/path', null, 'another_host.com')
   * // https://another_host.com/some/path
   *
   * this.href('/some/path', { a: 'b', c: 'd' }, 'another_host.com')
   * // http://another_host.com/some/path?a=b&c=d
   *
   * this.href('https://supplier_base_url.com/some/path')
   * // https://supplier_base_url.com/some/path
   *
   * this.href(new URL('https://supplier_base_url.com/some/path'))
   * // https://supplier_base_url.com/some/path
   *
   * this.href('/some/path', { a: 'b', c: 'd' })
   * // https://supplier_base_url.com/some/path?a=b&c=d
   *
   * this.href('https://supplier_base_url.com/some/path', new URLSearchParams({ a: 'b', c: 'd' }))
   * // https://supplier_base_url.com/some/path?a=b&c=d
   * ```
   */
  protected href(path: string | URL, params?: Maybe<RequestParams>, host?: string): string {
    let href: URL;

    if (typeof path === "string" && isFullURL(path)) {
      href = new URL(path);
    }

    href = new URL(path, this.baseURL);

    if (host) {
      href.host = host;
    }

    if (params && Object.keys(params).length > 0) {
      href.search = new URLSearchParams(
        Object.entries(params).reduce(
          (acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          },
          {} as Record<string, string>,
        ),
      ).toString();
      //href.search = new URLSearchParams(params as Record<string, string>).toString();
    }

    return href.toString();
  }

  protected abstract queryProducts(
    query: string,
    limit: number,
  ): Promise<ProductBuilder<T>[] | void>;

  protected abstract getProductData(product: ProductBuilder<T>): Promise<ProductBuilder<T> | void>;

  /**
   * Transforms an array of supplier-specific product data into ProductBuilder instances.
   * This method should be implemented by each supplier to handle their specific product data structure.
   *
   * @param products - Array of supplier-specific product data to transform
   * @returns Array of ProductBuilder instances
   *
   * @example
   * ```typescript
   * // Example implementation in a supplier class
   * protected initProductBuilders(products: SupplierProduct[]): ProductBuilder<Product>[] {
   *   return products.map(product => {
   *     const builder = new ProductBuilder<Product>(this.baseURL);
   *
   *     // Transform supplier-specific data into common format
   *     builder
   *       .setBasicInfo(
   *         product.name,
   *         product.productUrl,
   *         this.supplierName
   *       )
   *       .setPricing(
   *         product.price,
   *         product.currency,
   *         product.currencySymbol
   *       )
   *       .setQuantity(
   *         product.amount,
   *         product.unit
   *       );
   *
   *     // Add optional fields if available
   *     if (product.description) {
   *       builder.setDescription(product.description);
   *     }
   *     if (product.casNumber) {
   *       builder.setCas(product.casNumber);
   *     }
   *
   *     return builder;
   *   });
   * }
   *
   * // Example usage with sample data
   * const supplierProducts = [
   *   {
   *     name: "Sodium Chloride",
   *     productUrl: "/products/nacl",
   *     price: 29.99,
   *     currency: "USD",
   *     currencySymbol: "$",
   *     amount: 500,
   *     unit: "g",
   *     description: "High purity sodium chloride",
   *     casNumber: "7647-14-5"
   *   }
   * ];
   *
   * const builders = this.initProductBuilders(supplierProducts);
   * console.log("Created builders:", builders.length);
   * ```
   */
  protected abstract initProductBuilders(products: MaybeArray<unknown>): ProductBuilder<T>[];

  /**
   * Makes an HTTP request to the specified URL with optional configuration.
   * This method handles request limits, retries, and error handling.
   *
   * @param args - Identical to the fetch function
   * @returns Promise resolving to a Response object
   * @throws Error if the request fails or exceeds retry attempts
   *
   * @example
   * ```typescript
   * // Example usage with basic GET request
   * try {
   *   const response = await this.fetch("https://api.supplier.com/products");
   *   if (isJsonResponse(response)) {
   *     const data = await response.json();
   *     console.log("Received data:", data);
   *   }
   * } catch (error) {
   *   console.error("Fetch failed:", error.message);
   * }
   *
   * // Example with custom headers and method
   * const response = await this.fetch("https://api.supplier.com/products", {
   *   method: "POST",
   *   headers: {
   *     "Content-Type": "application/json",
   *     "Authorization": "Bearer token123"
   *   },
   *   body: JSON.stringify({
   *     query: "sodium chloride",
   *     limit: 10
   *   })
   * });
   *
   * // Example with retry handling
   * let retries = 0;
   * while (retries < 3) {
   *   try {
   *     const response = await this.fetch("https://api.supplier.com/products");
   *     break; // Success, exit retry loop
   *   } catch (error) {
   *     retries++;
   *     if (retries === 3) {
   *       throw new Error("Max retries exceeded");
   *     }
   *     await new Promise(resolve => setTimeout(resolve, 1000 * retries));
   *   }
   * }
   * ```
   */
  protected async fetch(...args: Parameters<typeof fetchDecorator>): Promise<Response> {
    const [input] = args;
    console.log(`Fetching: ${input}`);
    this.requestCount++;
    if (this.requestCount > this.httpRequestHardLimit) {
      this.logger.warn("Request count exceeded hard limit", { requestCount: this.requestCount });
      throw new Error("Request count exceeded hard limit");
    }
    const response = await fetchDecorator(...args);
    console.log(`Response Status: ${response.status}`);

    console.log("response hash:", response.requestHash);
    return response;
  }

  /**
   * Generates a cache key for product detail data based only on the HTTP request URL and params.
   * This ensures that identical detail requests (even from different queries) share the same cache entry.
   * Do NOT include the original search query or any unrelated context.
   *
   * @param product - The ProductBuilder instance (must have the correct URL set)
   * @param params - The params used in the actual HTTP request for product details
   * @returns A stable cache key for the product detail fetch
   */
  protected getProductDataCacheKey(
    product: ProductBuilder<T>,
    params?: Record<string, string>,
  ): string {
    const data = {
      url: product.get("url"), // Must match the actual HTTP request URL
      params: params || {}, // Must match the actual HTTP request params
      supplier: this.supplierName, // Optional: for multi-supplier safety
    };
    return md5(JSON.stringify(data));
  }

  protected async getCachedProductData(key: string): Promise<Maybe<Record<string, unknown>>> {
    try {
      const result = await chrome.storage.local.get(SupplierBase.productDataCacheKey);
      const cache =
        (result[SupplierBase.productDataCacheKey] as Record<
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

  protected async updateProductDataCacheTimestamp(key: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(SupplierBase.productDataCacheKey);
      const cache =
        (result[SupplierBase.productDataCacheKey] as Record<
          string,
          { data: Record<string, unknown>; timestamp: number }
        >) || {};
      if (cache[key]) {
        cache[key].timestamp = Date.now();
        await chrome.storage.local.set({ [SupplierBase.productDataCacheKey]: cache });
      }
    } catch (error) {
      this.logger.error("Error updating product data cache timestamp:", error);
    }
  }

  protected async cacheProductData(key: string, data: Record<string, unknown>): Promise<void> {
    try {
      const result = await chrome.storage.local.get(SupplierBase.productDataCacheKey);
      const cache =
        (result[SupplierBase.productDataCacheKey] as Record<
          string,
          { data: Record<string, unknown>; timestamp: number }
        >) || {};
      if (Object.keys(cache).length >= 100) {
        const oldestKey = Object.entries(cache).sort(
          ([, a], [, b]) => a.timestamp - b.timestamp,
        )[0][0];
        delete cache[oldestKey];
      }
      cache[key] = {
        data,
        timestamp: Date.now(),
      };
      await chrome.storage.local.set({ [SupplierBase.productDataCacheKey]: cache });
    } catch (error) {
      this.logger.error("Error storing product data in cache:", error);
    }
  }

  protected async getProductDataWithCache(
    product: ProductBuilder<T>,
    fetcher: (builder: ProductBuilder<T>) => Promise<ProductBuilder<T> | void>,
    params?: Record<string, string>,
  ): Promise<ProductBuilder<T> | void> {
    const url = product.get("url");
    const cacheKey = this.getProductDataCacheKey(product, params);
    console.log("[SupplierBase] Product detail cache key:", cacheKey, "for url:", url);
    const result = await chrome.storage.local.get(SupplierBase.productDataCacheKey);
    const cache =
      (result[SupplierBase.productDataCacheKey] as Record<
        string,
        { data: Record<string, unknown>; timestamp: number }
      >) || {};
    const cached = cache[cacheKey];
    if (cached) {
      // Update timestamp for LRU
      cached.timestamp = Date.now();
      await chrome.storage.local.set({ [SupplierBase.productDataCacheKey]: cache });
      product.setData(cached.data as Partial<T>);
      return product;
    }
    // Cache miss: call fetcher
    const resultBuilder = await fetcher(product);
    if (resultBuilder) {
      // Re-read the latest cache to avoid race conditions
      const latestResult = await chrome.storage.local.get(SupplierBase.productDataCacheKey);
      const latestCache =
        (latestResult[SupplierBase.productDataCacheKey] as Record<
          string,
          { data: Record<string, unknown>; timestamp: number }
        >) || {};

      latestCache[cacheKey] = {
        data: resultBuilder.dump(),
        timestamp: Date.now(),
      };
      // If cache is full, remove oldest entry
      if (Object.keys(latestCache).length > 100) {
        const oldestKey = Object.entries(latestCache).sort(
          ([, a], [, b]) => a.timestamp - b.timestamp,
        )[0][0];
        delete latestCache[oldestKey];
      }
      await chrome.storage.local.set({ [SupplierBase.productDataCacheKey]: latestCache });
    }
    return resultBuilder;
  }
}
