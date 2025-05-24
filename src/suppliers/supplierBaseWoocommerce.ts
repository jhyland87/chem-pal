/**
 * Abstract base class for WooCommerce suppliers that implements product fetching functionality.
 * Extends the base supplier class and provides WooCommerce-specific implementation.
 */
import { findCAS } from "@/helpers/cas";
import { ProductBuilder } from "@/helpers/productBuilder";
import { parseQuantity } from "@/helpers/quantity";
import { firstMap } from "@/helpers/utils";
import type { Product } from "@/types";
import type { ProductVariant, SearchResponse, SearchResponseItem } from "@/types/woocommerce";
import SupplierBase from "./supplierBase";

/**
 * Base class for WooCommerce-based suppliers that provides common functionality for
 * interacting with WooCommerce REST API endpoints.
 *
 * @example
 * ```typescript
 * class MyChemicalSupplier extends SupplierBaseWoocommerce {
 *   public readonly supplierName = "My Chemical Supplier";
 *   protected _baseURL = "https://mychemicalsupplier.com";
 * }
 *
 * const supplier = new MyChemicalSupplier();
 * for await (const product of supplier) {
 *   console.log(product);
 * }
 * ```
 *
 * @see https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/src/StoreApi/docs/products.md
 * @see https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/src/StoreApi/docs/products.md#list-products
 */
export default abstract class SupplierBaseWoocommerce
  extends SupplierBase<SearchResponseItem, Product>
  implements AsyncIterable<Product>
{
  /**
   * API key for WooCommerce authentication.
   * Used for authenticating requests to the WooCommerce REST API.
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBaseWoocommerce {
   *   constructor() {
   *     super();
   *     this._apiKey = "wc_key_123456789";
   *   }
   * }
   * ```
   */
  protected _apiKey: string = "";

  /**
   * Maximum number of products to return in a query.
   * Limits the number of products returned from the WooCommerce API to prevent excessive data transfer.
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBaseWoocommerce {
   *   constructor() {
   *     super();
   *     this._limit = 50; // Increase limit to 50 products
   *   }
   * }
   * ```
   */
  protected _limit: number = 20;

  /**
   * Queries WooCommerce products based on a search string.
   * Makes a GET request to the WooCommerce REST API products endpoint with the provided search term.
   *
   * @param query - The search term to query products
   * @returns Promise resolving to an array of WooCommerce product items
   * @throws Error if the search response is invalid
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBaseWoocommerce {
   *   async searchProducts(term: string) {
   *     const products = await this._queryProducts(term);
   *     return products;
   *   }
   * }
   *
   * const supplier = new MySupplier();
   * const products = await supplier.searchProducts("acetone");
   * ```
   */
  protected async _queryProducts(query: string): Promise<SearchResponseItem[]> {
    const getParams = {
      search: query,
    };

    const searchRequest = await this._httpGetJson({
      path: "/wp-json/wc/store/v1/products",
      params: getParams,
    });

    console.log("searchRequest:", searchRequest);

    if (!this._isValidSearchResponse(searchRequest)) {
      throw new Error("Invalid search response");
    }

    return searchRequest.slice(0, this._limit);
  }

  /**
   * Type guard to validate if a response matches the WooCommerce product response structure.
   * This is for individual product responses (ie: /wp-json/wc/store/v1/products/:id), which
   * contain a single object in the root with a little more data than the search response.
   *
   * @param response - Unknown response object to validate
   * @returns Type predicate indicating if response is a valid WooCommerce product response
   *
   * @example
   * ```typescript
   * const response = await fetch("https://example.com/wp-json/wc/store/v1/products/123");
   * const data = await response.json();
   *
   * if (this._isValidSearchResponseItem(data)) {
   *   console.log("Valid product:", data.name);
   * } else {
   *   console.error("Invalid product response");
   * }
   * ```
   */
  protected _isValidSearchResponseItem(response: unknown): response is SearchResponseItem {
    if (!response || typeof response !== "object" || Array.isArray(response)) {
      return false;
    }

    return ["id", "name", "type", "description", "prices", "sku", "permalink", "variations"].every(
      (prop) => {
        if (!response || typeof response !== "object") return false;
        const obj = response as Record<string, unknown>;
        return prop in obj && typeof obj[prop];
      },
    );
  }

  /**
   * Validates if the response from the WooCommerce API is a valid SearchResponse object.
   * Checks if the response is an array and if each item in the array is a valid SearchResponseItem.
   *
   * @param response - The response object to validate
   * @returns True if the response is a valid SearchResponse object, false otherwise
   *
   * @example
   * ```typescript
   * const searchRequest = await this._httpGetJson({
   *   path: `/wp-json/wc/store/v1/products`,
   *   params: { search: "test" }
   * });
   *
   * if (this._isValidSearchResponse(searchRequest)) {
   *   const products = searchRequest;
   *   console.log(`Found ${products.length} products`);
   * } else {
   *   throw new Error("Invalid search response");
   * }
   * ```
   */
  protected _isValidSearchResponse(response: unknown): response is SearchResponse {
    if (!response || typeof response !== "object" || !Array.isArray(response)) {
      return false;
    }

    try {
      return response.every(this._isValidSearchResponseItem);
    } catch {
      return false;
    }
  }

  /**
   * Type guard to validate if a response matches the WooCommerce product variant structure.
   * Checks if the response is both a valid SearchResponseItem and contains a variation property.
   *
   * @param response - Unknown response object to validate
   * @returns Type predicate indicating if response is a valid WooCommerce product variant
   *
   * @example
   * ```typescript
   * const response = await fetch("https://example.com/wp-json/wc/store/v1/products/123");
   * const data = await response.json();
   *
   * if (this._isValidProductVariant(data)) {
   *   console.log("Product variation:", data.variation);
   * } else {
   *   console.error("Not a valid product variant");
   * }
   * ```
   */
  protected _isValidProductVariant(response: unknown): response is ProductVariant {
    if (!this._isValidSearchResponseItem(response)) return false;

    if ("variation" in response === false) return false;

    return true;
  }

  /**
   * Transforms a WooCommerce product item into the common Product type.
   * Fetches additional product details, extracts quantity and CAS number information,
   * and builds a standardized Product object.
   *
   * @param product - WooCommerce product item to transform
   * @returns Promise resolving to a partial Product object or void if invalid
   *
   * @example
   * ```typescript
   * const searchResults = await this._queryProducts("acetone");
   * if (searchResults.length > 0) {
   *   const productData = await this._getProductData(searchResults[0]);
   *   if (productData) {
   *     console.log("Transformed product:", {
   *       name: productData.name,
   *       cas: productData.cas,
   *       price: productData.price
   *     });
   *   }
   * }
   * ```
   */
  protected async _getProductData(product: SearchResponseItem): Promise<Partial<Product> | void> {
    console.log("product:", product);

    const productResponse: unknown = await this._httpGetJson({
      path: `/wp-json/wc/store/v1/products/${product.id}`,
    });

    console.log("productResponse:", productResponse);

    if (!this._isValidProductVariant(productResponse)) {
      console.error("Invalid product object:", productResponse);
      return;
    }

    const productPrice = parseFloat(productResponse.prices.price);

    if ("variation" in productResponse === false) {
      console.error("No variation found for product:", product);
      return;
    }

    const quantity = firstMap(parseQuantity, [
      productResponse.variation,
      productResponse.sku,
      productResponse.description,
      productResponse.variations[0].attributes[0].value,
    ]);

    if (!quantity) {
      console.error("No quantity found for product:", product);
      return;
    }

    const casNumber = findCAS(productResponse.short_description);

    const builder = new ProductBuilder(this._baseURL);
    return (
      builder
        .setBasicInfo(product.name, product.permalink, this.supplierName)
        .setPricing(
          productPrice,
          productResponse.prices.currency_code,
          productResponse.prices.currency_symbol,
        )
        .setQuantity(quantity.quantity, quantity.uom)
        //.setDescription(description)
        .setCAS(casNumber || "")
        .build()
    );
  }
}
