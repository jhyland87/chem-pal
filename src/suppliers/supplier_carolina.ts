import type { QuantityObject } from "data/quantity";
import result from "lodash/result";
import type { Product } from "types";
//import type { HeaderObject } from "types/request";
import { parsePrice } from "../helpers/currency";
import { parseQuantity } from "../helpers/quantity";
import SupplierBase from "./supplier_base";
import { _productIndexObject, ProductData, SearchParams } from "./supplier_carolina.d";

/**
 * Carolina.com uses Oracle ATG Commerce as their ecommerce platform.
 *
 * The ATG Commerce platform uses a custom script to fetch product data.
 * This script is located in the `script[nonce]` element of the product page.
 *
 * The script is a JSON object that contains the product data.
 *
 * Product search for Carolina.com will query the following URL (with `lithium` as the search query):

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
 *
 * Carolina.com uses VastCommerce, who does have an API that can be queried. Some useful endpoints are:
 * - https://www.carolina.com/swagger-ui/
 * - https://www.carolina.com/api/rest/openapi.json
 * - https://www.carolina.com/api/rest/cb/product/product-quick-view/863810
 * - https://www.carolina.com/api/rest/cb/cart/specificationDetails/863810
 * - https://www.carolina.com/api/rest/cb/product/product-details/863810
 *    curl -s https://www.carolina.com/api/rest/cb/product/product-details/863810 | jq '.response | fromjson'
 * - https://www.carolina.com/api/rest/cb/static/fetch-suggestions-for-global-search/acid
 * - https://www.carolina.com/api/rest/application.wadl
 * - You can get the JSON value of any page by appending: &format=json&ajax=true
 *   - https://www.carolina.com/chemistry-supplies/chemicals/10171.ct?format=json&ajax=true
 *   - https://www.carolina.com/specialty-chemicals-d-l/16-hexanediamine-6-laboratory-grade-100-ml/867162.pr?format=json&ajax=true
 *      curl -s 'https://www.carolina.com/specialty-chemicals-d-l/16-hexanediamine-6-laboratory-grade-100-ml/867162.pr?format=json&ajax=true' | jq '.contents.MainContent[0].atgResponse.response.response'
 * - https://www.carolina.com/browse/product-search-results?q=acid&product.type=Product&tab=p&format=json&ajax=true
 * - https://www.carolina.com/browse/product-search-results?tab=p&product.type=Product&product.productTypes=chemicals&facetFields=product.productTypes&format=json&ajax=true&viewSize=300&q=acid
 *
 * @module SupplierCarolina
 * @category Supplier
 */
export default class SupplierCarolina<T extends Product>
  extends SupplierBase<T>
  implements AsyncIterable<T>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Carolina";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.carolina.com";

  // Override the type of _queryResults to use our specific type
  protected _queryResults: Array<_productIndexObject> = [];

  // This is a limit to how many queries can be sent to the supplier for any given query.
  protected _httpRequestHardLimit: number = 50;

  // Used to keep track of how many requests have been made to the supplier.
  protected _httpRequstCount: number = 0;

  // If using async requests, this will determine how many of them to batch together (using
  // something like Promise.all()). This is to avoid overloading the users bandwidth and
  // to not flood the supplier with 100+ requests all at once.
  protected _http_request_batch_size: number = 4;

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

  /**
   * Make the query params for the Carolina API
   *
   * @param {string} query - The query to search for
   * @returns {SearchParams} The query params
   */
  protected _makeQueryParams(query: string): SearchParams {
    return {
      /*
      790004999   Chemicals category ID
      836054137   ACS grade
      471891351   Lab grade
      3929848101  Reagent grade
      */
      N: "790004999",
      Nf: "product.cbsLowPrice|GT 0.0||product.startDate|LTEQ 1.7457984E12||product.startDate|LTEQ 1.7457984E12",
      Nr: "AND(product.siteId:100001,OR(product.type:Product),OR(product.catalogId:cbsCatalog))",
      Nrpp: "120",
      Ntt: query,
      noRedirect: "true",
      nore: "y",
      question: query,
      searchExecByFormSubmit: "true",
      tab: "p",
    } as SearchParams;
  }

  /**
   * Query products from the Carolina API
   *
   * @returns {Promise<void>} A promise that resolves when the products are queried
   */
  protected async queryProducts(): Promise<void> {
    const params = this._makeQueryParams(this._query);
    const response = await this.httpGet({ path: "/browse/product-search-results", params });

    if (!response?.ok) {
      throw new Error(`Response status: ${response?.status}`);
    }

    const resultHTML = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(resultHTML, "text/html");

    if (!doc) {
      throw new Error("Failed to load product HTML into DOMParser");
    }

    //type Foo = HTMLElement | HTMLAnchorElement  | HTMLBaseElement;
    const productElements: NodeListOf<Element> = doc.querySelectorAll("div.c-feature-product");

    const elementList: _productIndexObject[] = [];

    const _trimSpaceLike = (txt: string) =>
      txt?.replaceAll(/(^(\\n|\\t|\s)*|(\\n|\\t|\s)*$)/gm, "");

    for (const elem of productElements) {
      const titleElement = elem.querySelector("h3.c-product-title") as HTMLElement;
      const linkElement = elem.querySelector("a.c-product-link") as HTMLAnchorElement;
      const price = elem.querySelector("p.c-product-price") as HTMLElement;
      const count = elem.querySelector("p.c-product-total") as HTMLElement;

      elementList.push({
        url: linkElement.getAttribute("href") as string,
        title: _trimSpaceLike(titleElement?.innerText),
        prices: _trimSpaceLike(price?.innerText),
        count: _trimSpaceLike(count?.innerText),
      });
    }

    this._queryResults = elementList.slice(0, this._limit);
  }

  /**
   * Parse the products from the Carolina API
   *
   * @returns {Promise<(Product | void)[]>} A promise that resolves to the products
   */
  protected async parseProducts(): Promise<(Product | void)[]> {
    return Promise.all(
      this._queryResults.map((result) => this._getProductData(result) as Promise<Product>),
    );
  }

  /**
   * Get the product data from the Carolina API
   *
   * @param {_productIndexObject} productIndexObject - The product index object
   * @returns {Promise<Product | void>} A promise that resolves to the product data or void if the product has no price
   */
  protected async _getProductData(
    productIndexObject: _productIndexObject,
  ): Promise<Product | void> {
    //try {
    const response = await this.httpGet({
      path: productIndexObject.url,
    });
    if (!response?.ok) {
      throw new Error(`Response status: ${response?.status}`);
    }

    const data = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(data, "text/html");
    if (!doc) {
      throw new Error("Failed to load product HTML into DOMParser");
    }

    const productScriptNonce = doc.querySelector("script[nonce]");
    if (!productScriptNonce) {
      throw new Error("Failed to find product script nonce");
    }

    const productScriptNonceText = productScriptNonce.textContent;
    if (!productScriptNonceText) {
      throw new Error("Failed to find product script nonce text");
    }

    const productScriptNonceTextMatch = productScriptNonceText.match("(?<== )(.*)(?=;\\n)");

    if (!productScriptNonceTextMatch) {
      throw new Error("Failed to find product script nonce text");
    }

    const productAtgJson = JSON.parse(productScriptNonceTextMatch[0]);

    const productData = result(
      productAtgJson,
      "fetch.response.contents.MainContent[0].atgResponse.response.response",
    ) as ProductData;

    if (!productData) {
      throw new Error("Failed to find product data");
    }

    const quantityMatch: QuantityObject | void = parseQuantity(productData.displayName);

    if (!quantityMatch) return;

    // The price can be stored at different locations in the productData object. Select them all then
    // choose the first non-undefined, non-null value.
    const price = (() => {
      const dataLayerPrice = productData.dataLayer?.productPrice?.[0];
      if (dataLayerPrice) return dataLayerPrice;

      const variantPrice =
        productData.familyVariyantProductDetails?.productVariantsResult?.masterProductBean
          ?.skus?.[0]?.priceInfo?.regularPrice?.[0];
      if (variantPrice) return variantPrice;

      return undefined;
    })();

    const priceObj = parsePrice(price as string) || {
      price,
      currencyCode: this._productDefaults.currencyCode,
      currencySymbol: this._productDefaults.currencySymbol,
    };

    const product = {
      ...this._productDefaults,
      ...priceObj,
      supplier: this.supplierName,
      title: productData.displayName,
      url: this._href(productData.canonicalUrl),
      displayQuantity: `${quantityMatch.quantity} ${quantityMatch.uom}`,
      ...quantityMatch,
    };

    return product as Product;
  }
}
