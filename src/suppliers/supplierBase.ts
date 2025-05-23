import { UOM } from "constants/app";
import * as contentType from "content-type";
import { toUSD } from "helpers/currency";
import { toBaseQuantity } from "helpers/quantity";
import { getCachableResponse } from "helpers/request";
import { type Product } from "types";
import { type RequestOptions, type RequestParams } from "types/request";

/**
 * The base class for all suppliers.
 * @abstract
 * @category Supplier
 * @module SupplierBase
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

  //protected _logger = log.getLogger("default");

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
    this._query = query;
    this._limit = limit;
    if (controller) {
      this._controller = controller;
    } else {
      console.debug("Made a new AbortController");
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
   * Check if the response is a valid Response object.
   *
   * @param response - The response to check.
   * @returns True if the response is a valid Response object, false otherwise.
   */
  private _isResponse(response: Response | void): response is Response {
    return response instanceof Response;
  }

  /**
   * Check if the response is a valid JSON response.
   *
   * @param response - The response to check.
   * @returns True if the response is a valid JSON response, false otherwise.
   */
  private _isJsonResponse(response: Response | void): response is Response {
    if (!this._isResponse(response)) return false;
    const dataType = contentType.parse(response.headers.get("content-type") ?? "");
    console.log("contentType:", dataType.type);

    if (!dataType) return false;

    return ["application/json", "application/javascript", "text/javascript"].includes(
      dataType.type,
    );
  }

  /**
   * Get the headers for the HTTP GET request.
   *
   * @param url - The URL to get the headers for.
   * @returns The headers for the HTTP GET request.
   */
  protected async _httpGetHeaders(url: string | URL): Promise<HeadersInit | void> {
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
        console.log("_httpGetHeaders| httpResponse:", httpResponse);
        console.log("_httpGetHeaders| process.env:", process.env);
        const cacheData = getCachableResponse(requestObj, httpResponse);
        console.log("_httpGetHeaders| cacheData:", cacheData);
      }

      return Object.fromEntries(httpResponse.headers.entries()) satisfies HeadersInit;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.debug("Request was aborted", { error, signal: this._controller.signal });
        this._controller.abort();
      } else {
        console.error("Error received during fetch:", { error, signal: this._controller.signal });
      }
    }
  }

  /**
   * Send a POST request to the given URL with the given body and headers.
   * @example
   * ```typescript
   * const request = await this._httpPost({
   *    path: "/api/v1/products",
   *    body: { name: "John" },
   *    headers: { "Content-Type": "application/json" }
   * });
   * // Sends HTTP POST request to https://supplier_base_url.com/api/v1/products with `{"name":"John"}` body.
   *
   * const request = await this._httpPost({
   *    path: "/api/v1/products",
   *    host: "api.example.com",
   *    body: { name: "John" },
   *    params: { a: "b", c: "d" },
   *    headers: { "Content-Type": "application/json" }
   * });
   * // Sends HTTP POST request to https://api.example.com/api/v1/products?a=b&c=d with `{"name":"John"}` body.
   * ```
   */
  protected async _httpPost({
    path,
    host = undefined,
    body = {},
    params = {},
    headers = {},
  }: RequestOptions): Promise<Response | void> {
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
      console.error("Invalid POST response: ", badResponse);
      throw new TypeError(`Invalid POST response: ${httpRequest}`);
    }

    // @todo: Override this if not in development mode
    if (
      chrome.extension !== undefined &&
      process.env.MODE !== "development" &&
      httpRequest.headers.get("ismockedresponse") !== "true"
    ) {
      console.log("_httpPost| httpRequest:", httpRequest);
      console.log("_httpPost| process.env:", process.env);
      const cacheData = getCachableResponse(requestObj, httpRequest);
      console.log("_httpPost| cacheData:", cacheData);
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
    host = undefined,
    body = {},
    params = {},
    headers = {},
  }: RequestOptions): Promise<object | void> {
    const httpRequest = await this._httpPost({ path, host, body, params, headers });
    if (!this._isJsonResponse(httpRequest)) {
      throw new TypeError(`_httpPostJson| Invalid POST response: ${httpRequest}`);
    }
    return await httpRequest.json();
  }

  /**
   * Send a GET request to the given URL with the given headers.
   *
   * @returns The response from the GET request.
   * @example
   * ```typescript
   * const response = await this._httpGet({ path: "http://example.com", params: { a: "b", c: "d" } });
   * // Sends HTTP GET request to https://example.com/some/path?a=b&c=d
   *
   * const response = await this._httpGet({ path: "http://example.com", params: { a: "b", c: "d" }, baseUrl: "https://another_host.com" });
   * // Sends HTTP GET request to https://another_host.com/some/path?a=b&c=d
   * ```
   */
  protected async _httpGet({
    path,
    params = {},
    headers = {},
    host = undefined,
  }: RequestOptions): Promise<Response | void> {
    try {
      // Check if the request has been aborted before proceeding
      if (this._controller.signal.aborted) {
        console.debug("Request was aborted before fetch", { signal: this._controller.signal });
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
        console.log("_httpGet| httpResponse:", httpResponse);
        console.log("_httpGet| process.env:", process.env);
        const cacheData = getCachableResponse(requestObj, httpResponse);
        console.log("_httpGet| cacheData:", cacheData);
      }

      return httpResponse as Response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.debug("Request was aborted", { error, signal: this._controller.signal });
        this._controller.abort();
      } else {
        console.error("Error received during fetch:", { error, signal: this._controller.signal });
      }
    }
  }

  /**
   * Send a GET request to the given URL and return the response as a JSON object.
   *
   * @param options - The options for the GET request.
   * @returns The response from the GET request as a JSON object.
   */
  protected async _httpGetJson({
    path,
    params = {},
    headers = {},
    host = undefined,
  }: RequestOptions): Promise<object | void> {
    const _headers = new Headers({
      ...this._headers,
      ...(headers as HeadersInit),
    });
    const httpRequest = await this._httpGet({ path, params, headers: _headers, host });

    if (!this._isJsonResponse(httpRequest)) {
      const badResponse = await (httpRequest as unknown as Response)?.text();
      console.error("_httpGetJson| Invalid GET response: ", badResponse);
      throw new TypeError(`_httpGetJson| response: ${httpRequest}`);
    }

    return await httpRequest?.json();
  }

  /**
   * The function asynchronously iterates over query results, retrieves product data, and yields valid
   * results.
   * @returns An async generator that yields valid results.
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    try {
      await this._setup();
      const results = await this._queryProducts(this._query);
      this._queryResults = results || [];

      if (this._queryResults.length === 0) {
        console.debug(`No query results found`);
        return;
      }

      // Process results in batches to maintain controlled concurrency
      for (let i = 0; i < this._queryResults.length; i += this._httpRequestBatchSize) {
        const batch = this._queryResults.slice(i, i + this._httpRequestBatchSize);

        // Create promises for the current batch
        const batchPromises = batch.map((r: unknown) => {
          const result = { ...(r as object) };
          return this._getProductData(result as S) as Promise<T>;
        });

        // Process batch results as they complete
        const batchResults = await Promise.allSettled(batchPromises);
        for (const result of batchResults) {
          try {
            if (result.status === "fulfilled" && result.value) {
              const finishedProduct = await this._finishProduct(result.value);
              if (finishedProduct) {
                yield finishedProduct as T;
              }
            }
          } catch (err) {
            console.error(`Error found when yielding a product:`, err);
            continue;
          }
        }
      }
    } catch (err) {
      // Here to catch when the overall search fails
      if (this._controller.signal.aborted === true) {
        console.debug("Search was aborted");
        return;
      }
      console.error("ERROR in generator fn:", err);
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
    return (
      typeof product === "object" &&
      product !== null &&
      "price" in product &&
      "quantity" in product &&
      "uom" in product
    );
  }

  /**
   * Checks if a product object has the minimal required properties to be considered a valid partial product.
   * @param product - The product object to validate
   * @returns True if the product has all required properties with correct types, false otherwise
   * @example
   * ```typescript
   * const partialProduct = {
   *   quantity: 1,
   *   price: 29.99,
   *   uom: "ea",
   *   url: "https://example.com/product",
   *   currencyCode: "USD",
   *   currencySymbol: "$",
   *   title: "Test Product"
   * };
   * if (this._isMinimalProduct(partialProduct)) {
   *   // Process the valid partial product
   * }
   * ```
   */
  protected _isMinimalProduct(product: unknown): product is Partial<Product> {
    if (!product || typeof product !== "object") return false;

    //const item = product as Record<string, unknown>;

    const requiredStringProps = {
      quantity: "number",
      price: "number",
      uom: "string",
      url: "string",
      currencyCode: "string",
      currencySymbol: "string",
      title: "string",
    };

    const hasAllRequiredProps = Object.entries(requiredStringProps).every(([key, val]) => {
      return key in product && typeof product[key as keyof typeof product] === val;
    });

    return hasAllRequiredProps;
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
   * @example
   * ```typescript
   * const partialProduct = {
   *   title: "Test Chemical",
   *   price: 29.99,
   *   quantity: 100,
   *   uom: "g",
   *   currencyCode: "EUR",
   *   url: "/products/test-chemical"
   * };
   * const finalProduct = await this._finishProduct(partialProduct);
   * if (finalProduct) {
   *   console.log("USD Price:", finalProduct.usdPrice);
   *   console.log("Base Quantity:", finalProduct.baseQuantity);
   * }
   * ```
   */
  protected async _finishProduct(product: Partial<Product>): Promise<Product | void> {
    // Check if the partial product has the minimal amount of data to be finished/displayed
    if (!this._isMinimalProduct(product)) return;

    //product.url = (product.url as string).replace(/chrome-extension:\/\/[a-z]+/, "");
    product.usdPrice = product.price ?? 0;
    product.baseQuantity =
      toBaseQuantity(product.quantity ?? 0, product.uom as UOM) ?? product.quantity ?? 0;

    // If the product is a non-USD product, populate the usdPrice with the converted currency to aid in sorting/filtering
    if (product.currencyCode !== "USD") {
      product.usdPrice = await toUSD(product.price ?? 0, product.currencyCode ?? "USD");
    }

    if (!this._isProduct(product)) {
      console.error(`_finishProduct| Invalid product: ${JSON.stringify(product)}`);
      return;
    }

    // Make sure the url is an absolute URL to the suppliers site
    product.url = this._href(product.url);

    return product;
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
  protected _href(
    path: string | URL,
    params: RequestParams | null = {},
    host: string | void = undefined,
  ): string {
    const urlObj = new URL(path, this._baseURL);

    if (host) {
      urlObj.host = host;
    }

    if (params) {
      urlObj.search = new URLSearchParams(params as Record<string, string>).toString();
    }

    return urlObj.toString();
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
  protected abstract _queryProducts(query: string): Promise<Array<S> | void>;

  /**
   * Parse the supplier-specific product data into the common Product type.
   * @param productIndexObject - The supplier-specific product data to parse
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
  protected abstract _getProductData(productIndexObject: S): Promise<Partial<Product> | void>;
}
