/* eslint-disable no-debugger */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { findCAS } from "@/helpers/cas";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { mapDefined } from "@/helpers/utils";
import type { Product } from "@/types";
import { ProductBuilder } from "@/utils/ProductBuilder";
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
    this._logger.log("queryProducts:", { query, limit });
    localStorage.setItem("display", "list");

    const searchResponse = await this._httpGetHtml({
      path: "/storefront/index.php",
      params: {
        search: encodeURIComponent(query),
        route: "product/search",
        limit: 100,
      },
    });

    if (!searchResponse) {
      this._logger.error("No search response");
      return;
    }

    this._logger.log("searchResponse:", searchResponse);

    const $fuzzResults = this._fuzzHtmlResponse(query, searchResponse);
    this._logger.info("fuzzResults:", Array.from($fuzzResults));

    return this._initProductBuilders($fuzzResults.slice(0, limit));

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
   * Parses HTML response and performs fuzzy filtering on product elements.
   * Creates a DOM from the HTML response, selects product elements, and applies
   * fuzzy filtering to find matches for the search query.
   *
   * @param query - The search term to filter products by
   * @param response - The HTML response string containing product listings
   * @returns Array of DOM Elements that match the fuzzy search criteria
   *
   * @example
   * ```typescript
   * const html = await this._httpGetHtml({ path: "/search", params: { q: "acetone" } });
   * if (html) {
   *   const matchingElements = this._fuzzHtmlResponse("acetone", html);
   *   console.log(`Found ${matchingElements.length} matching products`);
   *   // Elements can be used to extract product details
   *   for (const element of matchingElements) {
   *     const title = element.querySelector("h4 a")?.textContent;
   *     console.log("Product:", title);
   *   }
   * }
   * ```
   */
  protected _fuzzHtmlResponse(query: string, response: string): Element[] {
    // Create a new DOM to do the travesing/parsing
    const parser = new DOMParser();
    const parsedHTML = parser.parseFromString(response, "text/html");

    // Select all products by a known selector path
    const products = parsedHTML.querySelectorAll("div.product-layout.product-list");

    // Do the fuzzy filtering using the element found when using this._titleSelector()
    return this._fuzzyFilter<Element>(query, Array.from(products));
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
   * @param $elements - HTML string containing product listings
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
  protected _initProductBuilders($elements: Element[]): ProductBuilder<Product>[] {
    return mapDefined($elements, (element: Element) => {
      const builder = new ProductBuilder<Product>(this._baseURL);

      const priceElem = element.querySelector("div.caption > p.price");
      console.log("priceElem:", priceElem);
      const price = parsePrice(priceElem?.textContent?.trim() || "");

      if (price === undefined) {
        this._logger.error("No price for product", element);
        return;
      }

      const href = element.querySelector("div.caption h4 a")?.getAttribute("href");

      if (!href) {
        this._logger.error("No URL for product");
        return;
      }

      const url = new URL(href, this._baseURL);

      const id = url.searchParams.get("product_id");

      if (id === null) {
        this._logger.error("No ID for product");
        return;
      }
      const title = element.querySelector("div.caption h4 a")?.textContent?.trim() || "";

      return builder
        .setBasicInfo(title, url.toString(), this.supplierName)
        .setDescription(
          element.querySelector("div.caption > p:nth-child(2)")?.textContent?.trim() || "",
        )
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

    const parser = new DOMParser();
    const parsedHTML = parser.parseFromString(productResponse, "text/html");
    const domContent = parsedHTML.querySelector("#content");
    const dataGrid = Array.from(
      domContent?.querySelectorAll("#content .tab-content .MsoTableGrid") || [],
    )
      .find((element) => element.textContent?.trim().match(/CAS/i))
      ?.querySelectorAll("p");

    const dataRows = Array.from(dataGrid || []).map((n) => n.innerText);

    const datagridInfo = chunk(dataRows, 2).reduce((acc, [key, value]) => {
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

  /**
   * Extracts the product title from a DOM Element.
   * Searches for the product title within the product listing element using
   * a specific CSS selector path. Returns an empty string if no title is found.
   *
   * @param data - The DOM Element containing the product listing
   * @returns The product title as a string, or empty string if not found
   *
   * @example
   * ```typescript
   * const element = document.querySelector(".product-layout");
   * if (element) {
   *   const title = this._titleSelector(element);
   *   console.log("Product title:", title);
   *   // Output: "Sodium Chloride, ACS Grade, 500g"
   * }
   * ```
   */
  protected _titleSelector(data: Element): string {
    const title = data.querySelector("div.caption h4 a");
    if (title === null) {
      this._logger.error("No title for product");
      return "";
    }
    return title.textContent?.trim() || "";
  }
}
