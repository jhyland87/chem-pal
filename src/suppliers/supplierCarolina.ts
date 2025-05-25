import { parsePrice } from "@/helpers/currency";
import { ProductBuilder } from "@/helpers/productBuilder";
import { isQuantityObject, parseQuantity } from "@/helpers/quantity";
import { firstMap } from "@/helpers/utils";
import type { Product } from "@/types";
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
import SupplierBase from "./supplierBase";

/**
 * Implementation of the Carolina Biological Supply Company supplier.
 * Provides product search and data extraction functionality for Carolina.com.
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
      console.error("_isResponseOk| Response is not an object:", response);
      return false;
    }

    try {
      const _response = response as Partial<SearchResponse>;

      if (_response.responseStatusCode !== 200) {
        console.error("_isResponseOk| Invalid response status code:", _response.responseStatusCode);
        return false;
      }

      if (!("@type" in _response)) {
        console.error("_isResponseOk| Missing @type property");
        return false;
      }

      if (!("contents" in _response)) {
        console.error("_isResponseOk| Missing contents property");
        return false;
      }

      if (typeof _response.contents !== "object") {
        console.error("_isResponseOk| Contents is not an object:", typeof _response.contents);
        return false;
      }

      return true;
    } catch (error) {
      console.error("_isResponseOk| Error validating response:", error);
      return false;
    }
  }

  /**
   * Performs deep validation of a search response object
   * @param response - Response object to validate
   * @returns True if the response matches expected Carolina search response structure
   */
  protected _isValidSearchResponse(response: unknown): response is SearchResponse {
    if (typeof response !== "object" || response === null) {
      console.error("_isValidSearchResponse| Response is not an object:", response);
      return false;
    }

    const requiredProps = {
      contents: (val: unknown) => {
        if (typeof val !== "object" || val === null) {
          console.error("_isValidSearchResponse| Contents is not an object:", val);
          return false;
        }
        const contents = val as Record<string, unknown>;

        if (!Array.isArray(contents.ContentFolderZone)) {
          console.error(
            "_isValidSearchResponse| ContentFolderZone is not an array:",
            contents.ContentFolderZone,
          );
          return false;
        }
        if (contents.ContentFolderZone.length === 0) {
          console.error("_isValidSearchResponse| ContentFolderZone is empty");
          return false;
        }

        const folder = contents.ContentFolderZone[0] as Record<string, unknown>;
        if (!Array.isArray(folder.childRules)) {
          console.error("_isValidSearchResponse| childRules is not an array:", folder.childRules);
          return false;
        }

        if (folder.childRules.length === 0) {
          console.error("_isValidSearchResponse| childRules is empty");
          return false;
        }

        return true;
      },
      "@type": "string",
      responseStatusCode: (val: unknown) => {
        const isValid = val === 200;
        if (!isValid) {
          console.error("_isValidSearchResponse| Invalid response status code:", val);
        }
        return isValid;
      },
    };

    return Object.entries(requiredProps).every(([key, validator]) => {
      const value = (response as Record<string, unknown>)[key];
      if (value === undefined) {
        console.error(`_isValidSearchResponse| Missing required property: ${key}`);
        return false;
      }
      if (typeof validator === "string") {
        const isValid = typeof value === validator;
        if (!isValid) {
          console.error(
            `_isValidSearchResponse| Invalid type for ${key}, expected ${validator}, got ${typeof value}`,
          );
        }
        return isValid;
      }
      return validator(value);
    });
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
   * Type guard for SearchResult
   */
  protected _isSearchResultItem(result: unknown): result is SearchResult {
    if (typeof result !== "object" || result === null) {
      console.error("_isSearchResultItem| Result is not an object:", result);
      return false;
    }

    const requiredProps = {
      /* eslint-disable */
      "product.productId": "string",
      "product.productName": "string",
      "product.shortDescription": "string",
      itemPrice: "string",
      "product.seoName": "string",
      productUrl: "string",
      productName: "string",
      qtyDiscountAvailable: "boolean",
      /* eslint-enable */
    };

    const hasRequiredProps = Object.entries(requiredProps).every(([key, expectedType]) => {
      const item = result as Record<string, unknown>;
      if (!(key in item)) {
        console.error(`_isSearchResultItem| Missing property: ${key}`);
        return false;
      }
      const actualType = typeof item[key];
      if (actualType !== expectedType) {
        console.error(
          `_isSearchResultItem| Invalid type for ${key}, expected ${expectedType}, got ${actualType}`,
        );
        return false;
      }
      return true;
    });

    return hasRequiredProps;
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
    if (typeof obj !== "object" || obj === null) {
      this._logger.error("_isValidProductResponse| Object is not an object:", obj);
      return false;
    }

    const response = obj as Partial<ProductResponse>;

    if (!response.contents?.MainContent) {
      this._logger.error("_isValidProductResponse| Missing contents.MainContent");
      return false;
    }

    if (!Array.isArray(response.contents.MainContent)) {
      this._logger.error(
        "_isValidProductResponse| MainContent is not an array:",
        response.contents.MainContent,
      );
      return false;
    }

    if (response.contents.MainContent.length === 0) {
      this._logger.error("_isValidProductResponse| MainContent array is empty");
      return false;
    }

    const mainContent = response.contents.MainContent[0];
    if (typeof mainContent !== "object" || mainContent === null) {
      this._logger.error(
        "_isValidProductResponse| First MainContent item is not an object:",
        mainContent,
      );
      return false;
    }

    if (!("atgResponse" in mainContent)) {
      this._logger.error("_isValidProductResponse| Missing atgResponse in MainContent");
      return false;
    }

    if (typeof mainContent.atgResponse !== "object" || mainContent.atgResponse === null) {
      this._logger.error(
        "_isValidProductResponse| atgResponse is not an object:",
        mainContent.atgResponse,
      );
      return false;
    }

    return true;
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
    if (typeof obj !== "object" || obj === null) {
      this._logger.error("_isATGResponse| Object is not an object:", obj);
      return false;
    }

    const response = obj as Partial<ATGResponse>;

    const requiredProps = {
      result: (val: unknown) => {
        const isValid = val === "success";
        if (!isValid) {
          this._logger.error("_isATGResponse| Invalid result value:", val);
        }
        return isValid;
      },
      response: (val: unknown) => {
        if (typeof val !== "object" || val === null) {
          this._logger.error("_isATGResponse| Response is not an object:", val);
          return false;
        }
        const innerResponse = (val as { response?: unknown }).response;
        if (typeof innerResponse !== "object" || innerResponse === null) {
          this._logger.error("_isATGResponse| Inner response is not an object:", innerResponse);
          return false;
        }

        const requiredInnerProps = {
          displayName: "string",
          longDescription: "string",
          shortDescription: "string",
          product: "string",
          dataLayer: "object",
          canonicalUrl: "string",
        };

        return Object.entries(requiredInnerProps).every(([key, expectedType]) => {
          const value = (innerResponse as Record<string, unknown>)[key];
          if (value === undefined) {
            this._logger.error(`_isATGResponse| Missing inner property: ${key}`);
            return false;
          }
          if (expectedType === "object") {
            if (typeof value !== "object" || value === null) {
              this._logger.error(
                `_isATGResponse| Invalid type for ${key}, expected object, got:`,
                value,
              );
              return false;
            }
          } else if (typeof value !== expectedType) {
            this._logger.error(
              `_isATGResponse| Invalid type for ${key}, expected ${expectedType}, got ${typeof value}`,
            );
            return false;
          }
          return true;
        });
      },
    };

    return Object.entries(requiredProps).every(([key, validator]) => {
      if (!(key in response)) {
        this._logger.error(`_isATGResponse| Missing required property: ${key}`);
        return false;
      }
      return validator((response as Record<string, unknown>)[key]);
    });
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
      this._logger.warn("Response status:", productResponse);
      return;
    }

    const atgResponse = this._extractATGResponse(productResponse);
    if (!atgResponse) {
      this._logger.error("No ATG response found");
      return;
    }
    this._logger.debug("atgResponse:", atgResponse);

    const productPrice = parsePrice(atgResponse.dataLayer.productPrice[0]);
    if (!productPrice) {
      this._logger.error("No product price found");
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
