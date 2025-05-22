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
import { isSearchResultItem } from 'utils/carolinaSearch';
 * Carolina.com uses Oracle ATG Commerce as their ecommerce platform.
 *
 * The ATG Commerce platform uses a custom script to fetch product data.
 * This script is located in the `script[nonce]` element of the product page.
 *
 * The script is a JSON object that contains the product data.
 *
 * Product search for Carolina.com will query the following URL (with `lithium` as the search query):

 * The query params are:
 * - product.productTypes: The product type to search for.
 * - facetFields: The fields to facet on.
 * - defaultFilter: The default filter to apply to the search.
 * - Nr: ???
 * - viewSize: The number of results to return per page.
 * - q: The search query.
 * - noRedirect: Whether to redirect to the search results page.
 * - nore: Whether to return the results in a non-redirecting format.
 * - searchExecByFormSubmit: Whether to execute the search by form submission.
 * - tab: The tab to display the results in.
 * - question: The search query.
 *
 * Carolina.com uses VastCommerce, who does have an API that can be queried. Some useful endpoints are:
 * - https://www.carolina.com/swagger-ui/
 * - https://www.carolina.com/api/rest/openapi.json
 * - https://www.carolina.com/api/rest/cb/product/product-quick-view/863810
 * - https://www.carolina.com/api/rest/cb/cart/specificationDetails/863810
 * - https://www.carolina.com/api/rest/cb/product/product-details/863810
 *    curl -s https://www.carolina.com/api/rest/cb/product/product-details/863810 | jq '.response | fromjson'
 * - https://www.carolina.com/api/rest/cb/static/fetch-suggestions-for-global-search/acid
 * - https://www.carolina.com/api/rest/application.wadl
 * - You can get the JSON value of any page by appending: &format=json&ajax=true
 *   - https://www.carolina.com/chemistry-supplies/chemicals/10171.ct?format=json&ajax=true
 *   - https://www.carolina.com/specialty-chemicals-d-l/16-hexanediamine-6-laboratory-grade-100-ml/867162.pr?format=json&ajax=true
 *      curl -s 'https://www.carolina.com/specialty-chemicals-d-l/16-hexanediamine-6-laboratory-grade-100-ml/867162.pr?format=json&ajax=true' | jq '.contents.MainContent[0].atgResponse.response.response'
 * - https://www.carolina.com/browse/product-search-results?q=acid&product.type=Product&tab=p&format=json&ajax=true
 * - https://www.carolina.com/browse/product-search-results?tab=p&product.type=Product&product.productTypes=chemicals&facetFields=product.productTypes&format=json&ajax=true&viewSize=300&q=acid
 *
 * @module SupplierCarolina
 * @category Supplier
 */
export default class SupplierCarolina<T extends Product>
  extends SupplierBase<T>
  implements AsyncIterable<T>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Carolina";

  protected _limit: number = 5;

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.carolina.com";

  // Override the type of _queryResults to use our specific type
  protected _queryResults: Array<CarolinaSearchResult> = [];

  // This is a limit to how many queries can be sent to the supplier for any given query.
  protected _httpRequestHardLimit: number = 50;

  // Used to keep track of how many requests have been made to the supplier.
  protected _httpRequstCount: number = 0;

  // If using async requests, this will determine how many of them to batch together (using
  // something like Promise.all()). This is to avoid overloading the users bandwidth and
  // to not flood the supplier with 100+ requests all at once.
  protected _httpRequestBatchSize: number = 4;

  // HTTP headers used as a basis for all queries.
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
   * Make the query params for the Carolina API
   *
   * @param query - The query to search for
   * @returns The query params
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
   * Check if the response is a valid Carolina search response
   *
   * @param response - The response to check
   * @returns True if the response is a valid Carolina search response, false otherwise
   */
  protected _isResponseOk(response: unknown): response is CarolinaSearchResponse {
    return (
      !!response &&
      typeof response === "object" &&
      "responseStatusCode" in response &&
      response.responseStatusCode === 200 &&
      "@type" in response &&
      //response["@type"] === "PageSlotContainer" &&
      "contents" in response &&
      typeof response.contents === "object"
    );
  }

  /**
   * Type guard to check if an object is a valid Carolina response
   */
  protected _isValidResponse(obj: unknown): obj is CarolinaSearchResponse {
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
   * Query products from the Carolina API
   *
   * @returns A promise that resolves when the products are queried
   */
  protected async queryProducts(): Promise<void> {
    const params = this._makeQueryParams(this._query);

    const response: unknown = await this.httpGetJson({
      path: "/browse/product-search-results",
      params,
    });

    if (!this._isResponseOk(response)) {
      console.warn("Response status:", response);
      return;
    }

    //console.log(response.contents.ContentFolderZone[0].childRules);

    const results = await this._extractSearchResults(response);
    this._queryResults = results.slice(0, this._limit);
  }

  protected _extractSearchResults(response: unknown): CarolinaSearchResult[] {
    try {
      // Type guard the response first
      if (!this._isValidResponse(response)) {
        console.error("Invalid response structure");
        return [];
      }

      // Navigate through the nested structure to find results
      const contentFolder = response.contents.ContentFolderZone[0];
      if (!contentFolder?.childRules?.[0]?.ContentRuleZone) {
        console.error("No content rules found");
        return [];
      }

      // Find the TwoColumnFullWidthHeaderPage content
      const pageContent = contentFolder.childRules[0].ContentRuleZone[0];
      if (!pageContent?.contents?.MainContent) {
        console.error("No MainContent found");
        return [];
      }

      // Look through MainContent for the PluginSlotContainer with Products - Search
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

      // Find the Products - Search folder
      const productsFolder = pluginSlotContainer.contents.ContentFolderZone.find(
        (folder: CarolinaContentFolder) => folder.folderPath === "Products - Search",
      );

      if (!productsFolder?.childRules?.[0]?.ContentRuleZone) {
        console.error("No content rules in Products folder");
        return [];
      }

      // Get the results container
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

      // Extract and validate results
      return resultsContainer.results.filter(this._isSearchResultItem);
    } catch (error) {
      console.error("Error extracting search results:", error);
      return [];
    }
  }

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

  protected _isProductResponse(obj: unknown): obj is CarolinaProductResponse {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    const response = obj as Partial<CarolinaProductResponse>;

    // Check if contents and MainContent exist and are properly structured
    if (!response.contents?.MainContent || !Array.isArray(response.contents.MainContent)) {
      return false;
    }

    // Check if there's at least one MainContent item with atgResponse
    if (
      response.contents.MainContent.length === 0 ||
      !response.contents.MainContent[0]?.atgResponse
    ) {
      return false;
    }

    return true;
  }

  protected _isATGResponse(obj: unknown): obj is CarolinaATGResponse {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    const response = obj as Partial<CarolinaATGResponse>;

    // Check required properties and types
    if (typeof response.result !== "string" || response.result !== "success") {
      return false;
    }

    if (!response.response?.response || typeof response.response.response !== "object") {
      return false;
    }

    const innerResponse = response.response.response;

    // Check for required properties in the inner response
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

  protected _extractATGResponse(
    productResponse: unknown,
  ): CarolinaATGResponse["response"]["response"] | null {
    if (!this._isProductResponse(productResponse)) {
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
   * Parse the products from the Carolina API
   *
   * @returns A promise that resolves to the products
   *
  protected async parseProducts(): Promise<(Product | void)[]> {
    return Promise.all(
      this._queryResults.map((result) => this._getProductData(result) as Promise<Product>),
    );
  }
  */

  protected async _getProductData(result: CarolinaSearchResult): Promise<Product | void> {
    try {
      const productResponse = await this.httpGetJson({
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
      //return atgResponse as Product;
    } catch (error) {
      console.error("Error getting product data:", error);
      return;
    }
  }
}
