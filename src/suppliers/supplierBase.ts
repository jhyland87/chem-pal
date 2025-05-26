import { ProductBuilder } from "@/helpers/productBuilder";
import { getCachableResponse, isFullURL } from "@/helpers/request";
import { type HTMLResponse, type Maybe, type Product } from "@/types";
import { type OptionalProductFields, type RequiredProductFields } from "@/types/product";
import { type RequestOptions, type RequestParams } from "@/types/request";
import { Logger } from "@/utils/Logger";
import * as contentType from "content-type";

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
  protected _httpRequstCount: number = 0;

  // If using async requests, this will determine how many of them to batch together (using
  // something like Promise.all()). This is to avoid overloading the users bandwidth and
  // to not flood the supplier with 100+ requests all at once.
  protected _httpRequestBatchSize: number = 10;

  // HTTP headers used as a basis for all queries.
  protected _headers: HeadersInit = {};

  protected _logger: Logger;

  // Default values for products. These will get overridden if they're found in the product data.
  protected _productDefaults = {
    uom: "ea",
    quantity: 1,
    currencyCode: "USD",
    currencySymbol: "$",
  };

  /**
   * Constructor for the SupplierBase class.
   * @param query - The query to search for.
   * @param limit - The limit of results to return.
   * @param controller - The AbortController to use for the query.
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
   * Preconnect to the base URL. Apparently this is a way to speed up the loading of the page(s).
   * @returns A promise that resolves when the preconnect is complete.
   */
  private _preconnect(): void {
    //preconnect(this._baseURL);
  }

  /**
   * This is a placeholder for any setup that needs to be done before the query is made.
   * @returns A promise that resolves when the setup is complete.
   */
  protected async _setup(): Promise<void> {}

  /**
   * Type guard to check if a value is a valid Response object.
   */
  private _isResponse(response: unknown): response is Response {
    return response instanceof Response;
  }

  /**
   * Type guard to check if a value is a valid JSON response.
   */
  private _isJsonResponse(response: unknown): response is Response {
    if (!this._isResponse(response)) return false;

    try {
      const contentTypeHeader = response.headers.get("content-type");
      if (!contentTypeHeader) return false;

      const dataType = contentType.parse(contentTypeHeader);
      if (!dataType?.type) return false;

      return ["application/json", "application/javascript", "text/javascript"].includes(
        dataType.type,
      );
    } catch {
      return false;
    }
  }

  /**
   * Type guard to check if a value is a valid HTML response.
   */
  private _isHtmlResponse(response: unknown): response is HTMLResponse {
    if (!this._isResponse(response)) return false;

    try {
      const contentTypeHeader = response.headers.get("content-type");
      if (!contentTypeHeader) return false;

      const dataType = contentType.parse(contentTypeHeader);
      if (!dataType?.type) return false;

      return ["text/html", "text/xml", "application/xhtml+xml"].includes(dataType.type);
    } catch {
      return false;
    }
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
   * @throws {TypeError} If the response is not valid HTML content
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
   * Send a GET request to the given URL and return the response as a JSON object.
   *
   * @param options - The options for the GET request.
   * @returns The response from the GET request as a JSON object.
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
   * Type guard to check if a value is a valid result object with required fields
   */
  protected _isValidResult(
    result: unknown,
  ): result is { value: RequiredProductFields & Partial<OptionalProductFields> } {
    return (
      typeof result === "object" &&
      result !== null &&
      "value" in result &&
      this._isMinimalProduct((result as any).value)
    );
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
            this._logger.error(`Error found when yielding a product:`, result);
            continue;
          }

          try {
            const finishedProduct = await this._finishProduct(result.value as ProductBuilder<T>);

            if (finishedProduct) {
              yield finishedProduct;
            }
          } catch (err) {
            this._logger.error(`Error found when yielding a product:`, err);
            continue;
          }
        }
      }
    } catch (err) {
      if (this._controller.signal.aborted === true) {
        this._logger.warn("Search was aborted");
        return;
      }
      this._logger.error("ERROR in generator fn:", err);
    }
  }

  /**
   * Check if the product is a valid Product object.
   * @param product - The product to check
   * @returns True if the product is a valid Product object, false otherwise
   * @example
   * ```typescript
   * if (this._isProduct(someObject)) {
   *   console.log("Valid product:", someObject.price, someObject.quantity);
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
      //typeof product[key as keyof typeof product] === expectedType;
    });
  }

  /**
   * Checks if a product object has the minimal required properties to be considered a valid partial product.
   * @param product - The product object to validate
   * @returns True if the product has all required properties with correct types, false otherwise
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
   * @param product - The partial product to finalize
   * @returns Promise resolving to a complete Product object or void if validation fails
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
   * Query the products from the supplier.
   * @param query - The search query string to find products
   * @returns Promise resolving to an array of supplier-specific product objects or void
   * @example
   * ```typescript
   * const results = await this._queryProducts("sodium chloride");
   * if (results) {
   *   for (const result of results) {
   *     // Process each product result
   *   }
   * }
   * ```
   */
  protected abstract _queryProducts(
    query: string,
    limit: number,
  ): Promise<ProductBuilder<T>[] | void>;

  /**
   * Parse the supplier-specific product data into the common Product type.
   * @param product - The supplier-specific product data to parse
   * @returns Promise resolving to a partial Product object or void if parsing fails
   * @example
   * ```typescript
   * const supplierProduct = await this._queryProducts("test");
   * if (supplierProduct) {
   *   const commonProduct = await this._getProductData(supplierProduct[0]);
   *   if (commonProduct) {
   *     console.log("Parsed product:", commonProduct.title);
   *   }
   * }
   * ```
   */
  protected abstract _getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void>;
}
