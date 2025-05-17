import { HeaderObject, Product } from "../types";
import SupplierBase from "./supplier_base";

type _productIndexObject = {
  [key: string]: any; //string | number | { [key: string]: string | number };
};

// Add type definitions at the top of the file after imports
type SearchParams = {
  [key: string]: string;
};

type ProductData = {
  displayName: string;
  canonicalUrl: string;
  dataLayer?: {
    productPrice?: string[];
  };
  familyVariyantProductDetails?: {
    productVariantsResult?: {
      masterProductBean?: {
        skus?: Array<{
          priceInfo?: {
            regularPrice?: string[];
          };
        }>;
      };
    };
  };
};

/**
 * Carolina.com uses Oracle ATG Commerce as their ecommerce platform.
 *
 * The ATG Commerce platform uses a custom script to fetch product data.
 * This script is located in the `script[nonce]` element of the product page.
 *
 * The script is a JSON object that contains the product data.
 *
 * Product search for Carolina.com will query the following URL (with `lithium` as the search query):
 *  - {@link https://www.carolina.com/browse/product-search-results?
 * product.productTypes=chemicals&
 * facetFields=product.productTypes&
 * defaultFilter=product.cbsLowPrice|GT%200.0||product.startDate|LTEQ%201.7457984E12||product.startDate|LTEQ%201.7457984E12&
 * Nr=AND%28product.siteId%3A100001%2COR%28product.type%3AProduct%29%2COR%28product.catalogId%3AcbsCatalog%29%29&
 * viewSize=120&
 * q=lithium&
 * noRedirect=true&
 * nore=y&
 * searchExecByFormSubmit=true&
 * tab=p&
 * question=lithium |test}

 * The query params are:
 * - product.productTypes: The product type to search for.
 * - facetFields: The fields to facet on.
 * - defaultFilter: The default filter to apply to the search.
 * - Nr: ???
 * - viewSize: The number of results to return per page.
 * - q: The search query.
 * - noRedirect: Whether to redirect to the search results page.
 * - nore: Whether to return the results in a non-redirecting format.
 * - searchExecByFormSubmit: Whether to execute the search by form submission.
 * - tab: The tab to display the results in.
 * - question: The search query.
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
  protected _headers: HeaderObject = {
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

  //constructor(query: string, limit: number = 5, controller: AbortController) {
  //  super(query, limit, controller);
  //}

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

  protected async queryProducts(): Promise<void> {
    const queryURL = this._makeQueryUrl(this._query);
    console.debug("SupplierLaboratoriumDiscounter|", { queryURL });
    const response = await this.httpGet(queryURL);

    if (!response?.ok) {
      throw new Error(`Response status: ${response?.status}`);
    }

    const resultJSON = await response.json();
    console.log("SupplierLaboratoriumDiscounter|resultJSON:", resultJSON);
    console.log(
      "SupplierLaboratoriumDiscounter|Setting this._queryResults to:",
      resultJSON.collection.products,
    );

    this._queryResults = Object.values(resultJSON.collection.products);
    //console.log('[queryProducts] this._queryResults:', this._queryResults)
    return;
  }

  protected _getProductData(result: _productIndexObject): Promise<Product | void> {
    return Promise.resolve({
      uuid: result.id,
      title: result.title || result.fulltitle,
      description: result.description,
      price: 123, //result.price
      currency: "EUR",
      url: result.url,
      supplier: this.supplierName,
      displayPrice: result.price.price,
      quantity: 1,
      uom: "piece",
    });
  }
}
