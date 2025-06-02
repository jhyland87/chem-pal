import { findCAS } from "@/helpers/cas";
import { parsePrice } from "@/helpers/currency";
import { isQuantityObject, parseQuantity } from "@/helpers/quantity";
import { firstMap } from "@/helpers/utils";

import ProductBuilder from "@/utils/ProductBuilder";
import {
  isATGResponse,
  isResponseOk,
  isSearchResultItem,
  isValidProductResponse,
  isValidSearchResponse,
} from "@/utils/typeGuards/carolina";
import SupplierBase from "./supplierBase";

/**
 * Implementation of the Carolina Biological Supply Company supplier.
 * Provides product search and data extraction functionality for Carolina.com.
 *
 * @remarks
 * Carolina.com uses Oracle ATG Commerce as their ecommerce platform which has a predictable
 * output format, though very bulky. But very parseable.
 *
 * Product search uses the following endpoints:
 * - Product Search: `/browse/product-search-results?tab=p&q=acid`
 * - Product Search JSON: `/browse/product-search-results?tab=p&format=json&ajax=true&q=acid`
 * - Product Details: `/:category/:productName/:productId.pr`
 * - Product Details JSON: `/:category/:productName/:productId.pr?format=json&ajax=true`
 *
 * API Documentation:
 * - Swagger UI: `https://www.carolina.com/swagger-ui/`
 * - OpenAPI Spec: `https://www.carolina.com/api/rest/openapi.json`
 * - WADL: `https://www.carolina.com/api/rest/application.wadl`
 *
 * Common API Endpoints:
 * - Product Quick View: `/api/rest/cb/product/product-quick-view/:id`
 * - Product Details: `/api/rest/cb/product/product-details/:id`
 * - Search Suggestions: `/api/rest/cb/static/fetch-suggestions-for-global-search/:term`
 *
 * JSON Format:
 * Append `&format=json&ajax=true` to any URL to get JSON response
 *
 * @category Suppliers
 */
export default class SupplierCarolina
  extends SupplierBase<CarolinaSearchResult, Product>
  implements AsyncIterable<Product>
{
  /** Display name of the supplier */
  public readonly supplierName: string = "Carolina";

  /** Base URL for all API requests */
  public readonly baseURL: string = "https://www.carolina.com";

  // Shipping scope for Carolina
  public readonly shipping: ShippingRange = "domestic";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  /** Cached search results from the last query */
  protected queryResults: Array<CarolinaSearchResult> = [];

  /** Maximum number of HTTP requests allowed per query */
  protected httpRequestHardLimit: number = 50;

  /** Counter for HTTP requests made during current query */
  protected httpRequstCount: number = 0;

  /** Number of requests to process in parallel */
  protected httpRequestBatchSize: number = 5;

  /** Default headers sent with every request */
  protected headers: HeadersInit = {
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
   * Constructs the query parameters for a product search request
   * @param query - Search term to look for
   * @returns Object containing all required search parameters
   */
  protected _makeQueryParams(query: string): CarolinaSearchParams {
    return {
      /* eslint-disable */
      tab: "p",
      "product.type": "Product",
      "product.productTypes": "chemicals",
      facetFields: "product.productTypes",
      format: "json",
      ajax: true,
      viewSize: 300,
      q: query,
      /* eslint-enable */
    } satisfies CarolinaSearchParams;
  }

  /**
   * Executes a product search query and stores results
   * Fetches products matching the current search query and updates internal results cache
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const params = this._makeQueryParams(query);

    const response: unknown = await this.httpGetJson({
      path: "/browse/product-search-results",
      params,
    });

    if (!isResponseOk(response)) {
      this.logger.warn("Response status:", response);
      return;
    }

    const results = await this._extractSearchResults(response);

    const fuzzResults = this.fuzzyFilter<CarolinaSearchResult>(query, results);
    this.logger.info("fuzzResults:", fuzzResults);

    return this.initProductBuilders(fuzzResults.slice(0, limit));
  }

  /**
   * Initialize product builders from Carolina search response data.
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
  protected initProductBuilders(data: CarolinaSearchResult[]): ProductBuilder<Product>[] {
    return data.map((result) => {
      const builder = new ProductBuilder(this.baseURL)
        .setBasicInfo(result.productName, result.productUrl, this.supplierName)
        .setPricing(parsePrice(result.itemPrice) as ParsedPrice);
      const casNo = findCAS(result["product.shortDescription"]);
      if (typeof casNo === "string") builder.setCAS(casNo);
      return builder;
      //.setQuantity(result.qtyDiscountAvailable, "1")
      //.setDescription(result.shortDescription)
      //.setCAS(result.casNumber)
    });
  }

  /**
   * Extracts product search results from a response object
   * Navigates through nested response structure to find product listings
   * @param response - Raw response object from search request
   * @returns Array of validated search result items
   */
  protected _extractSearchResults(response: unknown): CarolinaSearchResult[] {
    try {
      if (!isValidSearchResponse(response)) {
        this.logger.warn("Invalid response structure");
        return [];
      }

      const contentFolder = response.contents.ContentFolderZone[0];
      if (!contentFolder?.childRules?.[0]?.ContentRuleZone) {
        this.logger.warn("No content rules found");
        return [];
      }

      const pageContent = contentFolder.childRules[0].ContentRuleZone[0];
      if (!pageContent?.contents?.MainContent) {
        this.logger.warn("No MainContent found");
        return [];
      }

      const mainContentItems = pageContent.contents.MainContent;
      const pluginSlotContainer = mainContentItems.find((item: MainContentItem) =>
        item.contents?.ContentFolderZone?.some(
          (folder: ContentFolder) => folder.folderPath === "Products - Search",
        ),
      );

      if (!pluginSlotContainer?.contents?.ContentFolderZone) {
        this.logger.warn("No Products - Search folder found");
        return [];
      }

      const productsFolder = pluginSlotContainer.contents.ContentFolderZone.find(
        (folder: ContentFolder) => folder.folderPath === "Products - Search",
      );

      if (!productsFolder?.childRules?.[0]?.ContentRuleZone) {
        this.logger.warn("No content rules in Products folder");
        return [];
      }

      const resultsContainer = productsFolder.childRules[0].ContentRuleZone.find(
        (zone: ContentRuleZoneItem): zone is ResultsContainer => {
          return (
            zone["@type"] === "ResultsContainer" &&
            Array.isArray((zone as Partial<ResultsContainer>).results)
          );
        },
      );

      if (!resultsContainer) {
        this.logger.warn("No results container found");
        return [];
      }

      return resultsContainer.results.filter(isSearchResultItem);
    } catch (error) {
      this.logger.error("Error extracting search results:", error);
      return [];
    }
  }

  /**
   * Extracts the relevant product data from an ATG response object
   * Navigates through the nested response structure to find product information
   * @param productResponse - Raw ATG response object
   * @returns Product data from response or null if invalid/not found
   * @example
   * ```typescript
   * const response = await this.httpGetJson({
   *   path: `/api/rest/cb/product/product-quick-view/${productId}`
   * });
   * const productData = this._extractATGResponse(response);
   * if (productData) {
   *   console.log(productData.products[0]);
   * }
   * ```
   */
  protected _extractATGResponse(productResponse: unknown): ATGResponse["response"] | null {
    if (!isValidProductResponse(productResponse)) {
      return null;
    }

    try {
      const atgResponse = productResponse.contents.MainContent[0].atgResponse;

      if (!isATGResponse(atgResponse)) {
        return null;
      }

      return atgResponse.response.response;
    } catch (error) {
      this.logger.warn("Error extracting ATG response:", error);
      return null;
    }
  }

  /**
   * Transforms a Carolina search result into the common Product type
   * Makes additional API calls if needed to get complete product details
   * @param product - Carolina search result to transform
   * @returns Promise resolving to a partial Product object or void if invalid
   * @example
   * ```typescript
   * const searchResults = await this.queryProducts("acid");
   * if (searchResults) {
   *   const product = await this.getProductData(searchResults[0]);
   *   if (product) {
   *     console.log(product.title, product.price);
   *   }
   * }
   * ```
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    try {
      if (product instanceof ProductBuilder === false) {
        this.logger.warn("Invalid product object - Expected ProductBuilder instance:", product);
        return;
      }

      const productResponse = await this.httpGetJson({
        path: product.get("url"),
        params: {
          format: "json",
          ajax: true,
        },
      });

      if (!isResponseOk(productResponse)) {
        this.logger.warn("Response status:", productResponse);
        return;
      }

      const atgResponse = this._extractATGResponse(productResponse);

      console.log("atgResponse:", atgResponse);
      console.log("familyVariyantProductDetails:", atgResponse?.familyVariyantProductDetails);
      console.log("familyVariyantDisplayName:", atgResponse?.familyVariyantDisplayName);

      if (!atgResponse) {
        this.logger.warn("No ATG response found");
        return;
      }
      this.logger.debug("atgResponse:", atgResponse);

      const productPrice = parsePrice(atgResponse.dataLayer.productPrice[0]);
      if (!productPrice) {
        this.logger.warn("No product price found");
        return;
      }

      product.setPricing(productPrice);

      const quantity = firstMap(parseQuantity, [
        atgResponse.displayName,
        atgResponse.shortDescription,
        //atgResponse?.standardResult?.productName,
      ]);

      if (!isQuantityObject(quantity)) {
        this.logger.warn("No quantity object found");
        return;
      }

      product.setQuantity(quantity);

      const casNo = firstMap(findCAS, [
        atgResponse.displayName,
        atgResponse.shortDescription,
        atgResponse.longDescription,
        //atgResponse?.standardResult?.productName,
      ]);

      if (casNo) product.setCAS(casNo);

      product.setDescription(atgResponse.shortDescription);

      /*
      product.addVariants([
        {
          title: "100g",
          price: productPrice.price,
          quantity: 100,
          uom: "g",
        },
      ]);
      */

      return product;
    } catch (error) {
      this.logger.error("Error getting product data:", error);
      return;
    }
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns - The title of the product
   */
  protected titleSelector(data: CarolinaSearchResult): string {
    return data.productName;
  }
}
