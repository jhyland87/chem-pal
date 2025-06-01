/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchDecorator, isFullURL } from "@/helpers/request";
import { Logger } from "@/utils/Logger";
import { ProductBuilder } from "@/utils/ProductBuilder";
import {
  isHtmlResponse,
  isHttpResponse,
  isJsonResponse,
  isMinimalProduct,
} from "@/utils/typeGuards/common";
import { extract, WRatio } from "fuzzball";
import { type JsonValue } from "type-fest";

/**
 * The base class for all suppliers.
 * @abstract
 * @category Suppliers
 * @module SupplierBase
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
   * console.log(supplier._query); // "sodium chloride"
   * ```
   */
  protected _query: string;

  /**
   * If the products first require a query of a search page that gets iterated over,
   * those results are stored here. This acts as a cache for the initial search results
   * before they are processed into full product objects.
   *
   * @example
   * ```typescript
   * // After a search query
   * await supplier._queryProducts("acetone");
   * console.log(`Found ${supplier._queryResults.length} initial results`);
   * ```
   */
  protected _queryResults: Array<S> = [];

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
   *     this._baseSearchParams = {
   *       format: "json",
   *       version: "2.0"
   *     };
   *   }
   * }
   * ```
   */
  protected _baseSearchParams: Record<string, string | number> = {};

  /**
   * The AbortController instance used to manage and cancel ongoing requests.
   * This allows for cancellation of in-flight requests when needed,
   * such as when a new search is started or the supplier is disposed.
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * const supplier = new MySupplier("acetone", 10, controller);
   *
   * // Later, to cancel all pending requests:
   * controller.abort();
   * ```
   */
  protected _controller: AbortController;

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
  protected _limit: number;

  /**
   * The products that are currently being built by the supplier.
   * This array holds ProductBuilder instances that are in the process
   * of being transformed into complete Product objects.
   *
   * @example
   * ```typescript
   * await supplier._queryProducts("acetone");
   * console.log(`Building ${supplier._products.length} products`);
   * for (const builder of supplier._products) {
   *   const product = await builder.build();
   *   console.log("Built product:", product.title);
   * }
   * ```
   */
  protected _products: ProductBuilder<T>[] = [];

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
   *     this._httpRequestHardLimit = 100; // Allow more requests
   *   }
   * }
   * ```
   */
  protected _httpRequestHardLimit: number = 50;

  /**
   * Counter for HTTP requests made during the current query execution.
   * This is used to track the number of requests and ensure we don't
   * exceed the _httpRequestHardLimit.
   *
   * @defaultValue 0
   * @example
   * ```typescript
   * await supplier._queryProducts("acetone");
   * console.log(`Made ${supplier._requestCount} requests`);
   * if (supplier._requestCount >= supplier._httpRequestHardLimit) {
   *   console.log("Reached request limit");
   * }
   * ```
   */
  protected _requestCount: number = 0;

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
   *     this._httpRequestBatchSize = 5;
   *   }
   * }
   * ```
   */
  protected _httpRequestBatchSize: number = 10;

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
   *     this._headers = {
   *       "Accept": "application/json",
   *       "User-Agent": "ChemCrawler/1.0"
   *     };
   *   }
   * }
   * ```
   */
  protected _headers: HeadersInit = {};

  // Logger for the supplier. This gets initialized in this constructor with the
  // name of the inheriting class.
  protected _logger: Logger;
  // Cache configuration
  private static readonly cacheKey = "supplier_cache";

  // Maximum number of cached results
  private static readonly cacheSize = 100;

  // Default values for products. These will get overridden if they're found in the product data.
  protected _productDefaults = {
    uom: "ea",
    quantity: 1,
    currencyCode: "USD",
    currencySymbol: "$",
  };

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
    this._logger = new Logger(this.constructor.name);
    this._query = query;
    this._limit = limit;
    if (controller) {
      this._controller = controller;
    } else {
      this._logger.debug("Made a new AbortController");
      this._controller = new AbortController();
    }
  }

  /**
   * This is a placeholder for any setup that needs to be done before the query is made.
   * @returns A promise that resolves when the setup is complete.
   */
  protected async _setup(): Promise<void> {}

  /**
   * Retrieves HTTP headers from a URL using a HEAD request.
   * Useful for checking content types, caching headers, and other metadata without downloading the full response.
   *
   * @param url - The URL to fetch headers from
   * @returns Promise resolving to the response headers or void if request fails
   * @example
   * ```typescript
   * const headers = await this._httpGetHeaders('https://example.com/product/123');
   * if (headers) {
   *   console.log('Content-Type:', headers['content-type']);
   *   console.log('Last-Modified:', headers['last-modified']);
   * }
   * ```
   */
  protected async _httpGetHeaders(url: string | URL): Promise<Maybe<HeadersInit>> {
    try {
      const requestObj = new Request(this._href(url), {
        signal: this._controller.signal,
        headers: new Headers(this._headers),
        referrer: this.baseURL,
        referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        method: "HEAD",
        mode: "cors",
        credentials: "include",
      });

      const httpResponse = await this._fetch(requestObj);

      return Object.fromEntries(httpResponse.headers.entries()) satisfies HeadersInit;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this._logger.warn("Request was aborted", { error, signal: this._controller.signal });
        this._controller.abort();
      } else {
        this._logger.error("Error received during fetch:", {
          error,
          signal: this._controller.signal,
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
   * const response = await this._httpPost({
   *   path: "/api/v1/products",
   *   body: { name: "Test Chemical" }
   * });
   *
   * // POST with custom host and params
   * const response = await this._httpPost({
   *   path: "/api/v1/products",
   *   host: "api.example.com",
   *   body: { name: "Test Chemical" },
   *   params: { version: "2" },
   *   headers: { "Content-Type": "application/json" }
   * });
   * ```
   */
  protected async _httpPost({
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
    const signal = this._controller.signal;
    const bodyStr = typeof body === "string" ? body : (JSON.stringify(body) ?? null);
    const headersObj = new Headers({
      ...this._headers,
      ...(headers as HeadersInit),
    });
    const url = this._href(path, params, host);

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
    const httpRequest = await this._fetch(requestObj);

    if (!isHttpResponse(httpRequest)) {
      const badResponse = await (httpRequest as unknown as Response)?.text();
      this._logger.error("Invalid POST response: ", badResponse);
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
   * const responseJSON = await this._httpPostJson({
   *    path: "/api/v1/products",
   *    body: { name: "John" },
   *    headers: { "Content-Type": "application/json" }
   * });
   * // Sends HTTP POST request to https://example.com/api/v1/products with `{"name":"John"}` body.
   * // Returns a JSON object.
   *
   * const responseJSON = await this._httpPostJson({
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
  protected async _httpPostJson({
    path,
    host,
    body,
    params,
    headers,
  }: RequestOptions): Promise<Maybe<JsonValue>> {
    const httpRequest = await this._httpPost({ path, host, body, params, headers });
    if (!isJsonResponse(httpRequest)) {
      throw new TypeError(`_httpPostJson| Invalid POST response: ${httpRequest}`);
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
   * const response = await this._httpGet({
   *   path: "/products/search",
   *   params: { query: "sodium chloride" }
   * });
   *
   * // GET with custom host and headers
   * const response = await this._httpGet({
   *   path: "/api/products",
   *   host: "api.example.com",
   *   params: { category: "chemicals" },
   *   headers: { "Accept": "application/json" }
   * });
   * ```
   */
  protected async _httpGet({
    path,
    params,
    headers,
    host,
  }: RequestOptions): Promise<Maybe<Response>> {
    try {
      // Check if the request has been aborted before proceeding
      if (this._controller.signal.aborted) {
        this._logger.warn("Request was aborted before fetch", {
          signal: this._controller.signal,
        });
        return;
      }

      const requestObj = new Request(this._href(path, params, host), {
        signal: this._controller.signal,
        headers: {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          ...this._headers,
          ...headers,
        },
        referrer: this.baseURL,
        referrerPolicy: "no-referrer",
        body: null,
        method: "GET",
        mode: "cors",
        credentials: "include",
      });

      // Fetch the goods
      const httpResponse = await this._fetch(requestObj.url, requestObj);
      //const httpResponse = await fetchDecorator(requestObj.url, requestObj);

      return httpResponse;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this._logger.warn("Request was aborted", { error, signal: this._controller.signal });
        this._controller.abort();
      } else {
        this._logger.error("Error received during fetch:", {
          error,
          signal: this._controller.signal,
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
   * const matches = this._fuzzyFilter("sodium chloride", products);
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
   * const strictMatches = this._fuzzyFilter("sodium chloride", products, 90);
   * // Returns only exact matches with score >= 90
   *
   * // Example with different data structure
   * const chemicals = [
   *   { name: "NaCl", formula: "Sodium Chloride" },
   *   { name: "NaOH", formula: "Sodium Hydroxide" }
   * ];
   *
   * // Override _titleSelector to use formula field
   * this._titleSelector = (data) => data.formula;
   * const formulaMatches = this._fuzzyFilter("sodium chloride", chemicals);
   * ```
   */
  protected _fuzzyFilter<X>(query: string, data: X[], cutoff: number = 40): X[] {
    const res = extract(query, data, {
      scorer: WRatio,
      processor: this._titleSelector as (choice: unknown) => string,
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

    this._logger.debug("fuzzed search results:", res);

    return res;
  }

  /**
   * Abstract method to select the title from the initial raw search data.
   * This method should be implemented by each supplier to handle their specific data structure.
   * The selected title is used by _fuzzyFilter for string similarity matching.
   *
   * @param data - The data object to extract the title from
   * @returns The title string to use for fuzzy matching
   * @abstract
   * @example
   * ```typescript
   * // Example implementation for a supplier with simple title field
   * protected _titleSelector(data: Cheerio<Element>): string {
   *   return data.text();
   * }
   *
   * // Example implementation for a supplier with nested title
   * protected _titleSelector(data: SupplierProduct): string {
   *   return data.productInfo.name;
   * }
   *
   * // Example implementation for a supplier with multiple possible title fields
   * protected _titleSelector(data: SupplierProduct): string {
   *   return data.displayName || data.productName || data.name || '';
   * }
   *
   * // Example implementation for a supplier with formatted title
   * protected _titleSelector(data: SupplierProduct): string {
   *   return `${data.name} ${data.grade} ${data.purity}`.trim();
   * }
   * ```
   */
  protected abstract _titleSelector(data: any): string;

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
   * const html = await this._httpGetHtml({
   *   path: "/api/products",
   *   params: { search: "sodium" }
   * });
   *
   * // GET request with custom headers
   * const html = await this._httpGetHtml({
   *   path: "/api/products",
   *   headers: {
   *     "Authorization": "Bearer token123",
   *     "Accept": "text/html"
   *   }
   * });
   *
   * // GET request with custom host
   * const html = await this._httpGetHtml({
   *   path: "/products",
   *   host: "api.supplier.com",
   *   params: { limit: 10 }
   * });
   * ```
   */
  protected async _httpGetHtml({
    path,
    params,
    headers,
    host,
  }: RequestOptions): Promise<Maybe<string>> {
    const httpResponse = await this._httpGet({ path, params, headers, host });
    if (!isHtmlResponse(httpResponse)) {
      throw new TypeError(`_httpGetHtml| Invalid GET response: ${httpResponse}`);
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
   * const data = await this._httpGetJson({
   *   path: "/api/products",
   *   params: { search: "sodium" }
   * });
   *
   * // GET request with custom headers
   * const data = await this._httpGetJson({
   *   path: "/api/products",
   *   headers: {
   *     "Authorization": "Bearer token123",
   *     "Accept": "application/json"
   *   }
   * });
   *
   * // GET request with custom host
   * const data = await this._httpGetJson({
   *   path: "/products",
   *   host: "api.supplier.com",
   *   params: { limit: 10 }
   * });
   *
   * // Error handling
   * try {
   *   const data = await this._httpGetJson({
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
  protected async _httpGetJson({
    path,
    params,
    headers,
    host,
  }: RequestOptions): Promise<Maybe<JsonValue>> {
    const _headers = new Headers({
      ...this._headers,
      ...(headers as HeadersInit),
    });
    const httpRequest = await this._httpGet({ path, params, headers: _headers, host });

    if (!isJsonResponse(httpRequest)) {
      const badResponse = await (httpRequest as unknown as Response)?.text();
      this._logger.error("Invalid HTTP GET response: ", badResponse);
      return;
    }

    return await httpRequest.json();
  }

  /**
   * Generates a cache key based on the query, limit, and supplier name.
   * Uses a combination of base64 encoding methods that work in both browser and Node environments.
   *
   * @returns A string hash that uniquely identifies this search request
   * @example
   * ```typescript
   * // Example with a basic search
   * const supplier = new MySupplier("sodium chloride", 5);
   * const key = supplier._generateCacheKey();
   * // Returns: "c29kaXVtIGNobG9yaWRlOjU6TXlTdXBwbGllcg=="
   *
   * // Example with empty values
   * const supplier = new MySupplier("", 0);
   * const key = supplier._generateCacheKey();
   * // Returns: "OjA6TXlTdXBwbGllcg=="
   *
   * // Example with special characters
   * const supplier = new MySupplier("NaCl (99.9%)", 10);
   * const key = supplier._generateCacheKey();
   * // Returns: "TmFDbCAoOTkuOSUpOjEwOk15U3VwcGxpZXI="
   * ```
   */
  private _generateCacheKey(): string {
    const data = `${this._query || ""}:${this._limit || 0}:${this.supplierName || ""}`;
    this._logger.debug("Generating cache key with:", {
      query: this._query,
      limit: this._limit,
      supplierName: this.supplierName,
      data,
    });
    try {
      // Try browser's btoa first
      const key = btoa(data);
      this._logger.debug("Generated cache key:", key);
      return key;
    } catch {
      try {
        // Fallback to Node's Buffer if available
        if (typeof Buffer !== "undefined") {
          const key = Buffer.from(data).toString("base64");
          this._logger.debug("Generated cache key (Buffer):", key);
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
        this._logger.debug("Generated cache key (hash):", key);
        return key;
      } catch (error) {
        this._logger.error("Error generating cache key:", error);
        // Fallback to a simple string if all else fails
        const key = data.replace(/[^a-zA-Z0-9]/g, "_");
        this._logger.debug("Generated cache key (fallback):", key);
        return key;
      }
    }
  }

  /**
   * Gets cached results for the current query if they exist.
   * Checks the Chrome storage for previously cached results using the generated cache key.
   * If found, updates the timestamp to mark it as recently used.
   *
   * @returns Promise resolving to the cached results array or undefined if not found
   * @example
   * ```typescript
   * // Example of retrieving cached results
   * const supplier = new MySupplier("sodium chloride", 5);
   * const cachedResults = await supplier._getCachedResults();
   * if (cachedResults) {
   *   console.log("Found cached results:", cachedResults.length);
   * } else {
   *   console.log("No cached results found");
   * }
   *
   * // Example of cache miss
   * const supplier = new MySupplier("unique query", 10);
   * const cachedResults = await supplier._getCachedResults();
   * // Returns: undefined
   * ```
   */
  private async _getCachedResults(): Promise<Maybe<T[]>> {
    try {
      const key = this._generateCacheKey();
      this._logger.debug("Looking up cache with key:", key);
      const result = await chrome.storage.local.get(SupplierBase.cacheKey);
      const cache =
        (result[SupplierBase.cacheKey] as Record<string, { data: T[]; timestamp: number }>) || {};
      const cached = cache[key];

      this._logger.debug("Cache lookup result:", {
        key,
        found: !!cached,
        cacheSize: Object.keys(cache).length,
        cacheKeys: Object.keys(cache),
      });

      if (cached) {
        // Update the timestamp to mark as recently used
        await this._updateCacheTimestamp(key);
        return cached.data;
      }
      return undefined;
    } catch (error) {
      this._logger.error("Error retrieving from cache:", error);
      return undefined;
    }
  }

  /**
   * Updates the timestamp for a cache entry to mark it as recently used.
   * This is part of the LRU (Least Recently Used) cache implementation.
   *
   * @param key - The cache key to update
   * @example
   * ```typescript
   * // Example of updating a cache entry timestamp
   * const supplier = new MySupplier("sodium chloride", 5);
   * const key = supplier._generateCacheKey();
   * await supplier._updateCacheTimestamp(key);
   *
   * // Example with error handling
   * try {
   *   await supplier._updateCacheTimestamp("invalid-key");
   * } catch (error) {
   *   console.error("Failed to update timestamp:", error);
   * }
   * ```
   */
  private async _updateCacheTimestamp(key: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(SupplierBase.cacheKey);
      const cache =
        (result[SupplierBase.cacheKey] as Record<string, { data: T[]; timestamp: number }>) || {};
      if (cache[key]) {
        cache[key].timestamp = Date.now();
        await chrome.storage.local.set({ [SupplierBase.cacheKey]: cache });
      }
    } catch (error) {
      this._logger.error("Error updating cache timestamp:", error);
    }
  }

  /**
   * Stores results in the cache, implementing LRU behavior.
   * If the cache is full, removes the oldest entry before adding the new one.
   * Each cache entry includes the data and a timestamp for LRU tracking.
   *
   * @param results - The array of results to cache
   * @example
   * ```typescript
   * // Example of caching results
   * const supplier = new MySupplier("sodium chloride", 5);
   * const results = [
   *   { title: "Sodium Chloride", price: 29.99, quantity: 500, uom: "g" },
   *   { title: "NaCl", price: 24.99, quantity: 1000, uom: "g" }
   * ];
   * await supplier._cacheResults(results);
   *
   * // Example of cache eviction
   * // If cache is full (100 entries), oldest entry will be removed
   * const manyResults = Array(5).fill({
   *   title: "Test Product",
   *   price: 19.99,
   *   quantity: 100,
   *   uom: "g"
   * });
   * await supplier._cacheResults(manyResults);
   *
   * // Example with error handling
   * try {
   *   await supplier._cacheResults(results);
   * } catch (error) {
   *   console.error("Failed to cache results:", error);
   * }
   * ```
   */
  private async _cacheResults(results: Product[]): Promise<void> {
    try {
      const key = this._generateCacheKey();
      this._logger.debug("Storing in cache with key:", key);
      const result = await chrome.storage.local.get(SupplierBase.cacheKey);
      const cache =
        (result[SupplierBase.cacheKey] as Record<string, { data: Product[]; timestamp: number }>) ||
        {};

      // If cache is full, remove oldest entry
      if (Object.keys(cache).length >= SupplierBase.cacheSize) {
        const oldestKey = Object.entries(cache).sort(
          ([, a], [, b]) => a.timestamp - b.timestamp,
        )[0][0];
        this._logger.debug("Removing oldest cache entry:", oldestKey);
        delete cache[oldestKey];
      }

      // Add new entry
      cache[key] = {
        data: results,
        timestamp: Date.now(),
      };

      this._logger.debug("Cache state after update:", {
        key,
        cacheSize: Object.keys(cache).length,
        cacheKeys: Object.keys(cache),
      });

      await chrome.storage.local.set({ [SupplierBase.cacheKey]: cache });
    } catch (error) {
      this._logger.error("Error storing in cache:", error);
    }
  }

  /**
   * The function asynchronously iterates over query results, retrieves product data, and yields valid
   * results.
   * @returns An async generator that yields valid results.
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<Product, void, unknown> {
    try {
      // Check cache first
      const cachedResults = await this._getCachedResults();
      console.log("[iterator]cachedResults", cachedResults);
      if (cachedResults) {
        this._logger.debug("Returning cached results");
        for (const result of cachedResults) {
          yield result;
        }
        return;
      }

      await this._setup();
      const results = await this._queryProducts(this._query, this._limit);

      if (typeof results === "undefined" || results.length === 0) {
        this._logger.debug(`No query results found`);
        return;
      }
      this._products = results;

      // Process results in batches to maintain controlled concurrency
      const allResults: Product[] = [];
      for (let i = 0; i < this._products.length; i += this._httpRequestBatchSize) {
        const batch = this._products.slice(i, i + this._httpRequestBatchSize);

        // Create promises for the current batch
        const batchPromises = batch.map((r: unknown) => {
          if (r instanceof ProductBuilder === false) {
            this._logger.error("Invalid product builder:", r);
            return Promise.reject(new Error("Invalid product builder"));
          }
          return this._getProductData(r as ProductBuilder<T>);
        });

        // Process batch results as they complete
        const batchResults = await Promise.allSettled(batchPromises);
        for (const result of batchResults) {
          if (this._controller.signal.aborted) throw this._controller.signal.reason;

          if (result.status === "rejected") {
            this._logger.error("Error found when yielding a product:", { result });
            continue;
          }

          try {
            if (typeof result.value === "undefined") {
              this._logger.warn("Product value was undefined", { result });
              continue;
            }

            const finishedProduct = await this._finishProduct(result.value as ProductBuilder<T>);

            if (finishedProduct) {
              allResults.push(finishedProduct);
              yield finishedProduct;
            }
          } catch (err) {
            this._logger.error("Error found when yielding a product:", { err });
            continue;
          }
        }
      }

      // Cache the results after processing all batches
      if (allResults.length > 0) {
        await this._cacheResults(allResults);
      }
    } catch (err) {
      if (this._controller.signal.aborted === true) {
        this._logger.warn("Search was aborted");
        return;
      }
      this._logger.error("ERROR in generator fn:", { err });
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
   * const finishedProduct = await this._finishProduct(builder);
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
   * const invalidProduct = await this._finishProduct(invalidBuilder);
   * if (!invalidProduct) {
   *   console.log("Failed to finalize product - missing required fields");
   * }
   * ```
   */
  protected async _finishProduct(product: ProductBuilder<Product>): Promise<Maybe<Product>> {
    if (!isMinimalProduct(product.dump())) {
      this._logger.warn("Unable to finish product - Minimum data not set", { product });
      return;
    }

    // Set the country and shipping scope of the supplier. Later these may change if they
    // have different restrictions on different products or countries.
    product.setSupplierCountry(this.country);
    product.setSupplierShipping(this.shipping);

    /*
    const title = product.get("title");
    if (title) {
      const fuzz = this._fuzzyFilter(this._query, [title], 2, 0.5);
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
   * this._href('/some/path')
   * // https://supplier_base_url.com/some/path
   *
   * this._href('https://supplier_base_url.com/some/path', null, 'another_host.com')
   * // https://another_host.com/some/path
   *
   * this._href('/some/path', { a: 'b', c: 'd' }, 'another_host.com')
   * // http://another_host.com/some/path?a=b&c=d
   *
   * this._href('https://supplier_base_url.com/some/path')
   * // https://supplier_base_url.com/some/path
   *
   * this._href(new URL('https://supplier_base_url.com/some/path'))
   * // https://supplier_base_url.com/some/path
   *
   * this._href('/some/path', { a: 'b', c: 'd' })
   * // https://supplier_base_url.com/some/path?a=b&c=d
   *
   * this._href('https://supplier_base_url.com/some/path', new URLSearchParams({ a: 'b', c: 'd' }))
   * // https://supplier_base_url.com/some/path?a=b&c=d
   * ```
   */
  protected _href(path: string | URL, params?: RequestParams, host?: string): string {
    let href: URL;

    if (typeof path === "string" && isFullURL(path)) {
      href = new URL(path);
    }

    href = new URL(path, this.baseURL);

    if (host) {
      href.host = host;
    }

    if (params && Object.keys(params).length > 0) {
      href.search = new URLSearchParams(params as Record<string, string>).toString();
    }

    return href.toString();
  }

  protected abstract _queryProducts(
    query: string,
    limit: number,
  ): Promise<ProductBuilder<T>[] | void>;

  protected abstract _getProductData(product: ProductBuilder<T>): Promise<ProductBuilder<T> | void>;

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
   * protected _initProductBuilders(products: SupplierProduct[]): ProductBuilder<Product>[] {
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
   * const builders = this._initProductBuilders(supplierProducts);
   * console.log("Created builders:", builders.length);
   * ```
   */
  protected abstract _initProductBuilders(products: MaybeArray<unknown>): ProductBuilder<T>[];

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
   *   const response = await this._fetch("https://api.supplier.com/products");
   *   if (isJsonResponse(response)) {
   *     const data = await response.json();
   *     console.log("Received data:", data);
   *   }
   * } catch (error) {
   *   console.error("Fetch failed:", error.message);
   * }
   *
   * // Example with custom headers and method
   * const response = await this._fetch("https://api.supplier.com/products", {
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
   *     const response = await this._fetch("https://api.supplier.com/products");
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
  protected async _fetch(...args: Parameters<typeof fetchDecorator>): Promise<Response> {
    const [input] = args;
    console.log(`Fetching: ${input}`);
    this._requestCount++;
    if (this._requestCount > this._httpRequestHardLimit) {
      this._logger.warn("Request count exceeded hard limit", { requestCount: this._requestCount });
      throw new Error("Request count exceeded hard limit");
    }
    const response = await fetchDecorator(...args);
    console.log(`Response Status: ${response.status}`);

    console.log("response hash:", response._requestHash);
    return response;
  }
}
