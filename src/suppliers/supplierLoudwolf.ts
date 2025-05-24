/**
 * Abstract base class for WooCommerce suppliers that implements product fetching functionality.
 * Extends the base supplier class and provides WooCommerce-specific implementation.
 */
import type { Product } from "@/types";
import * as cheerio from "cheerio";
import SupplierBase from "./supplierBase";

type CheerioElement = cheerio.Cheerio<Element>;
/**
 *
 */
export default class SupplierLoudwolf
  extends SupplierBase<CheerioElement, Product>
  implements AsyncIterable<Product>
{
  /** Display name of the supplier */
  public readonly supplierName: string = "Loudwolf";

  /** Maximum number of results to return */
  protected _limit: number = 15;

  /** Base URL for all API requests */
  protected _baseURL: string = "https://www.loudwolf.com/";

  /** Cached search results from the last query */
  protected _queryResults: Array<CheerioElement> = [];

  /** Maximum number of HTTP requests allowed per query */
  protected _httpRequestHardLimit: number = 50;

  /** Counter for HTTP requests made during current query */
  protected _httpRequstCount: number = 0;

  /** Number of requests to process in parallel */
  protected _httpRequestBatchSize: number = 5;

  /**
   * Queries WooCommerce products based on a search string.
   * Makes a GET request to the WooCommerce REST API products endpoint with the provided search term.
   *
   * @param query - The search term to query products
   * @returns Promise resolving to an array of WooCommerce product items
   * @throws Error if the search response is invalid
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBaseWoocommerce {
   *   async searchProducts(term: string) {
   *     const products = await this._queryProducts(term);
   *     return products;
   *   }
   * }
   *
   * const supplier = new MySupplier();
   * const products = await supplier.searchProducts("acetone");
   * ```
   */
  protected async _queryProducts(query: string): Promise<void | CheerioElement[]> {
    localStorage.setItem("display", "list");

    console.log("query:", query);

    const searchResponse = await this._httpGetHtml({
      path: "/storefront/index.php?route=product/search",
      params: {
        search: query,
        route: "product/search",
        limit: this._limit,
      },
    });

    if (!searchResponse) {
      console.error("No search response");
      return;
    }

    console.log("searchResponse:", searchResponse);

    const $ = cheerio.load(searchResponse);

    const results = $("div.product-layout.product-list");

    console.log("Loudwolf results:", results);
    for (const result of results) {
      const title = $(result).find("div.caption h4 a").text().trim();
      const price = $(result).find("div.caption > p.price").text().trim();
      const description = $(result).find("div.caption > p:nth-child(2)").text().trim();
      const url = $(result).find("div.caption h4 a").attr("href");

      console.log("Loudwolf product:", { title, price, description, url });
    }
    return results as unknown as CheerioElement[];
  }

  /**
   * Transforms a WooCommerce product item into the common Product type.
   * Fetches additional product details, extracts quantity and CAS number information,
   * and builds a standardized Product object.
   *
   * @param product - WooCommerce product item to transform
   * @returns Promise resolving to a partial Product object or void if invalid
   *
   * @example
   * ```typescript
   * const searchResults = await this._queryProducts("acetone");
   * if (searchResults.length > 0) {
   *   const productData = await this._getProductData(searchResults[0]);
   *   if (productData) {
   *     console.log("Transformed product:", {
   *       name: productData.name,
   *       cas: productData.cas,
   *       price: productData.price
   *     });
   *   }
   * }
   * ```
   */
  protected async _getProductData(product: object): Promise<Partial<Product> | void> {
    console.log("product:", product);
    return;
  }
}
