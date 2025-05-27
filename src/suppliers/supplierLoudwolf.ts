import { findCAS } from "@/helpers/cas";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { mapDefined } from "@/helpers/utils";
import type { Product } from "@/types";
import { ProductBuilder } from "@/utils/ProductBuilder";
import * as cheerio from "cheerio";
import chunk from "lodash/chunk";
import SupplierBase from "./supplierBase";

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
   * @defaultValue "https://www.loudwolf.com"
   */
  protected _baseURL: string = "https://www.loudwolf.com";

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
   * Sets up the supplier by setting the display to list.
   * @returns A promise that resolves when the setup is complete.
   */
  protected async _setup(): Promise<void> {}

  /**
   * Queries Loudwolf products based on a search string.
   * Makes a GET request to the Loudwolf search endpoint and parses the HTML response
   * to extract basic product information.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to query for
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
  protected async _queryProducts(
    query: string,
    limit: number = this._limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    this._logger.log("query:", query);
    localStorage.setItem("display", "list");

    const searchResponse = await this._httpGetHtml({
      path: "/storefront/index.php",
      params: {
        search: encodeURIComponent(query),
        route: "product/search",
        limit,
      },
    });

    if (!searchResponse) {
      this._logger.error("No search response");
      return;
    }

    this._logger.log("searchResponse:", searchResponse);

    return this._initProductBuilders(searchResponse);

    /*
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
      */
  }

  /**
   * Initialize product builders from Loudwolf HTML search response data.
   * Transforms HTML product listings into ProductBuilder instances, handling:
   * - Basic product information (title, URL, supplier)
   * - Pricing information with currency details
   * - Product descriptions
   * - Product IDs and SKUs
   * - HTML parsing of product listings
   * - Price extraction from formatted strings
   * - URL and ID extraction from product links
   *
   * @param data - HTML string containing product listings
   * @returns Array of ProductBuilder instances initialized with product data
   * @example
   * ```typescript
   * const results = await this._queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this._initProductBuilders(results);
   *   // Each builder contains parsed product data from HTML
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price, product.id);
   *   }
   * }
   * ```
   */
  protected _initProductBuilders(data: string): ProductBuilder<Product>[] {
    const $ = cheerio.load(data);

    const $elements = $("div.product-layout.product-list");

    return mapDefined($elements.toArray(), (element) => {
      const builder = new ProductBuilder<Product>(this._baseURL);

      const price = parsePrice($(element).find("div.caption > p.price").text().trim());

      if (price === undefined) {
        this._logger.error("No price for product", element);
        return;
      }

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
      const title = $(element).find("div.caption h4 a").text().trim();

      return builder
        .setBasicInfo(title, url.toString(), this.supplierName)
        .setDescription($(element).find("div.caption > p:nth-child(2)").text().trim())
        .setId(id)
        .setPricing(price.price, price.currencyCode, price.currencySymbol);
    });
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
  protected async _getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    this._logger.debug("Querying data for partialproduct:", product);

    if (typeof product === "undefined") {
      this._logger.error("No products to get data for");
      return;
    }

    const productResponse = await this._httpGetHtml({
      path: product.get("url"),
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

    return product.setData(datagridInfo);
  }
}
