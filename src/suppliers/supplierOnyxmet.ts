import { findCAS, isCAS } from "@/helpers/cas";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import type { Maybe, Product } from "@/types";
import type { SearchResultItem, SearchResultResponse } from "@/types/onyxmet";
import * as cheerio from "cheerio";
import SupplierBase from "./supplierBase";

/**
 * Supplier implementation for Onyxmet chemical supplier.
 * Extends the base supplier class and provides Onyxmet-specific implementation
 * for product searching and data extraction.
 *
 * @typeParam S - The supplier-specific product type (Partial<Product>)
 * @typeParam T - The common Product type that all suppliers map to
 *
 * @example
 * ```typescript
 * const supplier = new SupplierOnyxmet("sodium chloride", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log("Found product:", product.title, product.price);
 * }
 * ```
 */
export default class SupplierOnyxmet
  extends SupplierBase<SearchResultResponse, Product>
  implements AsyncIterable<Product>
{
  /**
   * Display name of the supplier used for UI and logging
   * @readonly
   */
  public readonly supplierName: string = "OnyxMet";

  /**
   * Maximum number of results to return per search query
   * @defaultValue 15
   */
  protected _limit: number = 15;

  /**
   * Base URL for all API and web requests to Onyxmet
   * @defaultValue "https://onyxmet.com"
   */
  protected _baseURL: string = "https://onyxmet.com";

  /**
   * Cached search results from the last query execution
   * @defaultValue []
   */
  protected _queryResults: SearchResultResponse[] = [];

  /**
   * Maximum number of HTTP requests allowed per search query
   * Used to prevent excessive requests to supplier
   * @defaultValue 50
   */
  protected _httpRequestHardLimit: number = 50;

  /**
   * Counter for HTTP requests made during current query execution
   * @defaultValue 0
   */
  protected _httpRequstCount: number = 0;

  /**
   * Number of requests to process in parallel when fetching product details
   * @defaultValue 5
   */
  protected _httpRequestBatchSize: number = 5;

  /**
   * Sets up the supplier by setting the display to list.
   * @returns A promise that resolves when the setup is complete.
   */
  protected async _setup(): Promise<void> {
    localStorage.setItem("display", "list");
  }

  /**
   * Queries OnyxMet products based on a search string.
   * Makes a GET request to the OnyxMet search endpoint and parses the HTML response
   * to extract basic product information.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to an array of partial product objects or void if search fails
   *
   * @example
   * ```typescript
   * const supplier = new SupplierOnyxmet("acetone", 10, new AbortController());
   * const results = await supplier._queryProducts("acetone");
   * if (results) {
   *   console.log(`Found ${results.length} products`);
   *   console.log("First product:", results[0].title);
   * }
   * ```
   */
  protected async _queryProducts(
    query: string,
    limit: number = this._limit,
  ): Promise<SearchResultResponse[] | void> {
    this._logger.log("query:", query);

    const searchResponse = await this._httpGetHtml({
      path: "index.php?route=&term=potassium",
      params: {
        term: query,
        route: "product/search/json",
      },
    });

    if (!searchResponse) {
      this._logger.error("No search response");
      return;
    }

    const data = JSON.parse(searchResponse);

    this._logger.debug("all search results:", data);
    return data.splice(0, limit);
  }

  protected _isSearchResultItem(product: unknown): product is SearchResultItem {
    return (
      typeof product === "object" &&
      product !== null &&
      "label" in product &&
      "image" in product &&
      "description" in product &&
      "href" in product
    );
  }

  /**
   * Transforms a partial product item into a complete Product object.
   * Fetches additional product details from the product page, extracts quantity, CAS number,
   * and other specifications, then builds a standardized Product object.
   *
   * @param product - Partial product object to transform
   * @returns Promise resolving to a complete Product object or void if transformation fails
   *
   * @example
   * ```typescript
   * const partialProduct = {
   *   title: "Sodium Chloride",
   *   url: "/product/123",
   *   price: 19.99
   * };
   * const fullProduct = await supplier._getProductData(partialProduct);
   * if (fullProduct) {
   *   console.log("Complete product:", {
   *     title: fullProduct.title,
   *     cas: fullProduct.cas,
   *     quantity: fullProduct.quantity,
   *     uom: fullProduct.uom
   *   });
   * }
   * ```
   */
  protected async _getProductData(product: SearchResultResponse): Promise<Maybe<Partial<Product>>> {
    this._logger.debug("Querying data for partialproduct:", product);

    if (!this._isSearchResultItem(product)) {
      this._logger.warn("Invalid product");
      return;
    }

    const productResponse = await this._httpGetHtml({
      path: product.href,
    });

    if (!productResponse) {
      this._logger.warn("No product response");
      return;
    }

    this._logger.debug("productResponse:", productResponse);

    const $ = cheerio.load(productResponse);
    const $content = $("#content");

    const cas = findCAS(product.description);
    const title = $content.find("h3.product-title").text().trim();
    const statusTxt = $content
      .find("span:contains('Availability')")
      .parent()
      .text()
      .split(":")[1]
      .trim();
    const productPrice = $content.find(".product-price").text().trim();

    const price = parsePrice(productPrice);

    if (!price) {
      this._logger.warn("No price for product");
      return;
    }
    const quantity = parseQuantity(title);

    if (!quantity) {
      this._logger.warn("No quantity for product");
      return;
    }
    /*
    const $productElem = $content.find("#product");

    const availabileOptionHeader = $productElem.find(".product-option");


    let options;
    if (availabileOptionHeader.length > 0) {
      options = $productElem
        .find("input[name^='option']")
        .parent()
        .map((idx, elem) => $(elem).text().trim())
        .toArray()
        .reduce(
          (acc, option) => {
            const match = option.match(/^([0-9]+[a-zA-Z]+)\s*\n\s*\(([0-9]+\.[0-9]+\p{Sc})/u);

            if (!match) return acc;

            const [, qty, prc] = match;
            const thisOption = {};
            const optionPrice = parsePrice(prc);
            const optionQuantity = parseQuantity(qty);

            if (optionPrice) Object.assign(thisOption, optionPrice);
            if (optionQuantity) Object.assign(thisOption, optionQuantity);

            if (Object.keys(thisOption).length > 0) {
              acc.push(thisOption);
            }

            return acc;
          },
          [] as Array<Record<string, number | string>>,
        );

      this._logger.debug("options:", options);
    }
    */

    return {
      title,
      cas: cas && isCAS(cas) ? cas : undefined,
      statusTxt,
      url: product.href,
      supplier: this.supplierName,
      ...quantity,
      ...price,
    } satisfies Partial<Product>;
  }
}
