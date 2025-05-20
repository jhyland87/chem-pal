import type { UOM } from "data/quantity";
//import type { HeaderObject, Product, RequestParams } from "types";
import type { Product } from "types";
import type { RequestOptions, RequestParams } from "types/request";
import { toUSD } from "../helpers/currency";
import { toBaseQuantity } from "../helpers/quantity";
import { getCachableResponse } from "../helpers/request";

/**
 * The base class for all suppliers.
 * @abstract
 * @category Supplier
 * @module SupplierBase
 * @typeParam T - The type of product to return.
 */
export default abstract class SupplierBase<T extends Product> implements AsyncIterable<T> {
  // The name of the supplier (used for display name, lists, etc)
  public abstract readonly supplierName: string;

  // The base URL for the supplier.
  protected abstract _baseURL: string;

  // String to query for (Product name, CAS, etc)
  protected _query: string;

  // The products after all http calls are made and responses have been parsed/filtered.
  protected _products: Array<Product> = [];

  // If the products first require a query of a search page that gets iterated over,
  // those results are stored here
  protected _queryResults: Array<unknown> = [];

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
  protected _http_request_batch_size: number = 10;

  // HTTP headers used as a basis for all queries.
  protected _headers: HeadersInit = {};

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
   * @param {Response|void} response - The response to check.
   * @returns {boolean} True if the response is a valid Response object, false otherwise.
   */
  private _isResponse(response: Response | void): response is Response {
    return response instanceof Response;
  }

  /**
   * Check if the response is a valid JSON response.
   *
   * @param {Response|void} response - The response to check.
   * @returns {boolean} True if the response is a valid JSON response, false otherwise.
   */
  private _isJsonResponse(response: Response | void): response is Response {
    if (!this._isResponse(response)) return false;
    if (!response.headers.get("content-type")) return false;
    if (response.headers.get("content-type")?.includes("application/json")) return true;
    return false;
  }

  /**
   * Get the headers for the HTTP GET request.
   *
   * @param {string|URL} url - The URL to get the headers for.
   * @returns {HeadersInit|void} The headers for the HTTP GET request.
   */
  protected async httpGetHeaders(url: string | URL): Promise<HeadersInit | void> {
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
        import.meta.env.MODE !== "development" &&
        httpResponse.headers.get("ismockedresponse") !== "true"
      ) {
        console.log("httpGetHeaders| httpResponse:", httpResponse);
        console.log("httpGetHeaders| import.meta.env:", import.meta.env);
        const cacheData = getCachableResponse(requestObj, httpResponse);
        console.log("httpGetHeaders| cacheData:", cacheData);
      }

      return Object.fromEntries(httpResponse.headers.entries()) as HeadersInit;
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
   *
   * @param {RequestOptions} params - The parameters for the POST request.
   * @param {string|URL} params.path - The URL to send the POST request to.
   * @param {object} [params.body] - The body of the POST request.
   * @param {RequestParams} [params.params] - The parameters to add to the URL.
   * @param {HeaderObject} params.headers - The headers for the POST request.
   * @returns {Response|void} The response from the POST request.
   * @example
   * ```typescript
   * const request = await this.httpPost({
   *    path: "/api/v1/products",
   *    body: { name: "John" },
   *    headers: { "Content-Type": "application/json" }
   * });
   * // Sends HTTP POST request to https://supplier_base_url.com/api/v1/products with `{"name":"John"}` body.
   *
   * const request = await this.httpPost({
   *    path: "/api/v1/products",
   *    host: "api.example.com",
   *    body: { name: "John" },
   *    params: { a: "b", c: "d" },
   *    headers: { "Content-Type": "application/json" }
   * });
   * // Sends HTTP POST request to https://api.example.com/api/v1/products?a=b&c=d with `{"name":"John"}` body.
   * ```
   */
  protected async httpPost({
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
      throw new TypeError(`Invalid POST response: ${httpRequest}`);
    }

    // @todo: Override this if not in development mode
    if (
      chrome.extension !== undefined &&
      import.meta.env.MODE !== "development" &&
      httpRequest.headers.get("ismockedresponse") !== "true"
    ) {
      console.log("httpPost| httpRequest:", httpRequest);
      console.log("httpPost| import.meta.env:", import.meta.env);
      const cacheData = getCachableResponse(requestObj, httpRequest);
      console.log("httpPost| cacheData:", cacheData);
    }

    return httpRequest;
  }

  /**
   * Send a POST request to the given URL with the given body and headers and return the response as a JSON object.
   *
   * @param {RequestOptions} params - The parameters for the POST request.
   * @param {string|URL} params.path - The URL to send the POST request to.
   * @param {string} [params.host] - The host to use for overrides (eg: needing to call a different host for an API)
   * @param {object} [params.body] - The body of the POST request.
   * @param {RequestParams} [params.params] - The parameters to add to the URL.
   * @param {HeaderObject} [params.headers] - The headers for the POST request.
   * @returns {object|void} The response from the POST request as a JSON object.
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
    host = undefined,
    body = {},
    params = {},
    headers = {},
  }: RequestOptions): Promise<object | void> {
    const httpRequest = await this.httpPost({ path, host, body, params, headers });
    if (!this._isJsonResponse(httpRequest)) {
      throw new TypeError(`httpPostJson| Invalid POST response: ${httpRequest}`);
    }
    return await httpRequest.json();
  }

  /**
   * Send a GET request to the given URL with the given headers.
   *
   * @param {RequestOptions} params - The parameters for the GET request.
   * @param {string|URL} params.path - The URL to send the GET request to.
   * @param {RequestParams} [params.params] - The parameters to add to the URL.
   * @param {HeaderObject} [params.headers] - The headers for the GET request.
   * @param {string|URL} [params.host] - The host to use for overrides (eg: needing to call a different host for an API)
   * @returns {Response|void} The response from the GET request.
   * @example
   * ```typescript
   * const response = await this.httpGet({ path: "http://example.com", params: { a: "b", c: "d" } });
   * // Sends HTTP GET request to https://example.com/some/path?a=b&c=d
   *
   * const response = await this.httpGet({ path: "http://example.com", params: { a: "b", c: "d" }, baseUrl: "https://another_host.com" });
   * // Sends HTTP GET request to https://another_host.com/some/path?a=b&c=d
   * ```
   */
  protected async httpGet({
    path,
    params = {},
    headers = {},
    host = undefined,
  }: RequestOptions): Promise<Response | void> {
    try {
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
        import.meta.env.MODE !== "development" &&
        httpResponse.headers.get("ismockedresponse") !== "true"
      ) {
        console.log("httpGet| httpResponse:", httpResponse);
        console.log("httpGet| import.meta.env:", import.meta.env);
        const cacheData = getCachableResponse(requestObj, httpResponse);
        console.log("httpGet| cacheData:", cacheData);
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
   * @param {RequestOptions} params - The parameters for the GET request.
   * @param {string|URL} params.path - The path to send the GET request to.
   * @param {RequestParams} [params.params] - The parameters to add to the URL.
   * @param {HeaderObject} [params.headers] - The headers for the GET request.
   * @param {string} [params.host] - The host to use for overrides (eg: needing to call a different host for an API)
   * @returns {object|void} The response from the GET request as a JSON object.
   */
  protected async httpGetJson({
    path,
    params = {},
    headers = {},
    host = undefined,
  }: RequestOptions): Promise<object | void> {
    const _headers = new Headers({
      ...this._headers,
      ...(headers as HeadersInit),
    });
    const response = await this.httpGet({ path, params, headers: _headers, host });

    if (!this._isJsonResponse(response)) {
      throw new TypeError(`httpGetJson| response: ${response}`);
    }

    return await response?.json();
  }

  /**
   * The function asynchronously iterates over query results, retrieves product data, and yields valid
   * results.
   * @returns An async generator that yields valid results.
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    try {
      await this._setup();
      await this.queryProducts();

      // Get the product data for each query result
      const productPromises = this._queryResults.map((r: unknown) => {
        const result = { ...(r as object) };
        return this._getProductData(result as T) as Promise<T>;
      });

      console.log("productPromises:", productPromises);
      for (const resultPromise of productPromises) {
        try {
          const result = await resultPromise;
          if (result) {
            yield (await this._finishProduct(result)) as T;
          }
        } catch (err) {
          // Here to catch errors in individual yields
          console.error(`Error found when yielding a product:`, err);
          continue;
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
   * This is a placeholder for any finishing touches that need to be done to the product.
   * @param {Product} product - The product to finish.
   * @returns The finished product.
   */
  protected async _finishProduct(product: Product): Promise<Product> {
    //product.url = (product.url as string).replace(/chrome-extension:\/\/[a-z]+/, "");

    product.usdPrice = product.price;
    product.baseQuantity = toBaseQuantity(product.quantity, product.uom as UOM) ?? product.quantity;

    // If the product is a non-USD product, populate the usdPrice with the converted currency to aid in sorting/filtering
    if (product.currencyCode !== "USD") {
      product.usdPrice = await toUSD(product.price, product.currencyCode);
    }

    return product;
  }

  /**
   * Takes in either a relative or absolute URL and returns an absolute URL. This is useful for when you aren't
   * sure if the link (retrieved from parsed text, a setting, an element, an anchor value, etc) is absolute or
   * not. Using relative links will result in http://chrome-extension://... being added to the link.
   *
   * @param {string|URL} url - URL object or string
   * @param {RequestParams} [params] - The parameters to add to the URL.
   * @param {string} [host] - The host to use for overrides (eg: needing to call a different host for an API)
   * @returns {string} - absolute URL
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
   * @returns A promise that resolves when the products have been queried.
   */
  protected abstract queryProducts(): Promise<void>;

  /**
   * Parse the products from the supplier.
   * @returns A promise that resolves when the products have been parsed.
   */
  protected abstract _getProductData(productIndexObject: object): Promise<Product | void>;
}
