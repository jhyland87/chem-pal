import { CURRENCY_SYMBOL_MAP } from "@/constants/currency";
import { ProductBuilder } from "@/helpers/productBuilder";
import { isQuantityObject, parseQuantity } from "@/helpers/quantity";
import { firstMap } from "@/helpers/utils";
import { type Product } from "@/types";
import {
  type PriceObject,
  type ProductObject,
  type SearchParams,
  type SearchResponse,
} from "@/types/laboratoriumdiscounter";
import SupplierBase from "./supplierBase";

/**
 * Laboratorium Discounter.nl uses a custom script to fetch product data.
 *
 * The script is located in the `script[nonce]` element of the product page.
 *
 * The script is a JSON object that contains the product data.
 * @module SupplierLaboratoriumDiscounter
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
   * Type guard to validate PriceObject structure
   * @param price - Object to validate as PriceObject
   * @returns Type predicate indicating if price is a valid PriceObject
   */
  protected _isPriceObject(price: unknown): price is PriceObject {
    if (typeof price !== "object" || price === null) return false;

    const requiredProps = {
      /* eslint-disable */
      price: "number",
      price_incl: "number",
      price_excl: "number",
      price_old: "number",
      price_old_incl: "number",
      price_old_excl: "number",
      /* eslint-enable */
    };

    return Object.entries(requiredProps).every(([key, type]) => {
      return key in price && typeof price[key as keyof typeof price] === type;
    });
  }

  /**
   * Type guard to validate ProductObject structure
   * @param product - Object to validate as ProductObject
   * @returns Type predicate indicating if product is a valid ProductObject
   */
  protected _isProductObject(product: unknown): product is ProductObject {
    if (typeof product !== "object" || product === null) return false;

    const requiredProps = {
      /* eslint-disable */
      id: "number",
      vid: "number",
      image: "number",
      brand: "boolean",
      code: "string",
      ean: "string",
      sku: "string",
      score: "number",
      available: "boolean",
      unit: "boolean",
      url: "string",
      title: "string",
      fulltitle: "string",
      variant: "string",
      description: "string",
      data_01: "string",
      /* eslint-enable */
    };

    const hasRequiredProps = Object.entries(requiredProps).every(([key, type]) => {
      return key in product && typeof product[key as keyof typeof product] === type;
    });

    if (!hasRequiredProps) return false;

    // Validate price object separately
    return "price" in product && this._isPriceObject(product.price);
  }

  /**
   * Validates search parameters structure and values
   * @param params - Parameters to validate
   * @returns Type predicate indicating if params are valid SearchParams
   */
  protected _isValidSearchParams(params: unknown): params is SearchParams {
    if (typeof params !== "object" || params === null) return false;

    const requiredProps = {
      limit: (val: unknown) => typeof val === "string" && !isNaN(Number(val)),
      format: (val: unknown) => val === "json",
    };

    return Object.entries(requiredProps).every(([key, validator]) => {
      return key in params && validator(params[key as keyof typeof params]);
    });
  }

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
    const searchParams = this._makeQueryParams();
    if (!this._isValidSearchParams(searchParams)) {
      throw new Error("Invalid search parameters");
    }

    const encodedQuery = encodeURIComponent(query);
    const url = new URL(`en/search/${encodedQuery}`, this._baseURL);
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
    if (typeof response !== "object" || response === null) return false;

    // Check for required top-level properties
    if (!("page" in response && "request" in response && "collection" in response)) {
      return false;
    }

    const { page, request, collection } = response as SearchResponse;

    // Validate page object
    if (
      typeof page !== "object" ||
      !page ||
      !(
        "search" in page &&
        "session_id" in page &&
        "key" in page &&
        "title" in page &&
        "status" in page
      )
    ) {
      return false;
    }

    // Validate request object
    if (
      typeof request !== "object" ||
      !request ||
      !("url" in request && "method" in request && "get" in request && "device" in request)
    ) {
      return false;
    }

    // Validate collection and products
    if (
      typeof collection !== "object" ||
      !collection ||
      !("products" in collection) ||
      typeof collection.products !== "object"
    ) {
      return false;
    }

    // Validate each product in the collection
    return Object.values(collection.products).every((product) => this._isProductObject(product));
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
    if (!this._isValidSearchParams(params)) {
      console.error("Invalid search parameters:", params);
      return;
    }

    const response: unknown = await this._httpGetJson({
      path: `/en/search/${query}`,
      params,
    });

    if (!this._isResponseOk(response)) {
      console.error("Bad search response:", response);
      return;
    }

    return Object.values(response.collection.products);
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
    try {
      if (!this._isProductObject(result)) {
        console.error("Invalid product object:", result);
        return;
      }

      const quantity = firstMap(parseQuantity, [
        result.code,
        result.sku,
        result.fulltitle,
        result.variant,
      ]);

      if (!isQuantityObject(quantity)) {
        console.debug("Could not parse quantity from product:", {
          code: result.code,
          sku: result.sku,
          fulltitle: result.fulltitle,
          variant: result.variant,
        });
        return;
      }

      const builder = new ProductBuilder(this._baseURL);
      return builder
        .setBasicInfo(result.title || result.fulltitle, result.url, this.supplierName)
        .setPricing(result.price.price, "EUR", CURRENCY_SYMBOL_MAP.EUR)
        .setQuantity(quantity.quantity, quantity.uom)
        .setDescription(result.description || "")
        .build();
    } catch (error) {
      console.error("Error processing product data:", error);
      return;
    }
  }
}
