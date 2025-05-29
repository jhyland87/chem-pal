import { isCAS } from "@/helpers/cas";
import { parseQuantity } from "@/helpers/quantity";
import { mapDefined } from "@/helpers/utils";
import { type Product } from "@/types";
import { type ProductObject } from "@/types/chemsavers";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { isValidSearchResponse } from "@/utils/typeGuards/chemsavers";
import SupplierBase from "./supplierBase";

/**
 * Laboratorium Discounter.nl uses a custom script to fetch product data.
 *
 * The script is located in the `script[nonce]` element of the product page.
 *
 * The script is a JSON object that contains the product data.
 * Duh... thanks, AI.
 * @module SupplierChemsavers
 * @category Suppliers
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
   * Executes a product search query and returns matching products
   * @param query - Search term to look for
   * @param limit - The maximum number of results to query for
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
  protected async _queryProducts(
    query: string,
    limit: number = this._limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    try {
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

      this._logger.debug("Query response:", response);

      if (!isValidSearchResponse(response)) {
        this._logger.warn("Bad search response:", response);
        return;
      }

      const products = mapDefined(response.results[0].hits.flat(), (hit: unknown) => {
        if (
          typeof hit !== "object" ||
          hit === null ||
          "document" in hit === false ||
          typeof hit.document !== "object"
        )
          return;
        return hit.document as ProductObject;
      });

      this._logger.debug("Mapped response objects:", products);

      const fuzzResults = this._fuzzyFilter<ProductObject>(query, products);

      this._logger.info("fuzzResults:", fuzzResults);

      return this._initProductBuilders(fuzzResults.slice(0, limit));
    } catch (error) {
      this._logger.error("Error querying products:", error);
      return;
    }
  }

  /**
   * Initialize product builders from Chemsavers search response data.
   * Transforms product listings into ProductBuilder instances, handling:
   * - Basic product information (title, URL, supplier)
   * - Product descriptions and specifications
   * - Product IDs and SKUs
   * - Pricing information with currency details
   * - CAS number extraction from product text
   * - Quantity parsing from product names and descriptions
   * - Grade/purity level extraction
   * - Product categories and classifications
   *
   * @param data - Array of product listings from search results
   * @returns Array of ProductBuilder instances initialized with product data
   * @example
   * ```typescript
   * const results = await this._queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this._initProductBuilders(results);
   *   // Each builder contains parsed product data
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price, product.grade);
   *   }
   * }
   * ```
   */
  protected _initProductBuilders(data: ProductObject[]): ProductBuilder<Product>[] {
    return mapDefined(data, (result) => {
      const builder = new ProductBuilder<Product>(this._baseURL);

      const quantity = parseQuantity(result.name);
      if (quantity === undefined) return;

      builder
        .setBasicInfo(result.name, result.url, this.supplierName)
        .setDescription(result.description)
        .setId(result.id)
        .setSku(result.sku)
        .setPricing(result.price, "USD", "$")
        .setQuantity(quantity.quantity, quantity.uom)
        .setCAS(isCAS(result.CAS) ? result.CAS : "");
      return builder;
    });
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
  protected _makeRequestBody(query: string, limit: number = 100): object {
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
   * @param product - Product object from Laboratorium Discounter
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
  protected async _getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return product;
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns - The title of the product
   */
  protected _titleSelector(data: ProductObject): string {
    return data.name;
  }
}
