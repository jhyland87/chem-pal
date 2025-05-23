/**
 * Abstract base class for WooCommerce suppliers that implements product fetching functionality.
 * Extends the base supplier class and provides WooCommerce-specific implementation.
 */
import type { Product } from "types";
import type { WoocommerceItem, WoocommerceSearchResponse } from "types/woocommerce";
import SupplierBase from "./supplierBase";

export default abstract class SupplierBaseWoocommerce
  extends SupplierBase<WoocommerceItem, Product>
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
  protected async _queryProducts(query: string): Promise<WoocommerceItem[]> {
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
  protected _isValidProductResponse(response: unknown): response is WoocommerceItem {
    const requiredStringProps = ["id", "name", "type", "description", "price", "sku", "permalink"];
    const hasAllRequiredProps = requiredStringProps.every((prop) => {
      if (!response || typeof response !== "object") return false;
      const obj = response as Record<string, unknown>;
      return prop in obj && typeof obj[prop] === "string";
    });

    return hasAllRequiredProps;
  }

  /**
   * Type guard to validate if a response matches the WooCommerce search response structure
   * @param response - Unknown response object to validate
   * @returns Type predicate indicating if response is a valid WooCommerce search response
   */
  protected _isValidSearchResponse(response: unknown): response is WoocommerceSearchResponse {
    return response !== null && Array.isArray(response);
  }

  /**
   * Transforms a WooCommerce product item into the common Product type
   * @param product - WooCommerce product item to transform
   * @returns Promise resolving to a partial Product object or void if invalid
   */
  protected async _getProductData(product: WoocommerceItem): Promise<Partial<Product> | void> {
    if (!product.price) {
      return;
    }

    return {} satisfies Partial<Product>;
  }
}
