import { parsePrice } from "@/helpers/currency";
import { ProductBuilder } from "@/helpers/productBuilder";
import { isQuantityObject, parseQuantity } from "@/helpers/quantity";
import { firstMap } from "@/helpers/utils";
import {
  type ATGResponse,
  type ContentFolder,
  type ContentRuleZoneItem,
  type MainContentItem,
  type ProductResponse,
  type ResultsContainer,
  type SearchParams,
  type SearchResponse,
  type SearchResult,
} from "@/types/carolina";
import type { Product } from "@/types/types";
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
  extends SupplierBase<SearchResult, Product>
  implements AsyncIterable<Product>
{
  /** Display name of the supplier */
  public readonly supplierName: string = "Carolina";

  /** Maximum number of results to return */
  protected _limit: number = 15;

  /** Base URL for all API requests */
  protected _baseURL: string = "https://www.carolina.com";

  /** Cached search results from the last query */
  protected _queryResults: Array<SearchResult> = [];

  /** Maximum number of HTTP requests allowed per query */
  protected _httpRequestHardLimit: number = 50;

  /** Counter for HTTP requests made during current query */
  protected _httpRequstCount: number = 0;

  /** Number of requests to process in parallel */
  protected _httpRequestBatchSize: number = 5;

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
  protected _makeQueryParams(query: string): SearchParams {
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
    } satisfies SearchParams;
  }

  /**
   * Validates that a response has a successful status code and expected structure
   * @param response - Response object to validate
   * @returns True if response is valid and successful
   */
  protected _isResponseOk(response: unknown): response is SearchResponse {
    if (!response || typeof response !== "object") {
      console.error("Response is not an object");
      return false;
    }

    try {
      const _response = response as Partial<SearchResponse>;

      return (
        _response.responseStatusCode === 200 &&
        "@type" in _response &&
        "contents" in _response &&
        typeof _response.contents === "object"
      );
    } catch (error) {
      console.error("Error validating response:", error);
      return false;
    }
  }

  /**
   * Performs deep validation of a search response object
   * @param response - Response object to validate
   * @returns True if the response matches expected Carolina search response structure
   */
  protected _isValidSearchResponse(response: unknown): response is SearchResponse {
    if (!response || typeof response !== "object") {
      console.error("Response is not an object");
      return false;
    }

    try {
      const _response = response as Partial<SearchResponse>;

      if (!_response.contents) {
        console.error("Response missing contents");
        return false;
      }
      if (!Array.isArray(_response.contents.ContentFolderZone)) {
        console.error("ContentFolderZone is not an array");
        return false;
      }
      if (_response.contents.ContentFolderZone.length === 0) {
        console.error("ContentFolderZone is empty");
        return false;
      }
      if (!_response.contents.ContentFolderZone[0].childRules) {
        console.error("No child rules found");
        return false;
      }
      if (!Array.isArray(_response.contents.ContentFolderZone[0].childRules)) {
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
  protected async _queryProducts(query: string): Promise<SearchResult[] | void> {
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
  protected _extractSearchResults(response: unknown): SearchResult[] {
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
      const pluginSlotContainer = mainContentItems.find((item: MainContentItem) =>
        item.contents?.ContentFolderZone?.some(
          (folder: ContentFolder) => folder.folderPath === "Products - Search",
        ),
      );

      if (!pluginSlotContainer?.contents?.ContentFolderZone) {
        console.error("No Products - Search folder found");
        return [];
      }

      const productsFolder = pluginSlotContainer.contents.ContentFolderZone.find(
        (folder: ContentFolder) => folder.folderPath === "Products - Search",
      );

      if (!productsFolder?.childRules?.[0]?.ContentRuleZone) {
        console.error("No content rules in Products folder");
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
   * Validates that an object matches the SearchResult interface structure
   * @param result - Object to validate as a search result
   * @returns Type predicate indicating if object is a valid SearchResult
   * @example
   * ```typescript
   * const item = getSearchItem();
   * if (this._isSearchResultItem(item)) {
   *   // Process valid search result
   *   console.log(item.productId, item.name);
   * }
   * ```
   */
  protected _isSearchResultItem(result: unknown): result is SearchResult {
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
   * Validates that a response matches the ProductResponse interface structure
   * @param obj - Response object to validate
   * @returns Type predicate indicating if object is a valid ProductResponse
   * @example
   * ```typescript
   * const response = await this._httpGetJson({
   *   path: `/api/rest/cb/product/product-details/${productId}`
   * });
   * if (this._isValidProductResponse(response)) {
   *   // Process valid product response
   *   console.log(response.product.name);
   * }
   * ```
   */
  protected _isValidProductResponse(obj: unknown): obj is ProductResponse {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    const response = obj as Partial<ProductResponse>;

    if (!response.contents?.MainContent || !Array.isArray(response.contents.MainContent)) {
      return false;
    }

    return !(
      response.contents.MainContent.length === 0 || !response.contents.MainContent[0]?.atgResponse
    );
  }

  /**
   * Validates that a response matches the ATGResponse interface structure
   * @param obj - Response object to validate
   * @returns Type predicate indicating if object is a valid ATGResponse
   * @example
   * ```typescript
   * const response = await this._httpGetJson({
   *   path: `/api/rest/cb/product/product-quick-view/${productId}`
   * });
   * if (this._isATGResponse(response)) {
   *   // Process valid ATG response
   *   console.log(response.response.response.products[0]);
   * }
   * ```
   */
  protected _isATGResponse(obj: unknown): obj is ATGResponse {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    const response = obj as Partial<ATGResponse>;

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
   * Extracts the relevant product data from an ATG response object
   * Navigates through the nested response structure to find product information
   * @param productResponse - Raw ATG response object
   * @returns Product data from response or null if invalid/not found
   * @example
   * ```typescript
   * const response = await this._httpGetJson({
   *   path: `/api/rest/cb/product/product-quick-view/${productId}`
   * });
   * const productData = this._extractATGResponse(response);
   * if (productData) {
   *   console.log(productData.products[0]);
   * }
   * ```
   */
  protected _extractATGResponse(
    productResponse: unknown,
  ): ATGResponse["response"]["response"] | null {
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
   * Transforms a Carolina search result into the common Product type
   * Makes additional API calls if needed to get complete product details
   * @param result - Carolina search result to transform
   * @returns Promise resolving to a partial Product object or void if invalid
   * @example
   * ```typescript
   * const searchResults = await this._queryProducts("acid");
   * if (searchResults) {
   *   const product = await this._getProductData(searchResults[0]);
   *   if (product) {
   *     console.log(product.title, product.price);
   *   }
   * }
   * ```
   */
  protected async _getProductData(result: SearchResult): Promise<Product | void> {
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

    const productPrice = parsePrice(atgResponse.dataLayer.productPrice[0]);
    if (!productPrice) {
      console.error("No product price found");
      return;
    }

    const quantity = firstMap(parseQuantity, [
      atgResponse.displayName,
      atgResponse.shortDescription,
      atgResponse.standardResult.productName,
    ]);

    if (!isQuantityObject(quantity)) return;

    let casNumber: string | undefined;
    const specifications =
      atgResponse.standardResult?.tabsResult?.pdpspecifications?.specificationList?.find(
        (item) => item.specificationDisplayName === "CAS Number",
      );
    if (specifications) {
      casNumber = specifications.stringValue;
    }

    let builder = new ProductBuilder(this._baseURL)
      .setBasicInfo(atgResponse.displayName, atgResponse.canonicalUrl, this.supplierName)
      .setPricing(productPrice.price, productPrice.currencyCode, productPrice.currencySymbol)
      .setQuantity(quantity.quantity, quantity.uom)
      .setDescription(atgResponse.shortDescription)
      .setCAS(casNumber || "");

    builder = builder.addVariants([
      {
        title: "100g",
        price: productPrice.price,
        quantity: 100,
        uom: "g",
      },
    ]);

    return builder.build();
  }
}
