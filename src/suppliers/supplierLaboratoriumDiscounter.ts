import { CURRENCY_SYMBOL_MAP } from "@/constants/currency";
import { ProductBuilder } from "@/helpers/productBuilder";
import { isQuantityObject, parseQuantity } from "@/helpers/quantity";
import { firstMap } from "@/helpers/utils";
import {
  type ProductObject,
  type SearchParams,
  type SearchResponse,
} from "@/types/laboratoriumdiscounter";
import { type Product } from "@/types";
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

  /**
   * Constructs a complete search URL for the given query
   * @param query - Search term to look for
   * @returns Fully qualified search URL as string
   * @example
   * ```typescript
   * const url = this._makeQueryUrl("acid");
   * // Returns: https://www.laboratoriumdiscounter.nl/en/search/acid?limit=10&format=json
   * ```
   */
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

  /**
   * Constructs the query parameters for a product search request
   * @returns Object containing all required search parameters
   * @example
   * ```typescript
   * const params = this._makeQueryParams();
   * // Returns: { limit: "10", format: "json" }
   * ```
   */
  protected _makeQueryParams(): SearchParams {
    return {
      limit: this._limit.toString(),
      format: "json",
    };
  }

  /**
   * Validates that a response has the expected structure for a search response
   * @param response - Response object to validate
   * @returns Type predicate indicating if response is a valid SearchResponse
   * @example
   * ```typescript
   * const response = await this._httpGetJson({
   *   path: "/en/search/acid",
   *   params: { format: "json" }
   * });
   * if (this._isResponseOk(response)) {
   *   // Process valid response
   *   console.log(response.collection.products);
   * }
   * ```
   */
  protected _isResponseOk(response: unknown): response is SearchResponse {
    return !!response && typeof response === "object" && "collection" in response;
  }

  /**
   * Executes a product search query and returns matching products
   * @param query - Search term to look for
   * @returns Promise resolving to array of product objects or void if search fails
   * @example
   * ```typescript
   * const products = await this._queryProducts("acid");
   * if (products) {
   *   products.forEach(product => {
   *     console.log(product.title, product.price);
   *   });
   * }
   * ```
   */
  protected async _queryProducts(query: string): Promise<ProductObject[] | void> {
    const params = this._makeQueryParams();

    const response: unknown = await this._httpGetJson({
      path: `/en/search/${query}`,
      params,
    });

    if (!this._isResponseOk(response)) {
      console.log("Bad search response:", response);
      return;
    }

    return Object.values(response.collection.products) satisfies ProductObject[];
  }

  /**
   * Transforms a Laboratorium Discounter product into the common Product type
   * Extracts quantity information from various product fields and normalizes the data
   * @param result - Product object from Laboratorium Discounter
   * @returns Promise resolving to a partial Product object or void if invalid
   * @example
   * ```typescript
   * const products = await this._queryProducts("acid");
   * if (products) {
   *   const product = await this._getProductData(products[0]);
   *   if (product) {
   *     console.log(product.title, product.price, product.quantity, product.uom);
   *   }
   * }
   * ```
   */
  protected async _getProductData(result: ProductObject): Promise<Partial<Product> | void> {
    const quantity = firstMap(parseQuantity, [
      result.code,
      result.sku,
      result.fulltitle,
      result.variant,
    ]);

    if (!isQuantityObject(quantity)) return;

    const builder = new ProductBuilder(this._baseURL);
    return builder
      .setBasicInfo(result.title || result.fulltitle, result.url, this.supplierName)
      .setPricing(result.price.price, "EUR", CURRENCY_SYMBOL_MAP.EUR)
      .setQuantity(quantity.quantity, quantity.uom)
      .setDescription(result.description || "")
      .build();
  }
}
