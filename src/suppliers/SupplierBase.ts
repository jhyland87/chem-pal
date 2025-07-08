/* eslint-disable @typescript-eslint/no-explicit-any */
import { stripQuantityFromString } from "@/helpers/quantity";
import { fetchDecorator, isFullURL } from "@/helpers/request";
import Logger from "@/utils/Logger";
import ProductBuilder from "@/utils/ProductBuilder";
import SupplierCache from "@/utils/SupplierCache";
import {
  isHtmlResponse,
  isHttpResponse,
  isJsonResponse,
  isMinimalProduct,
} from "@/utils/typeGuards/common";
import { Queue } from "async-await-queue";
import { extract, WRatio } from "fuzzball";
import { type JsonValue } from "type-fest";

/**
 * Metadata about cached results including timestamp and version information.
 * This helps determine if cached data is stale or needs to be refreshed.
 */
export interface CacheMetadata {
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
export interface CachedData<T> {
  /** The actual cached results */
  data: T[];
  /** Metadata about the cache entry */
  // eslint-disable-next-line @typescript-eslint/naming-convention
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
export default abstract class SupplierBase<S, T extends Product> implements ISupplier {
  // The name of the supplier (used for display name, lists, etc)
  public abstract readonly supplierName: string;

  // The base URL for the supplier.
  public abstract readonly baseURL: string;

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
   * The payment methods accepted by the supplier.
   * This is used to determine the payment methods accepted by the supplier.
   */
  public abstract readonly paymentMethods: PaymentMethod[];

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
   *     this.maxConcurrentRequests = 5;
   *   }
   * }
   * ```
   */
  protected maxConcurrentRequests: number = 3;

  /**
   * Minimum number of milliseconds between two consecutive tasks
   */
  protected minConcurrentCycle: number = 100;

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
   *       "User-Agent": "ChemPal/1.0"
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
  // eslint-disable-next-line @typescript-eslint/naming-convention
  private static readonly CACHE_VERSION = 1;

  // Cache instance for this supplier
  protected cache!: SupplierCache;

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
  public constructor(query: string, limit: number = 5, controller?: AbortController) {
    // Initialize required properties
    this.query = query;
    this.limit = limit;
    this.controller = controller ?? new AbortController();
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Initializes the cache for the supplier.
   * This is called after construction to ensure supplierName is set.
   *
   * @remarks
   * The cache is initialized with the supplier's name and is used to store
   * both query results and product data. This method should be called after
   * the supplier's name is set to ensure proper cache key generation.
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBase<Product> {
   *   constructor() {
   *     super("acetone", 5);
   *     // supplierName is set here
   *     this.initCache(); // Initialize cache after supplierName is set
   *   }
   * }
   * ```
   */
  public initCache(): void {
    this.cache = new SupplierCache(this.supplierName);
  }

  /**
   * Placeholder for any setup that needs to be done before the query is made.
   * Override this in subclasses if you need to perform setup (e.g., authentication, token fetching).
   *
   * @returns A promise that resolves when the setup is complete.
   *
   * @example
   * ```typescript
   * await supplier.setup();
   * ```
   */
  protected async setup(): Promise<void> {}

  /**
   * Retrieves HTTP headers from a URL using a HEAD request.
   * Useful for checking content types, caching headers, and other metadata without downloading the full response.
   *
   * @param url - The URL to fetch headers from
   * @returns Promise resolving to the response headers or void if request fails
   *
   * @example
   * ```typescript
   * // Basic usage
   * const headers = await supplier.httpGetHeaders('https://example.com/product/123');
   * if (headers) {
   *   console.log('Content-Type:', headers['content-type']);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // With error handling
   * try {
   *   const headers = await supplier.httpGetHeaders('https://example.com/product/123');
   *   if (headers) {
   *     console.log('Headers:', headers);
   *   }
   * } catch (err) {
   *   console.error('Failed to fetch headers:', err);
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
   *
   * @example
   * ```typescript
   * // Basic POST request
   * const response = await supplier.httpPost({
   *   path: '/api/v1/products',
   *   body: { name: 'Test Chemical' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // POST with custom headers
   * const response = await supplier.httpPost({
   *   path: '/api/v1/products',
   *   body: { name: 'Test Chemical' },
   *   headers: {
   *     'Authorization': 'Bearer token123',
   *     'Content-Type': 'application/json'
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // POST with custom host and params
   * const response = await supplier.httpPost({
   *   path: '/api/v1/products',
   *   host: 'api.example.com',
   *   body: { name: 'Test Chemical' },
   *   params: { version: '2' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Error handling
   * try {
   *   const response = await supplier.httpPost({ path: '/api/v1/products', body: { name: 'Test' } });
   *   if (response && response.ok) {
   *     const data = await response.json();
   *     console.log('Created:', data);
   *   }
   * } catch (err) {
   *   console.error('POST failed:', err);
   * }
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
   * Sends a POST request and returns the response as a JSON object.
   *
   * @param params - The parameters for the POST request.
   * @returns The response from the POST request as a JSON object.
   *
   * @example
   * ```typescript
   * // Basic usage
   * const data = await supplier.httpPostJson({
   *   path: '/api/v1/products',
   *   body: { name: 'John' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // With custom headers and error handling
   * try {
   *   const data = await supplier.httpPostJson({
   *     path: '/api/v1/products',
   *     body: { name: 'John' },
   *     headers: { 'Authorization': 'Bearer token123' }
   *   });
   *   if (data) {
   *     console.log('Created:', data);
   *   }
   * } catch (err) {
   *   console.error('POST JSON failed:', err);
   * }
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
   * Sends a POST request and returns the response as a HTML string.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the HTML response as a string or void if request fails
   * @throws TypeError - If the response is not valid HTML content
   *
   * @example
   * ```typescript
   * // Basic usage
   * const html = await supplier.httpPostHtml({
   *   path: '/api/v1/products',
   *   body: { name: 'John' }
   * });
   * ```
   */
  protected async httpPostHtml({
    path,
    host,
    body,
    params,
    headers,
  }: RequestOptions): Promise<Maybe<string>> {
    const httpRequest = await this.httpPost({ path, host, body, params, headers });
    if (!isHtmlResponse(httpRequest)) {
      throw new TypeError(`httpPostHtml| Invalid POST response: ${httpRequest}`);
    }
    return await httpRequest.text();
  }

  /**
   * Sends a GET request to the given URL with the specified options.
   * Handles request setup, error handling, and response caching.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the Response object or void if request fails
   *
   * @example
   * ```typescript
   * // Basic GET request
   * const response = await supplier.httpGet({
   *   path: '/products/search',
   *   params: { query: 'sodium chloride' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // GET with custom headers
   * const response = await supplier.httpGet({
   *   path: '/products/search',
   *   headers: { 'Accept': 'application/json' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // GET with custom host
   * const response = await supplier.httpGet({
   *   path: '/products/search',
   *   host: 'api.example.com',
   *   params: { category: 'chemicals' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Error handling
   * try {
   *   const response = await supplier.httpGet({ path: '/products/search' });
   *   if (response && response.ok) {
   *     const data = await response.json();
   *     console.log('Products:', data);
   *   }
   * } catch (err) {
   *   console.error('GET failed:', err);
   * }
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
        redirect: "follow",
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
   * //     _fuzz: { score: 100, idx: 0 }
   * //   },
   * //   {
   * //     title: "Sodium Hydroxide",
   * //     price: 39.99,
   * //     _fuzz: { score: 85, idx: 1 }
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
        acc[idx] = Object.assign(obj, { _fuzz: { score, idx }, matchPercentage: score });
        return acc;
      },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      [] as Array<X & { _fuzz: { score: number; idx: number }; matchPercentage: number }>,
    ) as X[];

    this.logger.debug("fuzzed search results:", res);

    // Get rid of any empty items that didn't match closely enough
    return res.filter((item) => !!item);
  }

  /**
   * Abstract method to select the title from the initial raw search data.
   * This method should be implemented by each supplier to handle their specific data structure.
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
  protected abstract titleSelector(data: any): Maybe<string>;

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
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the parsed JSON response or void if request fails
   * @throws TypeError - If the response is not valid JSON content
   *
   * @example
   * ```typescript
   * // Basic GET request
   * const data = await supplier.httpGetJson({ path: '/api/products', params: { search: 'sodium' } });
   * ```
   *
   * @example
   * ```typescript
   * // GET request with custom headers
   * const data = await supplier.httpGetJson({
   *   path: '/api/products',
   *   headers: {
   *     'Authorization': 'Bearer token123',
   *     'Accept': 'application/json'
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // GET request with custom host
   * const data = await supplier.httpGetJson({
   *   path: '/products',
   *   host: 'api.supplier.com',
   *   params: { limit: 10 }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Error handling
   * try {
   *   const data = await supplier.httpGetJson({ path: '/api/products' });
   *   if (data) {
   *     console.log('Products:', data);
   *   }
   * } catch (error) {
   *   console.error('Failed to fetch products:', error);
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
   * Executes a product search query with caching support.
   * First checks the cache for existing results, then falls back to the actual query if needed.
   * The limit parameter is only used for the actual query and doesn't affect caching.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to return (defaults to instance limit)
   * @returns Promise resolving to array of product builders or void if search fails
   *
   * @example
   * ```typescript
   * // Basic usage with default limit
   * const results = await supplier.queryProductsWithCache("acetone");
   * if (results) {
   *   console.log(`Found ${results.length} products`);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // With custom limit
   * const results = await supplier.queryProductsWithCache("acetone", 10);
   * if (results) {
   *   for (const builder of results) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price);
   *   }
   * }
   * ```
   */
  protected async queryProductsWithCache(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<T>[] | void> {
    // Check cache first (processed product data)
    const key = this.cache.generateCacheKey(query, this.supplierName);
    const result = await chrome.storage.local.get(SupplierCache.getQueryCacheKey());
    const cache =
      (result[SupplierCache.getQueryCacheKey()] as Record<string, CachedData<unknown>>) || {};
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
        await chrome.storage.local.set({ [SupplierCache.getQueryCacheKey()]: cache });
      } else {
        this.logger.debug("Returning cached query results");
        // Re-initialize product builders from cached processed data
        return ProductBuilder.createFromCache<T>(this.baseURL, cached.data.slice(0, limit));
      }
    }

    // If not in cache, perform the actual query
    const results = await this.queryProducts(query, limit);
    if (results) {
      // Store processed results in cache (dumped/serialized form) and the limit used
      await this.cache.cacheQueryResults(
        query,
        this.supplierName,
        results.map((b) => b.dump()),
        limit,
      );
    }
    return results;
  }

  /**
   * Executes the supplier's search query and returns the results.
   * This method will execute all results concurrently (to the limits set in the supplier
   * class), and resolve to an array of product objects.
   *
   * @remarks
   * This method is used to execute the supplier's search query and return the results.
   * @returns Promise resolving to an array of products
   */
  public async *execute(): AsyncGenerator<T, void, undefined> {
    await this.setup();
    const results = await this.queryProductsWithCache(this.query, this.limit);
    if (!results || results.length === 0) {
      this.logger.debug(`No query results found`);
      return;
    }
    this.products = results;
    const queue = new Queue(this.maxConcurrentRequests, this.minConcurrentCycle);

    // Create an array of promises, each yielding a product as soon as it's ready
    const tasks = this.products.map((product) =>
      queue.run(async () => {
        try {
          const builder = await this.getProductData(product);
          if (!builder) return;
          const finished = await this.finishProduct(builder);
          if (finished) {
            return finished;
          }
        } catch (e) {
          this.logger.error("Error processing product", { error: e, product });
        }
      }),
    );

    // As each promise resolves, yield the product
    const resultsSet = new Set(tasks);
    while (resultsSet.size > 0) {
      const finished = await Promise.race(resultsSet);
      // Remove the finished promise from the set
      for (const t of resultsSet) {
        if ((await Promise.resolve(t)) === finished) {
          resultsSet.delete(t);
          break;
        }
      }
      if (finished) {
        yield finished as unknown as T;
      }
    }
  }

  /**
   * Abstract method that must be implemented by supplier classes to perform the actual product search.
   * This is the core method that each supplier implements to query their specific API or website.
   *
   * @remarks
   * The implementation should:
   * 1. Make the necessary HTTP requests to the supplier's API/website
   * 2. Parse the response into initial product data
   * 3. Create ProductBuilder instances for each result
   * 4. Set basic product information (title, URL, etc.)
   *
   * The method should not fetch detailed product data - that is handled by getProductData.
   *
   * @todo Whats the difference between this and the finish method? Forgot why I created the other.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to return
   * @returns Promise resolving to array of ProductBuilder instances or void if search fails
   *
   * @example
   * ```typescript
   * // Example implementation for a JSON API supplier
   * protected async queryProducts(
   *   query: string,
   *   limit: number
   * ): Promise<ProductBuilder<Product>[] | void> {
   *   const response = await this.httpGetJson({
   *     path: '/api/search',
   *     params: {
   *       q: query,
   *       limit,
   *       format: 'json'
   *     }
   *   });
   *
   *   if (!response?.items) return;
   *
   *   return response.items.map(item => {
   *     const builder = new ProductBuilder<Product>(this.baseURL);
   *     builder
   *       .setBasicInfo(item.title, item.url, this.supplierName)
   *       .setPricing(item.price, item.currency)
   *       .setQuantity(item.quantity, item.uom);
   *     return builder;
   *   });
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Example implementation for an HTML scraping supplier
   * protected async queryProducts(
   *   query: string,
   *   limit: number
   * ): Promise<ProductBuilder<Product>[] | void> {
   *   const html = await this.httpGetHtml({
   *     path: '/search',
   *     params: { q: query }
   *   });
   *
   *   if (!html) return;
   *
   *   const $ = cheerio.load(html);
   *   const products: ProductBuilder<Product>[] = [];
   *
   *   $('.product-item').each((_, el) => {
   *     if (products.length >= limit) return false;
   *
   *     const $el = $(el);
   *     const builder = new ProductBuilder<Product>(this.baseURL);
   *     builder
   *       .setBasicInfo(
   *         $el.find('.title').text(),
   *         $el.find('a').attr('href'),
   *         this.supplierName
   *       )
   *       .setPricing(
   *         $el.find('.price').text()
   *       );
   *     products.push(builder);
   *   });
   *
   *   return products;
   * }
   * ```
   */
  protected abstract queryProducts(
    query: string,
    limit: number,
  ): Promise<ProductBuilder<T>[] | void>;

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

    // Set the country and shipping scope of the supplier
    // have different restrictions on different products or countries.
    product.setSupplierCountry(this.country);
    product.setSupplierShipping(this.shipping);

    if (this.paymentMethods.length > 0) {
      product.setSupplierPaymentMethods(this.paymentMethods);
    }

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

  /**
   * Retrieves detailed product data for a given product builder.
   * Handles caching of product data and fetches fresh data if not cached.
   *
   * @param product - The ProductBuilder instance to get data for
   * @returns Promise resolving to the updated ProductBuilder or void if fetch fails
   *
   * @example
   * ```typescript
   * const builder = new ProductBuilder<Product>(this.baseURL);
   * builder.setBasicInfo("Acetone", "/products/acetone", "ChemSupplier");
   *
   * const updatedBuilder = await supplier.getProductData(builder);
   * if (updatedBuilder) {
   *   const product = await updatedBuilder.build();
   *   console.log("Product details:", product);
   * }
   * ```
   */
  protected async getProductData(product: ProductBuilder<T>): Promise<ProductBuilder<T> | void> {
    const url = product.get("url");
    if (typeof url !== "string") {
      this.logger.error("Invalid URL in product:", { url });
      return undefined;
    }
    const cacheKey = this.cache.getProductDataCacheKey(url, this.supplierName);
    console.log("[SupplierBase] Product detail cache key:", cacheKey, "for url:", url);
    try {
      const cachedData = await this.cache.getCachedProductData(cacheKey);
      if (cachedData) {
        product.setData(cachedData as Partial<T>);
        return product;
      }
      // Cache miss: call fetcher
      let resultBuilder: ProductBuilder<T> | void = undefined;
      try {
        resultBuilder = await this.getProductDataWithCache(product, this.getProductData, {});
      } catch (err) {
        this.logger.error("Error in product detail fetcher:", err);
        return undefined;
      }
      if (resultBuilder) {
        await this.cache.cacheProductData(cacheKey, resultBuilder.dump());
      }
      return resultBuilder;
    } catch (outerErr) {
      this.logger.error("Error in getProductDataWithCache:", outerErr);
      return undefined;
    }
  }

  /**
   * Retrieves product data with caching support.
   * Similar to getProductData but allows for additional parameters to be included in the cache key.
   *
   * @param product - The ProductBuilder instance to get data for
   * @param fetcher - The function to use for fetching product data
   * @param params - Optional parameters to include in the cache key
   * @returns Promise resolving to the updated ProductBuilder or void if fetch fails
   *
   * @example
   * ```typescript
   * const builder = new ProductBuilder<Product>(this.baseURL);
   * builder.setBasicInfo("Acetone", "/products/acetone", "ChemSupplier");
   *
   * // Use custom fetcher with additional params
   * const updatedBuilder = await supplier.getProductDataWithCache(
   *   builder,
   *   async (b) => {
   *     // Custom fetching logic
   *     return b;
   *   },
   *   { version: "2.0" }
   * );
   * ```
   */
  protected async getProductDataWithCache(
    product: ProductBuilder<T>,
    fetcher: (builder: ProductBuilder<T>) => Promise<ProductBuilder<T> | void>,
    params?: Record<string, string>,
  ): Promise<ProductBuilder<T> | void> {
    const url = product.get("url");
    if (typeof url !== "string") {
      this.logger.error("Invalid URL in product:", { url });
      return undefined;
    }
    const cacheKey = this.cache.getProductDataCacheKey(url, this.supplierName, params);
    console.log("[SupplierBase] Product detail cache key:", cacheKey, "for url:", url);
    try {
      const cachedData = await this.cache.getCachedProductData(cacheKey);
      if (cachedData) {
        product.setData(cachedData as Partial<T>);
        return product;
      }
      // Cache miss: call fetcher
      let resultBuilder: ProductBuilder<T> | void = undefined;
      try {
        resultBuilder = await fetcher(product);
      } catch (err) {
        this.logger.error("Error in product detail fetcher:", err);
        return undefined;
      }
      if (resultBuilder) {
        await this.cache.cacheProductData(cacheKey, resultBuilder.dump());
      }
      return resultBuilder;
    } catch (outerErr) {
      this.logger.error("Error in getProductDataWithCache:", outerErr);
      return undefined;
    }
  }

  /**
   * Groups variants of a product by their title
   * @param data - Array of product listings from search results
   * @returns Array of product listings with grouped variants
   * @todo Create a generic method for this, the same method is used in
   *       Synthetika and could be of use with LoudWolf.
   * @example
   * ```typescript
   * const results = await this.queryProducts("sodium chloride");
   * const grouped = this.groupVariants(results);
   * // grouped is an array of product listings with grouped variants
   * ```
   */
  protected groupVariants<R>(data: R[]): R[] {
    type SubType = R & { groupId: string; variants?: R[] };
    const variants: SubType[] = data
      .map((item) => {
        const title = this.titleSelector(item);
        if (!title) {
          this.logger.error("No title found in product:", { item });
          return undefined;
        }
        const groupId = stripQuantityFromString(title.replace(/(?<=\d{1,3})\s(?=\d{3})/g, ""));
        const groupIdWithoutSpaces = groupId.replace(/[\s-]/g, "");
        return { ...item, groupId: groupIdWithoutSpaces };
      })
      .filter((item): item is SubType => item !== undefined);

    const products = Object.groupBy(variants, (item) => item.groupId);

    return Object.values(products)
      .filter((product): product is SubType[] => product !== undefined)
      .map((product) => {
        const main = product.splice(0, 1)[0];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { groupId, ...newObject } = main;
        newObject.variants = product as unknown as SubType["variants"];

        return newObject;
      })
      .filter((item): item is SubType => item !== undefined);
  }

  /**
   * Internal fetch method with request counting and decorator.
   * Tracks request count and enforces hard limits on HTTP requests.
   *
   * @param args - Arguments to pass to fetchDecorator (usually a Request or URL and options)
   * @returns The response from the fetchDecorator
   * @throws Error if request count exceeds hard limit
   *
   * @example
   * ```typescript
   * // Example usage inside a subclass:
   * const response = await this.fetch(new Request('https://example.com'));
   * if (response.ok) {
   *   const data = await response.json();
   *   console.log(data);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // With custom request options
   * const response = await this.fetch(
   *   new Request('https://example.com', {
   *     headers: { 'Accept': 'application/json' }
   *   })
   * );
   * ```
   */
  protected async fetch(...args: Parameters<typeof fetchDecorator>): Promise<any> {
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
}
