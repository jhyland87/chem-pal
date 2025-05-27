import { ProductBuilder } from "@/helpers/productBuilder";
import { getCachableResponse, isFullURL } from "@/helpers/request";
import { type Maybe, type MaybeArray, type Product } from "@/types";
import { type RequiredProductFields } from "@/types/product";
import { type RequestOptions, type RequestParams } from "@/types/request";
import { Logger } from "@/utils/Logger";

import { type JsonValue } from "type-fest";

/**
 * The base class for all suppliers.
 * @abstract
 * @category Supplier
 * @module SupplierBase
 * @typeParam S - the partial product
 * @typeParam T - The product type
 * @example
 * ```typescript
 * const supplier = new SupplierBase<Product>();
 * ```
 */
export default abstract class SupplierBase<S, T extends Product> implements AsyncIterable<T> {
  // The name of the supplier (used for display name, lists, etc)
  public abstract readonly supplierName: string;

  // The base URL for the supplier.
  protected abstract _baseURL: string;

  // String to query for (Product name, CAS, etc)
  protected _query: string;

  // If the products first require a query of a search page that gets iterated over,
  // those results are stored here
  protected _queryResults: Array<S> = [];

  // The base search params for the supplier. These are the params that are always included in the search.
  protected _baseSearchParams: Record<string, string | number> = {};

  // The AbortController interface represents a controller object that allows you to
  // abort one or more Web requests as and when desired.
  protected _controller: AbortController;

  // How many results to return for this query (This is not a limit on how many requests
  // can be made to a supplier for any given query).
  protected _limit: number;

  // The products that are being built by the supplier
  protected _products: ProductBuilder<T>[] = [];

  // This is a limit to how many queries can be sent to the supplier for any given query.
  protected _httpRequestHardLimit: number = 50;

  // Used to keep track of how many requests have been made to the supplier.
  protected _requestCount: number = 0;

  // If using async requests, this will determine how many of them to batch together (using
  // something like Promise.all()). This is to avoid overloading the users bandwidth and
  // to not flood the supplier with 100+ requests all at once.
  protected _httpRequestBatchSize: number = 10;

  // HTTP headers used as a basis for all queries.
  protected _headers: HeadersInit = {};

  // Logger for the supplier. This gets initialized in this constructor with the
  // name of the inheriting class.
  protected _logger: Logger;

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
  constructor(query: string, limit: number = 5, controller: AbortController) {
    this._logger = new Logger(this.constructor.name);
    this._query = query;
    this._limit = limit;
    if (controller) {
      this._controller = controller;
    } else {
      this._logger.debug("Made a new AbortController");
      this._controller = new AbortController();
    }

    this._preconnect();
  }

  /**
   * Establishes a connection to the supplier's base URL before making any requests.
   * This method can be used to perform any necessary setup or validation before querying products.
   *
   * @returns Promise resolving to void
   *
   * @example
   * ```typescript
   * // Example implementation in a supplier class
   * protected async _preconnect(): Promise<void> {
   *   try {
   *     // Attempt to fetch the homepage to verify connectivity
   *     const response = await this._fetch(this._baseURL);
   *     if (!this._isHtmlResponse(response)) {
   *       throw new Error("Invalid response from supplier homepage");
   *     }
   *
   *     // Check if the site is accessible
   *     const html = await response.text();
   *     if (!html.includes("Welcome to Supplier Site")) {
   *       throw new Error("Unexpected homepage content");
   *     }
   *
   *     this._logger.info("Successfully connected to supplier", {
   *       baseURL: this._baseURL
   *     });
   *   } catch (error) {
   *     this._logger.error("Failed to connect to supplier", {
   *       error,
   *       baseURL: this._baseURL
   *     });
   *     throw error;
   *   }
   * }
   *
   * // Example usage
   * try {
   *   await this._preconnect();
   *   console.log("Successfully connected to supplier");
   * } catch (error) {
   *   console.error("Failed to connect:", error.message);
   * }
   * ```
   */
  protected async _preconnect(): Promise<void> {
    // Default implementation does nothing
    return;
  }

  /**
   * This is a placeholder for any setup that needs to be done before the query is made.
   * @returns A promise that resolves when the setup is complete.
   */
  protected async _setup(): Promise<void> {}

  /**
   * Type guard to validate if a value is a valid Response object.
   * Checks for the presence of required Response properties and methods.
   *
   * @param value - The value to validate
   * @returns Type predicate indicating if the value is a valid Response object
   * @typeguard
   *
   * @example
   * ```typescript
   * // Example with a valid Response
   * const response = await fetch("https://api.supplier.com/products");
   * if (this._isResponse(response)) {
   *   console.log("Valid response:", response.status);
   * } else {
   *   console.log("Invalid response object");
   * }
   *
   * // Example with invalid values
   * const invalidValues = [
   *   null,
   *   undefined,
   *   {},
   *   { status: 200 }, // Missing required methods
   *   { ok: true, status: 200, statusText: "OK" } // Missing required methods
   * ];
   *
   * for (const value of invalidValues) {
   *   if (!this._isResponse(value)) {
   *     console.log("Invalid response:", value);
   *   }
   * }
   * ```
   */
  protected _isResponse(value: unknown): value is Response {
    return (
      value !== null &&
      typeof value === "object" &&
      "ok" in value &&
      "status" in value &&
      "statusText" in value &&
      typeof (value as Response).json === "function" &&
      typeof (value as Response).text === "function"
    );
  }

  /**
   * Type guard to validate if a Response object contains JSON content.
   * Checks the Content-Type header for JSON MIME types.
   *
   * @param response - The Response object to validate
   * @returns Type predicate indicating if the response contains JSON content
   * @typeguard
   *
   * @example
   * ```typescript
   * // Example with JSON response
   * const response = await fetch("https://api.supplier.com/products");
   * if (this._isJsonResponse(response)) {
   *   const data = await response.json();
   *   console.log("JSON data:", data);
   * } else {
   *   console.log("Not a JSON response");
   * }
   *
   * // Example with different content types
   * const responses = [
   *   new Response(JSON.stringify({ data: "json" }), {
   *     headers: { "Content-Type": "application/json" }
   *   }),
   *   new Response("<html>", {
   *     headers: { "Content-Type": "text/html" }
   *   }),
   *   new Response("text", {
   *     headers: { "Content-Type": "text/plain" }
   *   })
   * ];
   *
   * for (const response of responses) {
   *   if (this._isJsonResponse(response)) {
   *     console.log("JSON response:", response.headers.get("Content-Type"));
   *   } else {
   *     console.log("Non-JSON response:", response.headers.get("Content-Type"));
   *   }
   * }
   * ```
   */
  protected _isJsonResponse(response: Maybe<Response>): response is Response {
    if (!response) return false;
    const contentType = response.headers.get("Content-Type");
    return (
      contentType !== null &&
      (contentType.includes("application/json") || contentType.includes("text/json"))
    );
  }

  /**
   * Type guard to validate if a Response object contains HTML content.
   * Checks the Content-Type header for HTML MIME types.
   *
   * @param response - The Response object to validate
   * @returns Type predicate indicating if the response contains HTML content
   * @typeguard
   *
   * @example
   * ```typescript
   * // Example with HTML response
   * const response = await fetch("https://supplier.com/products");
   * if (this._isHtmlResponse(response)) {
   *   const html = await response.text();
   *   console.log("HTML content:", html);
   * } else {
   *   console.log("Not an HTML response");
   * }
   *
   * // Example with different content types
   * const responses = [
   *   new Response("<html>", {
   *     headers: { "Content-Type": "text/html" }
   *   }),
   *   new Response(JSON.stringify({ data: "json" }), {
   *     headers: { "Content-Type": "application/json" }
   *   }),
   *   new Response("text", {
   *     headers: { "Content-Type": "text/plain" }
   *   })
   * ];
   *
   * for (const response of responses) {
   *   if (this._isHtmlResponse(response)) {
   *     console.log("HTML response:", response.headers.get("Content-Type"));
   *   } else {
   *     console.log("Non-HTML response:", response.headers.get("Content-Type"));
   *   }
   * }
   * ```
   */
  protected _isHtmlResponse(response: Maybe<Response>): response is Response {
    if (!response) return false;
    const contentType = response.headers.get("Content-Type");
    return (
      contentType !== null &&
      (contentType.includes("text/html") || contentType.includes("application/xhtml+xml"))
    );
  }

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
        referrer: this._baseURL,
        referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        method: "HEAD",
        mode: "cors",
        credentials: "include",
      });

      const httpResponse = await fetch(requestObj);

      // @todo: Override this if not in development mode
      if (
        chrome.extension !== undefined &&
        process.env.MODE !== "development" &&
        httpResponse.headers.get("ismockedresponse") !== "true"
      ) {
        this._logger.debug("_httpGetHeaders| httpResponse:", httpResponse);
        this._logger.debug("_httpGetHeaders| process.env:", process.env);
        const cacheData = getCachableResponse(requestObj, httpResponse);
        this._logger.debug("_httpGetHeaders| cacheData:", cacheData);
      }

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
    const _headers = new Headers({
      ...this._headers,
      ...(headers as HeadersInit),
    });
    const requestObj = new Request(this._href(path, params, host), {
      signal: this._controller.signal,
      headers: _headers,
      referrer: this._baseURL,
      referrerPolicy: "strict-origin-when-cross-origin",
      body: typeof body === "string" ? body : JSON.stringify(body),
      method: "POST",
      mode: "cors",
    });

    // Fetch the goods
    const httpRequest = await fetch(requestObj);

    if (!this._isResponse(httpRequest)) {
      const badResponse = await (httpRequest as unknown as Response)?.text();
      this._logger.error("Invalid POST response: ", badResponse);
      throw new TypeError(`Invalid POST response: ${httpRequest}`);
    }

    // @todo: Override this if not in development mode
    if (
      chrome.extension !== undefined &&
      process.env.MODE !== "development" &&
      httpRequest.headers.get("ismockedresponse") !== "true"
    ) {
      this._logger.debug("_httpPost| httpRequest:", httpRequest);
      this._logger.debug("_httpPost| process.env:", process.env);
      const cacheData = getCachableResponse(requestObj, httpRequest);
      this._logger.debug("_httpPost| cacheData:", cacheData);
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
    if (!this._isJsonResponse(httpRequest)) {
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
        referrer: this._baseURL,
        referrerPolicy: "no-referrer",
        body: null,
        method: "GET",
        mode: "cors",
        credentials: "include",
      });

      // Fetch the goods
      const httpResponse = await fetch(requestObj);

      // @todo: Override this if not in development mode
      if (
        chrome.extension !== undefined &&
        process.env.MODE !== "development" &&
        httpResponse.headers.get("ismockedresponse") !== "true"
      ) {
        this._logger.debug("_httpGet| httpResponse:", httpResponse);
        this._logger.debug("_httpGet| process.env:", process.env);
        const cacheData = getCachableResponse(requestObj, httpResponse);
        this._logger.debug("_httpGet| cacheData:", cacheData);
      }

      return httpResponse as Response;
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
   * Sends a GET request to a URL and returns the response as HTML text.
   * Validates that the response has the correct content type before returning.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the HTML text content or void if request fails
   * @throws TypeError - If the response is not valid HTML content
   * @example
   * ```typescript
   * const html = await this._httpGetHtml({
   *   path: '/products/search',
   *   params: { query: 'sodium chloride' },
   *   headers: { 'Accept': 'text/html' }
   * });
   * if (html) {
   *   const $ = cheerio.load(html);
   *   const products = $('.product-item').map((i, el) => {
   *     return $(el).text();
   *   }).get();
   * }
   * ```
   */
  protected async _httpGetHtml({
    path,
    params,
    headers,
    host,
  }: RequestOptions): Promise<Maybe<string>> {
    const httpResponse = await this._httpGet({ path, params, headers, host });
    if (!this._isHtmlResponse(httpResponse)) {
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

    if (!this._isJsonResponse(httpRequest)) {
      const badResponse = await (httpRequest as unknown as Response)?.text();
      this._logger.error("Invalid HTTP GET response: ", badResponse);
      throw new TypeError("Invalid HTTP GET response");
    }

    return await httpRequest?.json();
  }

  /**
   * Type guard to validate if a value is a valid result object.
   * Checks for the presence of required result properties.
   *
   * @param value - The value to validate
   * @returns Type predicate indicating if the value is a valid result object
   * @typeguard
   *
   * @example
   * ```typescript
   * // Example with valid result
   * const result = {
   *   title: "Sodium Chloride",
   *   price: 29.99,
   *   quantity: 500,
   *   uom: "g",
   *   supplier: "ChemSupplier",
   *   url: "/products/nacl",
   *   currencyCode: "USD",
   *   currencySymbol: "$"
   * };
   *
   * if (this._isValidResult(result)) {
   *   console.log("Valid result:", result.title);
   * } else {
   *   console.log("Invalid result object");
   * }
   *
   * // Example with invalid values
   * const invalidValues = [
   *   null,
   *   undefined,
   *   {},
   *   { title: "Sodium Chloride" }, // Missing required fields
   *   {
   *     title: "Sodium Chloride",
   *     price: "29.99", // Wrong type for price
   *     quantity: 500,
   *     uom: "g",
   *     supplier: "ChemSupplier",
   *     url: "/products/nacl",
   *     currencyCode: "USD",
   *     currencySymbol: "$"
   *   }
   * ];
   *
   * for (const value of invalidValues) {
   *   if (!this._isValidResult(value)) {
   *     console.log("Invalid result:", value);
   *   }
   * }
   * ```
   */
  protected _isValidResult(value: unknown): value is RequiredProductFields {
    if (!value || typeof value !== "object") return false;

    const requiredProps: Record<keyof RequiredProductFields, string> = {
      title: "string",
      price: "number",
      quantity: "number",
      uom: "string",
      supplier: "string",
      url: "string",
      currencyCode: "string",
      currencySymbol: "string",
    };

    return Object.entries(requiredProps).every(([key, expectedType]) => {
      return key in value && typeof value[key as keyof typeof value] === expectedType;
    });
  }

  /**
   * The function asynchronously iterates over query results, retrieves product data, and yields valid
   * results.
   * @returns An async generator that yields valid results.
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    try {
      await this._setup();
      const results = await this._queryProducts(this._query, this._limit);

      if (typeof results === "undefined" || results.length === 0) {
        this._logger.debug(`No query results found`);
        return;
      }
      this._products = results;

      // Process results in batches to maintain controlled concurrency
      for (let i = 0; i < this._products.length; i += this._httpRequestBatchSize) {
        const batch = this._products.slice(i, i + this._httpRequestBatchSize);

        // Create promises for the current batch
        //const batchPromises = batch.map((r) => this._getProductData(r));
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
              yield finishedProduct;
            }
          } catch (err) {
            this._logger.error("Error found when yielding a product:", { err });
            continue;
          }
        }
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
   * Type guard to validate if a value is a complete Product object.
   * Checks for the presence and correct types of all required product fields.
   * This is a stricter validation than _isMinimalProduct as it ensures all required fields are present.
   *
   * @param product - The value to validate
   * @returns Type predicate indicating if the value is a complete Product object
   * @typeguard
   *
   * @example
   * ```typescript
   * const completeProduct = {
   *   title: "Sodium Chloride",
   *   price: 29.99,
   *   quantity: 500,
   *   uom: "g",
   *   supplier: "ChemSupplier",
   *   url: "/products/nacl",
   *   currencyCode: "USD",
   *   currencySymbol: "$",
   *   description: "High purity sodium chloride",
   *   cas: "7647-14-5"
   * };
   *
   * if (this._isProduct(completeProduct)) {
   *   console.log('Valid complete product:', completeProduct.title);
   * } else {
   *   console.log('Invalid product object');
   * }
   *
   * // Example with missing required fields
   * const partialProduct = {
   *   title: "Sodium Chloride",
   *   price: 29.99
   *   // Missing required fields
   * };
   * if (!this._isProduct(partialProduct)) {
   *   console.log('Invalid product - missing required fields');
   * }
   * ```
   */
  protected _isProduct(product: unknown): product is Product {
    if (typeof product !== "object" || product === null) {
      this._logger.debug("Invalid product object", { product });
      return false;
    }

    const requiredProps: Record<keyof RequiredProductFields, string> = {
      title: "string",
      price: "number",
      quantity: "number",
      uom: "string",
      supplier: "string",
      url: "string",
      currencyCode: "string",
      currencySymbol: "string",
    };

    return Object.entries(requiredProps).every(([key, expectedType]) => {
      if (key in product === false) {
        this._logger.debug("Missing required property", { key, product });
        return false;
      }

      if (typeof product[key as keyof typeof product] !== expectedType) {
        this._logger.debug("Invalid property type", { key, expectedType, product });
        return false;
      }

      return true;
    });
  }

  /**
   * Type guard to validate if a value has the minimal required properties of a Product.
   * This is a less strict validation than _isProduct as it only checks for the minimum required fields.
   * Useful for validating partial product data during construction.
   *
   * @param product - The value to validate
   * @returns Type predicate indicating if the value has minimal required product properties
   * @typeguard
   *
   * @example
   * ```typescript
   * const minimalProduct = {
   *   title: "Sodium Chloride",
   *   price: 29.99,
   *   quantity: 500,
   *   uom: "g",
   *   supplier: "ChemSupplier",
   *   url: "/products/nacl",
   *   currencyCode: "USD",
   *   currencySymbol: "$"
   * };
   *
   * if (this._isMinimalProduct(minimalProduct)) {
   *   console.log('Valid minimal product:', minimalProduct.title);
   * } else {
   *   console.log('Invalid minimal product');
   * }
   *
   * // Example with missing required fields
   * const invalidProduct = {
   *   title: "Sodium Chloride",
   *   price: 29.99,
   *   quantity: 500
   *   // Missing other required fields
   * };
   * if (!this._isMinimalProduct(invalidProduct)) {
   *   console.log('Invalid minimal product - missing required fields');
   * }
   * ```
   */
  protected _isMinimalProduct(product: unknown): product is RequiredProductFields {
    if (!product || typeof product !== "object") return false;

    const requiredProps: Record<keyof RequiredProductFields, string> = {
      title: "string",
      price: "number",
      quantity: "number",
      uom: "string",
      supplier: "string",
      url: "string",
      currencyCode: "string",
      currencySymbol: "string",
    };

    return Object.entries(requiredProps).every(([key, expectedType]) => {
      return key in product && typeof product[key as keyof typeof product] === expectedType;
    });
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
   * const builder = new ProductBuilder<Product>(this._baseURL);
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
   * const invalidBuilder = new ProductBuilder<Product>(this._baseURL);
   * invalidBuilder.setBasicInfo("Sodium Chloride", "/products/nacl", "ChemSupplier");
   * // Missing required fields
   *
   * const invalidProduct = await this._finishProduct(invalidBuilder);
   * if (!invalidProduct) {
   *   console.log("Failed to finalize product - missing required fields");
   * }
   * ```
   */
  protected async _finishProduct(product: ProductBuilder<T>): Promise<Maybe<T>> {
    if (!this._isMinimalProduct(product.dump())) {
      this._logger.warn("Unable to finish product - Minimum data not set", { product });
      return;
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

    href = new URL(path, this._baseURL);

    if (host) {
      href.host = host;
    }

    if (params && Object.keys(params).length > 0) {
      href.search = new URLSearchParams(params as Record<string, string>).toString();
    }

    return href.toString();
  }

  /**
   * Abstract method to query products from a supplier's search endpoint.
   * This method should be implemented by each supplier to handle their specific search API or page structure.
   *
   * @param query - The search query string to find products
   * @param limit - The maximum number of products to return
   * @returns Promise resolving to an array of ProductBuilder instances or void if the query fails
   *
   * @example
   * ```typescript
   * // Example implementation in a supplier class
   * protected async _queryProducts(query: string, limit: number): Promise<ProductBuilder<Product>[] | void> {
   *   try {
   *     // Construct the search URL
   *     const searchUrl = `${this._baseURL}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
   *
   *     // Fetch the search results
   *     const response = await this._fetch(searchUrl);
   *     if (!this._isHtmlResponse(response)) {
   *       this._logger.warn("Invalid response type for search results", { url: searchUrl });
   *       return;
   *     }
   *
   *     // Parse the HTML content
   *     const html = await response.text();
   *     const $ = cheerio.load(html);
   *
   *     // Extract product listings
   *     const products: ProductBuilder<Product>[] = [];
   *     $('.product-listing').each((_, element) => {
   *       const builder = new ProductBuilder<Product>(this._baseURL);
   *
   *       // Extract basic product information
   *       const title = $(element).find('.product-title').text().trim();
   *       const url = $(element).find('a').attr('href') || '';
   *       const price = parseFloat($(element).find('.price').text().replace(/[^0-9.]/g, ''));
   *       const quantity = parseInt($(element).find('.quantity').text().replace(/[^0-9]/g, ''));
   *       const uom = $(element).find('.uom').text().trim();
   *
   *       // Set the basic information
   *       builder
   *         .setBasicInfo(title, url, this.supplierName)
   *         .setPricing(price, "USD", "$")
   *         .setQuantity(quantity, uom);
   *
   *       products.push(builder);
   *     });
   *
   *     return products;
   *   } catch (error) {
   *     this._logger.error("Error querying products", {
   *       error,
   *       query
   *     });
   *     return;
   *   }
   * }
   * ```
   */
  protected abstract _queryProducts(
    query: string,
    limit: number,
  ): Promise<ProductBuilder<T>[] | void>;

  /**
   * Abstract method to fetch and process detailed product data from a product page.
   * This method should be implemented by each supplier to handle their specific product page structure.
   *
   * @param product - The ProductBuilder instance containing basic product information
   * @returns Promise resolving to a complete Product object or void if processing fails
   *
   * @example
   * ```typescript
   * // Example implementation in a supplier class
   * protected async _getProductData(product: ProductBuilder<Product>): Promise<Maybe<Product>> {
   *   try {
   *     // Fetch the product page
   *     const response = await this._fetch(product.dump().url);
   *     if (!this._isHtmlResponse(response)) {
   *       this._logger.warn("Invalid response type for product page", { url: product.dump().url });
   *       return;
   *     }
   *
   *     // Parse the HTML content
   *     const html = await response.text();
   *     const $ = cheerio.load(html);
   *
   *     // Extract additional product details
   *     const description = $('.product-description').text().trim();
   *     const cas = $('.cas-number').text().trim();
   *
   *     // Update the product builder with new information
   *     product
   *       .setDescription(description)
   *       .setCas(cas);
   *
   *     // Finalize the product
   *     return await this._finishProduct(product);
   *   } catch (error) {
   *     this._logger.error("Error fetching product data", {
   *       error,
   *       url: product.dump().url
   *     });
   *     return;
   *   }
   * }
   * ```
   */
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
   *     const builder = new ProductBuilder<Product>(this._baseURL);
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
   * @param url - The URL to fetch
   * @param init - Optional fetch configuration (headers, method, etc.)
   * @returns Promise resolving to a Response object
   * @throws Error if the request fails or exceeds retry attempts
   *
   * @example
   * ```typescript
   * // Example usage with basic GET request
   * try {
   *   const response = await this._fetch("https://api.supplier.com/products");
   *   if (this._isJsonResponse(response)) {
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
  protected async _fetch(url: string, init?: RequestInit): Promise<Response> {
    if (this._requestCount >= this._limit) {
      throw new Error("Request limit exceeded");
    }

    this._requestCount++;

    try {
      const response = await fetch(url, {
        ...init,
        signal: this._controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      this._logger.error("Fetch failed", { error, url });
      throw error;
    }
  }
}
