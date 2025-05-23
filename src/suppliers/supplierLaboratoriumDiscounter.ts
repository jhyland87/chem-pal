import { CURRENCY_SYMBOL_MAP } from "constants/currency";
import { type Product, type QuantityObject } from "types";
import {
  type ProductObject,
  type SearchParams,
  type SearchResponse,
} from "types/laboratoriumdiscounter";
import { isQuantityObject, parseQuantityCoalesce } from "../helpers/quantity";
import SupplierBase from "./supplierBase";

/**
 * Laboratorium Discounter.nl uses a custom script to fetch product data.
 *
 * The script is located in the `script[nonce]` element of the product page.
 *
 * The script is a JSON object that contains the product data.
 * Duh... thanks, AI.
 * @module SupplierLaboratoriumDiscounter
 * @category Supplier
 */
export default class SupplierLaboratoriumDiscounter
  extends SupplierBase<ProductObject, Product>
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Laboratorium Discounter";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.laboratoriumdiscounter.nl";

  // Override the type of _queryResults to use our specific type
  protected _queryResults: Array<ProductObject> = [];

  // Used to keep track of how many requests have been made to the supplier.
  protected _httpRequstCount: number = 0;

  // HTTP headers used as a basis for all queries.
  protected _headers: HeadersInit = {
    /* eslint-disable */
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.6",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "sec-ch-ua": '"Brave";v="135\', "Not-A.Brand";v="8\', "Chromium";v="135"',
    "sec-ch-ua-arch": '"arm"',
    "sec-ch-ua-full-version-list":
      '"Brave";v="135.0.0.0\', "Not-A.Brand";v="8.0.0.0\', "Chromium";v="135.0.0.0"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": '""',
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-gpc": "1",
    "x-requested-with": "XMLHttpRequest",
    /* eslint-enable */
  };

  protected _makeQueryUrl(query: string): string {
    const searchParams: SearchParams = {
      limit: this._limit.toString(),
      format: "json",
    };
    const url = new URL(`en/search/${query}`, this._baseURL);
    const params = new URLSearchParams(searchParams);
    url.search = params.toString();
    return url.toString();
  }

  protected _makeQueryParams(query: string): SearchParams {
    return {
      limit: this._limit.toString(),
      format: "json",
    };
  }

  protected _isResponseOk(response: unknown): response is SearchResponse {
    return !!response && typeof response === "object" && "collection" in response;
  }

  protected async _queryProducts(query: string): Promise<ProductObject[] | void> {
    const params = this._makeQueryParams(query);

    const response: unknown = await this._httpGetJson({
      path: `/en/search/${this._query}`,
      params,
    });

    if (!this._isResponseOk(response)) {
      console.log("Bad search response:", response);
      return;
    }

    return Object.values(response.collection.products);
  }

  protected _getProductData(result: ProductObject): Promise<Partial<Product> | void> {
    const quantity = parseQuantityCoalesce([
      result.code,
      result.sku,
      result.fulltitle,
      result.variant,
    ]);

    if (!isQuantityObject(quantity)) return Promise.resolve(undefined);
    return Promise.resolve({
      uuid: result.id,
      title: result.title || result.fulltitle,
      description: result.description,
      price: result.price.price,
      currencyCode: "EUR",
      currencySymbol: CURRENCY_SYMBOL_MAP.EUR,
      url: result.url,
      supplier: this.supplierName,
      displayPrice: result.price.price,
      ...(quantity as QuantityObject),
    });
  }
}
