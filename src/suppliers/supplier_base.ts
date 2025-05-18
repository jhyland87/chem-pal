import { getCachableResponse } from "../helpers/request";
import { HeaderObject, Product } from "../types";

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
  protected _headers: HeaderObject = {};

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
   * Get the headers for the HTTP GET request.
   * @param url - The URL to get the headers for.
   * @returns The headers for the HTTP GET request.
   */
  protected async httpGetHeaders(url: string | URL): Promise<HeaderObject | void> {
    try {
      const requestObj = new Request(this._href(url), {
        signal: this._controller.signal,
        headers: {
          ...this._headers,
          //accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        },
        referrer: this._baseURL,
        referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        method: "HEAD",
        mode: "cors",
        credentials: "include",
      });

      const httpResponse = await fetch(requestObj);

      // @todo: Override this if not in development mode
      if (chrome.extension !== undefined && process.env.NODE_ENV === "development") {
        const cacheData = getCachableResponse(requestObj, httpResponse);
        console.log("cacheData:", cacheData);
      }

      return Object.fromEntries(httpResponse.headers.entries()) as HeaderObject;
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
   * @param url - The URL to send the POST request to.
   * @param body - The body of the POST request.
   * @param headers - The headers for the POST request.
   * @returns The response from the POST request.
   * @example
   * ```ts
   * const request = await this.httpPost(
   *    "http://example.com",
   *    { name: "John" },
   *    { "Content-Type": "application/json" }
   * );
   * const responseJSON = await request?.json();
   * ```
   */
  protected async httpPost(
    url: string | URL,
    body: object,
    headers: HeaderObject = {},
  ): Promise<Response | void> {
    try {
      const requestObj = new Request(this._href(url), {
        signal: this._controller.signal,
        headers: {
          ...this._headers,
          ...headers,
        },
        referrer: this._baseURL,
        referrerPolicy: "strict-origin-when-cross-origin",
        body: JSON.stringify(body),
        method: "POST",
        mode: "cors",
      });

      // Fetch the goods
      const httpResponse = await fetch(requestObj);

      // @todo: Override this if not in development mode
      if (chrome.extension !== undefined && process.env.NODE_ENV === "development") {
        const cacheData = getCachableResponse(requestObj, httpResponse);
        console.log("cacheData:", cacheData);
      }

      return httpResponse as Response;
    } catch (error) {
      console.error("Error received during fetch:", { error, signal: this._controller.signal });
    }
  }

  /**
   * Send a GET request to the given URL with the given headers.
   * @param url - The URL to send the GET request to.
   * @param headers - The headers for the GET request.
   * @returns The response from the GET request.
   */
  protected async httpGet(url: string | URL, headers: HeaderObject = {}): Promise<Response | void> {
    try {
      const requestObj = new Request(this._href(url), {
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
      if (chrome.extension !== undefined && process.env.NODE_ENV === "development") {
        const cacheData = getCachableResponse(requestObj, httpResponse);
        console.log("cacheData:", cacheData);
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
   * @param url - The URL to send the GET request to.
   * @param headers - The headers for the GET request.
   * @returns The response from the GET request as a JSON object.
   */
  protected async httpGetJson(
    url: string | URL,
    headers: HeaderObject = {},
  ): Promise<object | void> {
    try {
      const response = await this.httpGet(url, headers);
      return response?.json() as object;
    } catch (error) {
      console.error("Error received during fetch:", { error, signal: this._controller.signal });
    }
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
            yield this._finishProduct(result) as T;
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
  protected _finishProduct(product: T): T {
    //product.url = (product.url as string).replace(/chrome-extension:\/\/[a-z]+/, "");
    return product;
  }

  /**
   * Takes in either a relative or absolute URL and returns an absolute URL. This is useful for when you aren't
   * sure if the link (retrieved from parsed text, a setting, an element, an anchor value, etc) is absolute or
   * not. Using relative links will result in http://chrome-extension://... being added to the link.
   *
   * @param {string|URL} url - URL object or string
   * @returns {string} - absolute URL
   * @example
   * ```ts
   * this._href('/some/path')
   * // https://supplier_base_url.com/some/path
   * this._href('https://supplier_base_url.com/some/path')
   * // https://supplier_base_url.com/some/path
   * this._href(new URL('https://supplier_base_url.com/some/path'))
   * // https://supplier_base_url.com/some/path
   */
  protected _href(url: string | URL): string {
    return new URL(url, this._baseURL).toString();
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
