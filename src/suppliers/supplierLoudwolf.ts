/**
 * Abstract base class for WooCommerce suppliers that implements product fetching functionality.
 * Extends the base supplier class and provides WooCommerce-specific implementation.
 */
import { findCAS } from "@/helpers/cas";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import type { Maybe, Product } from "@/types";
import * as cheerio from "cheerio";
import chunk from "lodash/chunk";
import SupplierBase from "./supplierBase";

//type CheerioElement = cheerio.Cheerio<Element>;
/**
 * Supplier implementation for Loudwolf chemical supplier.
 * Extends the base supplier class and provides Loudwolf-specific implementation
 * for product searching and data extraction.
 *
 * @typeParam S - The supplier-specific product type (Partial<Product>)
 * @typeParam T - The common Product type that all suppliers map to
 *
 * @example
 * ```typescript
 * const supplier = new SupplierLoudwolf("sodium chloride", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log("Found product:", product.title, product.price);
 * }
 * ```
 */
export default class SupplierLoudwolf
  extends SupplierBase<Partial<Product>, Product>
  implements AsyncIterable<Product>
{
  /**
   * Display name of the supplier used for UI and logging
   * @readonly
   */
  public readonly supplierName: string = "Loudwolf";

  /**
   * Maximum number of results to return per search query
   * @defaultValue 15
   */
  protected _limit: number = 15;

  /**
   * Base URL for all API and web requests to Loudwolf
   * @defaultValue "https://www.loudwolf.com/"
   */
  protected _baseURL: string = "https://www.loudwolf.com/";

  /**
   * Cached search results from the last query execution
   * @defaultValue []
   */
  protected _queryResults: Array<Partial<Product>> = [];

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
   * Queries Loudwolf products based on a search string.
   * Makes a GET request to the Loudwolf search endpoint and parses the HTML response
   * to extract basic product information.
   *
   * @param query - The search term to query products for
   * @returns Promise resolving to an array of partial product objects or void if search fails
   *
   * @example
   * ```typescript
   * const supplier = new SupplierLoudwolf("acetone", 10, new AbortController());
   * const results = await supplier._queryProducts("acetone");
   * if (results) {
   *   console.log(`Found ${results.length} products`);
   *   console.log("First product:", results[0].title);
   * }
   * ```
   */
  protected async _queryProducts(query: string): Promise<Maybe<Partial<Product>[]>> {
    localStorage.setItem("display", "list");

    this._logger.log("query:", query);

    const searchResponse = await this._httpGetHtml({
      path: "/storefront/index.php",
      params: {
        search: query,
        route: "product/search",
        limit: this._limit,
      },
    });

    if (!searchResponse) {
      this._logger.error("No search response");
      return;
    }

    this._logger.log("searchResponse:", searchResponse);

    const $ = cheerio.load(searchResponse);

    const $elements = $("div.product-layout.product-list");

    this._logger.log("Loudwolf results:", $elements);

    return $elements
      .map((index, element) => {
        const price = parsePrice($(element).find("div.caption > p.price").text().trim());
        const href = $(element).find("div.caption h4 a").attr("href");

        if (href === undefined) {
          this._logger.error("No URL for product");
          return;
        }

        const url = new URL(href, this._baseURL);

        const id = url.searchParams.get("product_id");

        if (id === null) {
          this._logger.error("No ID for product");
          return;
        }

        return {
          title: $(element).find("div.caption h4 a").text().trim(),
          description: $(element).find("div.caption > p:nth-child(2)").text().trim(),
          url: href,
          id,
          ...price,
        };
      })
      .toArray();
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
  protected async _getProductData(product: Partial<Product>): Promise<Maybe<Partial<Product>>> {
    this._logger.debug("Querying data for partialproduct:", product);

    if ("url" in product === false || typeof product.url !== "string") {
      this._logger.error("No URL for product");
      return;
    }

    if ("title" in product === false || typeof product.title !== "string") {
      this._logger.error("No title for product");
      return;
    }

    const productResponse = await this._httpGetHtml({
      path: product.url,
    });

    if (!productResponse) {
      this._logger.warn("No product response");
      return;
    }

    this._logger.debug("productResponse:", productResponse);

    const $ = cheerio.load(productResponse);
    const $content = $("#content");

    const dataGrid = $content
      .find("p:contains('CAS')")
      .closest("table.MsoTableGrid")
      .find("p")
      .map((index, element) => {
        const text = $(element).text().trim();
        return text;
      })
      .toArray();

    const datagridInfo = chunk(dataGrid, 2).reduce((acc, [key, value]) => {
      if (key.match(/CAS/i)) {
        acc.cas = findCAS(value.trim()) ?? undefined;
      } else if (key.match(/TOTAL [A-Z]+ OF PRODUCT/i)) {
        const qty = parseQuantity(value);
        if (qty) {
          Object.assign(acc, qty);
        }
      } else if (key.match(/GRADE/i)) {
        acc.grade = value;
      }
      return acc;
    }, {} as Partial<Product>);

    return { ...datagridInfo, ...product, supplier: this.supplierName } satisfies Partial<Product>;
  }
}
