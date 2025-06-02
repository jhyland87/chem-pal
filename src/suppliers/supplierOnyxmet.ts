import { findCAS } from "@/helpers/cas";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import { isSearchResultItem } from "@/utils/typeGuards/onyxmet";
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
  extends SupplierBase<OnyxMetSearchResultResponse, Product>
  implements AsyncIterable<Product>
{
  // Display name of the supplier used for UI and logging
  public readonly supplierName: string = "Onyxmet";

  // Base URL for all API and web requests to Onyxmet
  public readonly baseURL: string = "https://onyxmet.com";

  // Shipping scope for Onyxmet
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  // This is used to determine the currency and other country-specific information.
  public readonly country: CountryCode = "CA";

  // Cached search results from the last query execution
  protected queryResults: OnyxMetSearchResultResponse[] = [];

  // Maximum number of HTTP requests allowed per search query
  // Used to prevent excessive requests to supplier
  protected httpRequestHardLimit: number = 50;

  // Counter for HTTP requests made during current query execution
  protected httpRequstCount: number = 0;

  // Number of requests to process in parallel when fetching product details
  protected httpRequestBatchSize: number = 5;

  /**
   * Sets up the supplier by setting the display to list.
   * @returns A promise that resolves when the setup is complete.
   */
  protected async setup(): Promise<void> {
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
   * const results = await supplier.queryProducts("acetone");
   * if (results) {
   *   console.log(`Found ${results.length} products`);
   *   console.log("First product:", results[0].title);
   * }
   * ```
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    this.logger.log("query:", query);

    const searchResponse = await this.httpGetHtml({
      path: "index.php",
      params: {
        term: query,
        route: "product/search/json",
      },
    });

    if (!searchResponse) {
      this.logger.error("No search response");
      return;
    }

    const data = JSON.parse(searchResponse);

    this.logger.debug("all search results:", data);

    const fuzzResults = this.fuzzyFilter<OnyxMetSearchResultItem>(query, data);

    return this.initProductBuilders(fuzzResults.splice(0, limit));
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
   * const results = await this.queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this.initProductBuilders(results);
   *   // Each builder contains parsed product data
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price, product.grade);
   *   }
   * }
   * ```
   */
  protected initProductBuilders(data: OnyxMetSearchResultItem[]): ProductBuilder<Product>[] {
    return mapDefined(data, (item) => {
      if (!isSearchResultItem(item)) {
        this.logger.warn("Invalid search result item:", item);
        return;
      }

      const builder = new ProductBuilder<Product>(this.baseURL);

      builder.setBasicInfo(item.label, item.href, this.supplierName);
      builder.setDescription(item.description);
      return builder;
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
   * const fullProduct = await supplier.getProductData(partialProduct);
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
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    this.logger.debug("Querying data for partialproduct:", product);

    const productResponse = await this.httpGetHtml({
      path: product.get("url"),
    });

    if (!productResponse) {
      this.logger.warn("No product response");
      return;
    }

    this.logger.debug("productResponse:", productResponse);

    const parser = new DOMParser();
    const parsedHTML = parser.parseFromString(productResponse, "text/html");
    const content = parsedHTML.querySelector("#content");

    if (!content) {
      this.logger.warn("No content for product");
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
      this.logger.warn("No price for product");
      return;
    }
    const quantity = parseQuantity(title);

    if (!quantity) {
      this.logger.warn("No quantity for product");
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
   * const title = this.titleSelector(searchResult);
   * console.log("Product title:", title);
   * // Output: "Sodium Chloride, ACS Grade"
   * ```
   */
  protected titleSelector(data: OnyxMetSearchResultItem): string {
    return data.label;
  }
}
