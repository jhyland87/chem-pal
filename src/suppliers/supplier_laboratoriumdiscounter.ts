import type { QuantityObject } from "data/quantity";
import type { Product } from "types";
import { CurrencySymbolMap } from "../data/currency";
import { isQuantityObject, parseQuantityFromList } from "../helpers/quantity";
import SupplierBase from "./supplier_base";
import {
  _productIndexObject,
  LaboriumDiscounterResponse,
  SearchParams,
  type _Product,
} from "./supplier_laboratoriumdiscounter.d";

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
export default class SupplierLaboratoriumDiscounter<T extends Product>
  extends SupplierBase<T>
  implements AsyncIterable<T>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Laboratorium Discounter";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.laboratoriumdiscounter.nl";

  // Override the type of _queryResults to use our specific type
  protected _queryResults: Array<_productIndexObject> = [];

  // Used to keep track of how many requests have been made to the supplier.
  protected _httpRequstCount: number = 0;

  // HTTP headers used as a basis for all queries.
  protected _headers: HeadersInit = {
    //'accept': 'application/json, text/javascript, */*; q=0.01',
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

  protected _makeQueryParams(): SearchParams {
    return {
      limit: this._limit.toString(),
      format: "json",
    };
  }

  protected async queryProducts(): Promise<void> {
    const params = this._makeQueryParams();
    const response = await this.httpGet({ path: `/en/search/${this._query}`, params });

    if (!response?.ok) {
      throw new Error(`Response status: ${response?.status}`);
    }

    //
    const resultJSON = (await response.json()) as LaboriumDiscounterResponse;

    // Save results
    this._queryResults = Object.values(resultJSON.collection.products);
    return;
  }

  protected _getProductData(result: _Product): Promise<Product | void> {
    const quantity = parseQuantityFromList([
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
      currencySymbol: CurrencySymbolMap.EUR,
      url: result.url,
      supplier: this.supplierName,
      displayPrice: result.price.price,
      ...(quantity as QuantityObject),
    });
  }
}
