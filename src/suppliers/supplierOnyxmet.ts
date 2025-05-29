import { findCAS } from "@/helpers/cas";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { mapDefined } from "@/helpers/utils";
import type { Product } from "@/types";
import type { SearchResultItem, SearchResultResponse } from "@/types/onyxmet";
import { ProductBuilder } from "@/utils/ProductBuilder";
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
  public readonly supplierName: string = "Onyxmet";

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
  ): Promise<ProductBuilder<Product>[] | void> {
    this._logger.log("query:", query);

    const searchResponse = await this._httpGetHtml({
      path: "index.php",
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

    const fuzzResults = this._fuzzyFilter<SearchResultItem>(query, data);

    return this._initProductBuilders(fuzzResults.splice(0, limit));
  }

  /**
   * Initialize product builders from Onyxmet search response data.
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
  protected _initProductBuilders(data: SearchResultItem[]): ProductBuilder<Product>[] {
    return mapDefined(data, (item) => {
      if (!this._isSearchResultItem(item)) {
        this._logger.warn("Invalid search result item:", item);
        return;
      }

      const builder = new ProductBuilder<Product>(this._baseURL);

      builder.setBasicInfo(item.label, item.href, this.supplierName);
      builder.setDescription(item.description);
      return builder;
    });
  }

  /**
   * Type guard to validate if an object matches the SearchResultItem structure.
   * Checks for the presence and correct types of required properties in Onyxmet search results.
   * Required properties:
   * - label: Product name/title
   * - image: Product image URL or identifier
   * - description: Product description text
   * - href: Product URL or path
   *
   * @param product - The object to validate
   * @returns Type predicate indicating if the object is a valid SearchResultItem
   * @typeguard
   *
   * @example
   * ```typescript
   * // Valid search result item
   * const validItem = {
   *   label: "Sodium Chloride",
   *   image: "nacl.jpg",
   *   description: "High purity NaCl",
   *   href: "/products/nacl"
   * };
   * if (this._isSearchResultItem(validItem)) {
   *   console.log("Valid item:", validItem.label);
   * }
   *
   * // Invalid search result item (missing properties)
   * const invalidItem = {
   *   label: "Sodium Chloride",
   *   image: "nacl.jpg"
   *   // Missing description and href
   * };
   * if (!this._isSearchResultItem(invalidItem)) {
   *   console.log("Invalid item - missing required properties");
   * }
   *
   * // Invalid search result item (wrong type)
   * const wrongType = "not an object";
   * if (!this._isSearchResultItem(wrongType)) {
   *   console.log("Invalid item - not an object");
   * }
   * ```
   */
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
  protected async _getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    this._logger.debug("Querying data for partialproduct:", product);

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
    const content = parsedHTML.querySelector("#content");

    if (!content) {
      this._logger.warn("No content for product");
      return;
    }

    const productData = Array.from(content.querySelectorAll(".desc"))
      .find((element: Element) => element.textContent?.includes("Availability"))
      ?.closest("ul")
      ?.querySelectorAll("li");

    const productInfo = Array.from(productData || []).reduce(
      (acc, element) => {
        const [key, value] = element.textContent?.split(": ") || [];
        if (key && value) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    const cas = findCAS(product.get("description"));
    const title = content?.querySelector("h3.product-title")?.textContent?.trim() || "";
    const statusTxt = productInfo.Availability || "";
    const productPrice = content.querySelector(".product-price")?.textContent?.trim() || "";

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

    return product
      .setPricing(price.price, price.currencyCode, price.currencySymbol)
      .setQuantity(quantity.quantity, quantity.uom)
      .setCAS(cas ?? "")
      .setAvailability(statusTxt ?? "");
  }

  /**
   * Extracts the product title from a search result item.
   * Returns the label property of the search result item, which contains
   * the product name/title in Onyxmet's search response format.
   *
   * @param data - The search result item to extract the title from
   * @returns The product title as a string
   *
   * @example
   * ```typescript
   * const searchResult = {
   *   label: "Sodium Chloride, ACS Grade",
   *   image: "nacl.jpg",
   *   description: "High purity NaCl",
   *   href: "/products/nacl"
   * };
   *
   * const title = this._titleSelector(searchResult);
   * console.log("Product title:", title);
   * // Output: "Sodium Chloride, ACS Grade"
   * ```
   */
  protected _titleSelector(data: SearchResultItem): string {
    return data.label;
  }
}
