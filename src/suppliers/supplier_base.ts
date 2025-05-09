import _ from 'lodash';
import { Product, HeaderObject } from '../types'
import { preconnect } from 'react-dom';

/**
 * The base class for all suppliers.
 * @template T - The type of product to return.
 */
export default abstract class SupplierBase<T extends Product> implements AsyncIterable<T> {
  // The name of the supplier (used for display name, lists, etc)
  public abstract readonly supplierName: string

  // The base URL for the supplier.
  protected abstract _baseURL: string

  // String to query for (Product name, CAS, etc)
  protected _query: string

  // The products after all http calls are made and responses have been parsed/filtered.
  protected _products: Array<Product> = []

  // If the products first require a query of a search page that gets iterated over,
  // those results are stored here
  protected _queryResults: Array<any> = []

  // The AbortController interface represents a controller object that allows you to
  // abort one or more Web requests as and when desired.
  protected _controller: AbortController

  // How many results to return for this query (This is not a limit on how many requests
  // can be made to a supplier for any given query).
  protected _limit: number

  // This is a limit to how many queries can be sent to the supplier for any given query.
  protected _httpRequestHardLimit: number = 50

  // Used to keep track of how many requests have been made to the supplier.
  protected _http_requst_count: number = 0;

  // If using async requests, this will determine how many of them to batch together (using
  // something like Promise.all()). This is to avoid overloading the users bandwidth and
  // to not flood the supplier with 100+ requests all at once.
  protected _http_request_batch_size: number = 10;

  // HTTP headers used as a basis for all queries.
  protected _headers: HeaderObject = {};

  /**
   * Constructor for the SupplierBase class.
   * @param query - The query to search for.
   * @param limit - The limit of results to return.
   * @param controller - The AbortController to use for the query.
   */
  constructor(query: string, limit: number = 5, controller: AbortController) {
    this._query = query;
    this._limit = limit;
    //SupplierCarolina.controller = new AbortController()
    if (controller) {
      this._controller = controller;
    } else {
      console.debug('Made a new AbortController')
      this._controller = new AbortController()
    }

    this._preconnect();
  }

  /**
   * Preconnect to the base URL. Apparently this is a way to speed up the loading of the page(s).
   * @returns A promise that resolves when the preconnect is complete.
   */
  private _preconnect(): void {
    preconnect(this._baseURL);
  }

  /**
   * This is a placeholder for any setup that needs to be done before the query is made.
   * @returns A promise that resolves when the setup is complete.
   */
  protected async _setup(): Promise<void> { }

  /**
   * Get the headers for the HTTP GET request.
   * @param url - The URL to get the headers for.
   * @returns The headers for the HTTP GET request.
   */
  protected async httpGetHeaders(url: string): Promise<HeaderObject | void> {
    try {
      console.debug('httpGetHeaders| this._controller.signal:', this._controller.signal)
      const httpResponse = await fetch(url, {
        signal: this._controller.signal,
        headers: {
          ...this._headers,
          //accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        },
        referrer: this._baseURL,
        referrerPolicy: 'strict-origin-when-cross-origin',
        body: null,
        method: 'HEAD',
        mode: 'cors',
        credentials: 'include'
      });

      return Object.fromEntries(httpResponse.headers.entries())
    }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.debug('Request was aborted', { error, signal: this._controller.signal });
        this._controller.abort();
      } else {
        console.error('Error received during fetch:', { error, signal: this._controller.signal });
      }
    }
  }

  /**
   * Send a POST request to the given URL with the given body and headers.
   * @param url - The URL to send the POST request to.
   * @param body - The body of the POST request.
   * @param headers - The headers for the POST request.
   * @returns The response from the POST request.
   */
  protected async httpPost(url: string, body: Object, headers: HeaderObject = {}): Promise<Response | void> {
    try {
      return await fetch(url, {
        signal: this._controller.signal,
        headers: {
          ...this._headers,
          ...headers
        },
        referrer: this._baseURL,
        referrerPolicy: 'strict-origin-when-cross-origin',
        body: JSON.stringify(body),
        method: 'POST',
        mode: 'cors'
      });
    }
    catch (error) {
      console.error('Error received during fetch:', { error, signal: this._controller.signal });
    }
  }

  /**
   * Send a GET request to the given URL with the given headers.
   * @param url - The URL to send the GET request to.
   * @param headers - The headers for the GET request.
   * @returns The response from the GET request.
   */
  protected async httpGet(url: string, headers: HeaderObject = {}): Promise<Response | void> {
    try {
      console.debug('httpget| this._controller.signal:', this._controller.signal)
      return await fetch(url, {
        signal: this._controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          ...this._headers,
          ...headers
        },
        referrer: this._baseURL,
        referrerPolicy: 'no-referrer',
        body: null,
        method: 'GET',
        mode: 'cors',
        credentials: 'include'
      });
    }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.debug('Request was aborted', { error, signal: this._controller.signal });
        this._controller.abort();
      } else {
        console.error('Error received during fetch:', { error, signal: this._controller.signal });
      }
    }
  }

  /**
   * Send a GET request to the given URL and return the response as a JSON object.
   * @param url - The URL to send the GET request to.
   * @returns The response from the GET request as a JSON object.
   */
  protected async httpGetJson(url: string): Promise<Response | void> {
    try {
      const response = await this.httpGet(url)
      return response?.json()
    } catch (error) {
      console.error('Error received during fetch:', { error, signal: this._controller.signal });
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
      const productPromises = this._queryResults.map((r: Object) => {
        // @todo: This is a hack to remove chrome-extension:// from the href if it exists. Why
        //        is it required? Should be able to use a URL without needing to remove this.
        //r.href = r.href.replace(/chrome-extension:\/\/[a-z]+/, '')
        return this._getProductData(r)
      });

      for (const resultPromise of productPromises) {
        try {
          const result = await resultPromise;
          if (result) {
            yield result as T;
          }
        }
        catch (err) { // Here to catch errors in individual yields
          console.error(`Error found when yielding a product:`, err)
          continue
        }
      }
    }
    catch (err) { // Here to catch when the overall search fails
      if (this._controller.signal.aborted === true) {
        console.debug('Search was aborted')
        return
      }
      console.error('ERROR in generator fn:', err)
    }
  }

  /**
   * Query the products from the supplier.
   * @returns A promise that resolves when the products have been queried.
   */
  protected abstract queryProducts(): Promise<void>

  /**
   * Parse the products from the supplier.
   * @returns A promise that resolves when the products have been parsed.
   */
  protected abstract _getProductData(productIndexObject: Object): Promise<Product | void>
}