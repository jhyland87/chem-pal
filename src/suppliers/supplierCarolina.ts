import type { Product } from "types";
import {
  type CarolinaATGResponse,
  type CarolinaContentFolder,
  type CarolinaContentRuleZoneItem,
  type CarolinaMainContentItem,
  type CarolinaProductResponse,
  type CarolinaResultsContainer,
  type CarolinaSearchParams,
  type CarolinaSearchResponse,
  type CarolinaSearchResult,
} from "types/carolina";
import SupplierBase from "./supplierBase";

/**
 * Supplier implementation for Carolina Biological Supply Company.
 *
 * Carolina.com uses Oracle ATG Commerce as their ecommerce platform which has a predictable
 * output format, though very bulky. But very parseable.
 *
 * Product search uses the following endpoints:
 * - Product Search: /browse/product-search-results?tab=p&q=acid
 * - Product Search JSON: /browse/product-search-results?tab=p&format=json&ajax=true&q=acid
 * - Product Details: /:category/:productName/:productId.pr
 * - Product Details JSON: /:category/:productName/:productId.pr?format=json&ajax=true
 *
 * API Documentation:
 * - Swagger UI: https://www.carolina.com/swagger-ui/
 * - OpenAPI Spec: https://www.carolina.com/api/rest/openapi.json
 * - WADL: https://www.carolina.com/api/rest/application.wadl
 *
 * Common API Endpoints:
 * - Product Quick View: /api/rest/cb/product/product-quick-view/:id
 * - Product Details: /api/rest/cb/product/product-details/:id
 * - Search Suggestions: /api/rest/cb/static/fetch-suggestions-for-global-search/:term
 *
 * JSON Format:
 * Append &format=json&ajax=true to any URL to get JSON response
 */
export default class SupplierCarolina
  extends SupplierBase<CarolinaSearchResult, Product>
  implements AsyncIterable<Product>
{
  /** Display name of the supplier */
  public readonly supplierName: string = "Carolina";

  /** Maximum number of results to return */
  protected _limit: number = 5;

  /** Base URL for all API requests */
  protected _baseURL: string = "https://www.carolina.com";

  /** Cached search results from the last query */
  protected _queryResults: Array<CarolinaSearchResult> = [];

  /** Maximum number of HTTP requests allowed per query */
  protected _httpRequestHardLimit: number = 50;

  /** Counter for HTTP requests made during current query */
  protected _httpRequstCount: number = 0;

  /** Number of requests to process in parallel */
  protected _httpRequestBatchSize: number = 4;

  /** Default headers sent with every request */
  protected _headers: HeadersInit = {
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
   * Validates that a response has a successful status code and expected structure
   * @param response - Response object to validate
   * @returns True if response is valid and successful
   */
  protected _isResponseOk(response: unknown): response is CarolinaSearchResponse {
    return (
      !!response &&
      typeof response === "object" &&
      "responseStatusCode" in response &&
      response.responseStatusCode === 200 &&
      "@type" in response &&
      "contents" in response &&
      typeof response.contents === "object"
    );
  }

  /**
   * Performs deep validation of a search response object
   * @param obj - Response object to validate
   * @returns True if the response matches expected Carolina search response structure
   */
  protected _isValidSearchResponse(obj: unknown): obj is CarolinaSearchResponse {
    if (!obj || typeof obj !== "object") {
      console.error("Response is not an object");
      return false;
    }

    try {
      const response = obj as Partial<CarolinaSearchResponse>;

      if (!response.contents) {
        console.error("Response missing contents");
        return false;
      }
      if (!Array.isArray(response.contents.ContentFolderZone)) {
        console.error("ContentFolderZone is not an array");
        return false;
      }
      if (response.contents.ContentFolderZone.length === 0) {
        console.error("ContentFolderZone is empty");
        return false;
      }
      if (!response.contents.ContentFolderZone[0].childRules) {
        console.error("No child rules found");
        return false;
      }
      if (!Array.isArray(response.contents.ContentFolderZone[0].childRules)) {
        console.error("Child rules is not an array");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validating response:", error);
      return false;
    }
  }

  /**
   * Executes a product search query and stores results
   * Fetches products matching the current search query and updates internal results cache
   */
  protected async _queryProducts(query: string): Promise<CarolinaSearchResult[] | void> {
    const params = this._makeQueryParams(query);

    const response: unknown = await this._httpGetJson({
      path: "/browse/product-search-results",
      params,
    });

    if (!this._isResponseOk(response)) {
      console.warn("Response status:", response);
      return;
    }

    const results = await this._extractSearchResults(response);
    return results.slice(0, this._limit);
  }

  /**
   * Extracts product search results from a response object
   * Navigates through nested response structure to find product listings
   * @param response - Raw response object from search request
   * @returns Array of validated search result items
   */
  protected _extractSearchResults(response: unknown): CarolinaSearchResult[] {
    try {
      if (!this._isValidSearchResponse(response)) {
        console.error("Invalid response structure");
        return [];
      }

      const contentFolder = response.contents.ContentFolderZone[0];
      if (!contentFolder?.childRules?.[0]?.ContentRuleZone) {
        console.error("No content rules found");
        return [];
      }

      const pageContent = contentFolder.childRules[0].ContentRuleZone[0];
      if (!pageContent?.contents?.MainContent) {
        console.error("No MainContent found");
        return [];
      }

      const mainContentItems = pageContent.contents.MainContent;
      const pluginSlotContainer = mainContentItems.find((item: CarolinaMainContentItem) =>
        item.contents?.ContentFolderZone?.some(
          (folder: CarolinaContentFolder) => folder.folderPath === "Products - Search",
        ),
      );

      if (!pluginSlotContainer?.contents?.ContentFolderZone) {
        console.error("No Products - Search folder found");
        return [];
      }

      const productsFolder = pluginSlotContainer.contents.ContentFolderZone.find(
        (folder: CarolinaContentFolder) => folder.folderPath === "Products - Search",
      );

      if (!productsFolder?.childRules?.[0]?.ContentRuleZone) {
        console.error("No content rules in Products folder");
        return [];
      }

      const resultsContainer = productsFolder.childRules[0].ContentRuleZone.find(
        (zone: CarolinaContentRuleZoneItem): zone is CarolinaResultsContainer => {
          return (
            zone["@type"] === "ResultsContainer" &&
            Array.isArray((zone as Partial<CarolinaResultsContainer>).results)
          );
        },
      );

      if (!resultsContainer) {
        console.error("No results container found");
        return [];
      }

      return resultsContainer.results.filter(this._isSearchResultItem);
    } catch (error) {
      console.error("Error extracting search results:", error);
      return [];
    }
  }

  /**
   * Type guard for validating search result items
   * @param result - Object to validate as a search result
   * @returns True if object matches CarolinaSearchResult structure
   */
  protected _isSearchResultItem(result: unknown): result is CarolinaSearchResult {
    if (!result || typeof result !== "object") {
      return false;
    }

    try {
      const item = result as Record<string, unknown>;

      const requiredStringProps = [
        "product.productId",
        "product.productName",
        "product.shortDescription",
        "itemPrice",
        "product.seoName",
        "productUrl",
        "productName",
      ];

      const hasAllRequiredProps = requiredStringProps.every(
        (prop) => prop in item && typeof item[prop] === "string",
      );

      const hasValidBoolean =
        "qtyDiscountAvailable" in item && typeof item.qtyDiscountAvailable === "boolean";

      return hasAllRequiredProps && hasValidBoolean;
    } catch {
      return false;
    }
  }

  /**
   * Type guard for validating product response objects
   * @param obj - Object to validate as a product response
   * @returns True if object matches CarolinaProductResponse structure
   */
  protected _isValidProductResponse(obj: unknown): obj is CarolinaProductResponse {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    const response = obj as Partial<CarolinaProductResponse>;

    if (!response.contents?.MainContent || !Array.isArray(response.contents.MainContent)) {
      return false;
    }

    return !(
      response.contents.MainContent.length === 0 || !response.contents.MainContent[0]?.atgResponse
    );
  }

  /**
   * Type guard for validating ATG response objects
   * @param obj - Object to validate as an ATG response
   * @returns True if object matches CarolinaATGResponse structure
   */
  protected _isATGResponse(obj: unknown): obj is CarolinaATGResponse {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    const response = obj as Partial<CarolinaATGResponse>;

    if (typeof response.result !== "string" || response.result !== "success") {
      return false;
    }

    if (!response.response?.response || typeof response.response.response !== "object") {
      return false;
    }

    const innerResponse = response.response.response;

    const requiredProps = [
      "displayName",
      "longDescription",
      "shortDescription",
      "product",
      "dataLayer",
      "canonicalUrl",
    ];

    return requiredProps.every((prop) => prop in innerResponse);
  }

  /**
   * Extracts ATG response data from a product response
   * @param productResponse - Raw product response object
   * @returns Parsed ATG response data or null if invalid
   */
  protected _extractATGResponse(
    productResponse: unknown,
  ): CarolinaATGResponse["response"]["response"] | null {
    if (!this._isValidProductResponse(productResponse)) {
      return null;
    }

    try {
      const atgResponse = productResponse.contents.MainContent[0].atgResponse;

      if (!this._isATGResponse(atgResponse)) {
        return null;
      }

      return atgResponse.response.response;
    } catch (error) {
      console.error("Error extracting ATG response:", error);
      return null;
    }
  }

  /**
   * Fetches detailed product data for a search result
   * @param result - Search result item to get details for
   * @returns Promise resolving to complete product data or void if failed
   */
  protected async _getProductData(result: CarolinaSearchResult): Promise<Product | void> {
    try {
      const productResponse = await this._httpGetJson({
        path: result.productUrl,
        params: {
          format: "json",
          ajax: true,
        },
      });

      if (!this._isResponseOk(productResponse)) {
        console.warn("Response status:", productResponse);
        return;
      }

      const atgResponse = this._extractATGResponse(productResponse);
      if (!atgResponse) {
        console.error("No ATG response found");
        return;
      }
      console.log("atgResponse:", atgResponse);
      console.log("--------------------------------");
    } catch (error) {
      console.error("Error getting product data:", error);
      return;
    }
  }
}
