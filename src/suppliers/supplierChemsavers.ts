import { isCAS } from "@/helpers/cas";
import { parseQuantity } from "@/helpers/quantity";
import { mapDefined } from "@/helpers/utils";
import { type Product, Maybe } from "@/types";
import { type ProductObject, type SearchResponse } from "@/types/chemsavers";
import SupplierBase from "./supplierBase";

/**
 * Laboratorium Discounter.nl uses a custom script to fetch product data.
 *
 * The script is located in the `script[nonce]` element of the product page.
 *
 * The script is a JSON object that contains the product data.
 * Duh... thanks, AI.
 * @module SupplierChemsavers
 * @category Supplier
 */
export default class SupplierChemsavers
  extends SupplierBase<ProductObject, Product>
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Chemsavers";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.chemsavers.com";

  protected _apiURL: string = "0ul35zwtpkx14ifhp-1.a1.typesense.net";

  // Override the type of _queryResults to use our specific type
  protected _queryResults: Array<ProductObject> = [];

  // Used to keep track of how many requests have been made to the supplier.
  protected _httpRequstCount: number = 0;

  protected _apiKey: string = "iPltuzpMbSZEuxT0fjPI0Ct9R1UBETTd";

  // HTTP headers used as a basis for all queries.
  protected _headers: HeadersInit = {
    /* eslint-disable */
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "content-type": "text/plain",
    pragma: "no-cache",
    priority: "u=1, i",
    "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "sec-gpc": "1",
    /* eslint-enable */
  };

  /**
   * Validates if an unknown object matches the ProductObject type structure.
   *
   * Checks for required properties and their types:
   * - CAS: string
   * - id: string
   * - inventoryLevel: number
   * - name: string
   * - product_id: number
   * - retailPrice: number
   * - salePrice: number
   * - price: number
   * - sku: string
   * - upc: string
   * - url: string
   *
   * @param response - The object to validate
   * @returns A type predicate indicating if the response is a valid ProductObject
   */
  protected _isValidSearchResponseItem(response: unknown): response is ProductObject {
    if (typeof response !== "object" || response === null) return false;
    if (
      "document" in response === false ||
      response.document === undefined ||
      typeof response.document !== "object"
    )
      return false;

    const requiredResultsProps = {
      /* eslint-disable */
      CAS: "string",
      id: "string",
      inventoryLevel: "number",
      name: "string",
      product_id: "number",
      retailPrice: "number",
      salePrice: "number",
      price: "number",
      sku: "string",
      upc: "string",
      url: "string",
      /* eslint-enable */
    };

    return Object.entries(requiredResultsProps).every(([key, val]) => {
      const document = response.document as Record<string, unknown>;
      return key in document && typeof document[key] === val;
    });
  }

  /**
   * Validates if an unknown object matches the SearchResponse type structure.
   *
   * Performs the following validations:
   * 1. Checks if response is a non-null object with a 'results' property
   * 2. Validates that results is a non-empty array
   * 3. Ensures the first result has a 'hits' property
   * 4. Verifies each hit is a valid ProductObject using _isValidSearchResponseItem
   *
   * Note: All errors are caught and return false - this method will never throw.
   *
   * @param response - The object to validate
   * @returns A type predicate indicating if the response is a valid SearchResponse
   */
  protected _isValidSearchResponse(response: unknown): response is SearchResponse {
    try {
      if (typeof response !== "object" || response === null || !("results" in response)) {
        return false;
      }

      const { results } = response as { results: unknown };

      if (
        !Array.isArray(results) ||
        results.length === 0 ||
        typeof results[0] !== "object" ||
        !results[0] ||
        !("hits" in results[0])
      ) {
        return false;
      }

      return results[0].hits.every(this._isValidSearchResponseItem);
    } catch {
      return false;
    }
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
  protected async _queryProducts(query: string): Promise<Maybe<ProductObject[]>> {
    const body = this._makeRequestBody(query);

    const response: unknown = await this._httpPostJson({
      path: `/multi_search`,
      host: this._apiURL,
      params: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "x-typesense-api-key": this._apiKey,
      },
      //headers: this._headers,
      body,
    });

    console.log("Query response:", response);

    if (!this._isValidSearchResponse(response)) {
      console.log("Bad search response:", response);
      return;
    }

    const products = mapDefined((hit) => {
      if ("document" in hit === false) return undefined;
      return hit.document as ProductObject;
    }, response.results[0].hits.flat());

    return products;
  }

  /**
   * Creates the request body for the Typesense search API.
   *
   * Constructs a search request object that:
   * - Searches across name, CAS, and SKU fields
   * - Highlights matches in these fields
   * - Returns paginated results based on the specified limit
   * - Uses the 'products' collection
   *
   * @param query - The search term to look for in the product database
   * @param limit - Maximum number of results to return (defaults to this._limit)
   * @returns An object containing the search configuration for the Typesense API
   */
  protected _makeRequestBody(query: string, limit: number = this._limit): object {
    /* eslint-disable */
    return {
      searches: [
        {
          query_by: "name, CAS, sku",
          highlight_full_fields: "name, CAS, sku",
          collection: "products",
          q: query,
          page: 0,
          per_page: limit,
        },
      ],
    };
    /* eslint-enable */
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
    console.log("Products iterating over:", result);

    const quantity = parseQuantity(result.name);
    if (quantity === undefined) return;

    return {
      title: result.name,
      supplier: this.supplierName,
      cas: isCAS(result.CAS) ? result.CAS : undefined,
      price: result.price,
      currencySymbol: "$",
      currencyCode: "USD",
      description: result.description,
      url: result.url,
      id: result.id,
      sku: result.sku,
      ...quantity,
    } satisfies Partial<Product>;
  }
}
