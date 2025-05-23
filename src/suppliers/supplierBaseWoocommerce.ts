/**
 * Abstract base class for WooCommerce suppliers that implements product fetching functionality.
 * Extends the base supplier class and provides WooCommerce-specific implementation.
 */
import type { Product } from "types";
import type { ItemListing, SearchResponse } from "types/woocommerce";
import SupplierBase from "./supplierBase";

/**
 * https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/src/StoreApi/docs/products.md
 * https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/src/StoreApi/docs/products.md#list-products
 *
 */
export default abstract class SupplierBaseWoocommerce
  extends SupplierBase<ItemListing, Product>
  implements AsyncIterable<Product>
{
  /** API key for WooCommerce authentication */
  protected _apiKey: string = "";

  /** Maximum number of products to return in a query */
  protected _limit: number = 5;

  /**
   * Queries WooCommerce products based on a search string
   * @param query - The search term to query products
   * @returns Promise resolving to an array of WooCommerce product items
   */
  protected async _queryProducts(query: string): Promise<ItemListing[]> {
    const getParams = {
      search: query,
    };

    const searchRequest = await this._httpGetJson({
      path: `/wp-json/wc/store/v1/products`,
      params: getParams,
    });

    console.log("searchRequest:", searchRequest);

    if (!this._isValidSearchResponse(searchRequest)) {
      throw new Error("Invalid search response");
    }

    return searchRequest.items.slice(0, this._limit);
  }

  /**
   * Type guard to validate if a response matches the WooCommerce product response structure
   * @param response - Unknown response object to validate
   * @returns Type predicate indicating if response is a valid WooCommerce product response
   */
  protected _isValidProductResponse(response: unknown): response is ItemListing {
    const requiredStringProps = ["id", "name", "type", "description", "price", "sku", "permalink"];
    const hasAllRequiredProps = requiredStringProps.every((prop) => {
      if (!response || typeof response !== "object") return false;
      const obj = response as Record<string, unknown>;
      return prop in obj && typeof obj[prop] === "string";
    });

    return hasAllRequiredProps;
  }

  /**
   * Validates if the response from the WooCommerce API is a valid SearchResponse object.
   * @param response - The response object to validate
   * @returns True if the response is a valid SearchResponse object, false otherwise
   * @example
   * ```typescript
   * const searchRequest = await this._httpGetJson({
   *   path: `/wp-json/wc/store/v1/products`,
   *   params: { search: "test" }
   * });
   *
   * if (!this._isValidSearchResponse(searchRequest)) {
   *   throw new Error("Invalid search response");
   * }
   * ```
   */
  protected _isValidSearchResponse(response: unknown): response is SearchResponse {
    return (
      typeof response === "object" &&
      response !== null &&
      "totalItems" in response &&
      "items" in response
    );
  }

  /**
   * Transforms a WooCommerce product item into the common Product type
   * @param product - WooCommerce product item to transform
   * @returns Promise resolving to a partial Product object or void if invalid
   */
  protected async _getProductData(product: ItemListing): Promise<Partial<Product> | void> {
    if (!product.price) {
      return;
    }

    return {} satisfies Partial<Product>;
  }
}
