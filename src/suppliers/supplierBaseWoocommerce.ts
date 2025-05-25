/**
 * Abstract base class for WooCommerce suppliers that implements product fetching functionality.
 * Extends the base supplier class and provides WooCommerce-specific implementation.
 *
 * This class handles the interaction with WooCommerce's REST API, including:
 * - Product searching and retrieval
 * - Data validation and type checking
 * - Transformation of WooCommerce product format to internal Product type
 *
 * @example
 * ```typescript
 * class MyChemicalSupplier extends SupplierBaseWoocommerce {
 *   public readonly supplierName = "My Chemical Supplier";
 *   protected _baseURL = "https://mychemicalsupplier.com";
 *   protected _apiKey = "your_api_key";
 *
 *   // Optionally override methods for custom behavior
 *   protected async _getProductData(product: SearchResponseItem) {
 *     const data = await super._getProductData(product);
 *     // Add custom processing...
 *     return data;
 *   }
 * }
 *
 * // Usage
 * const supplier = new MyChemicalSupplier();
 * for await (const product of supplier) {
 *   console.log(product);
 * }
 * ```
 *
 * @see https://woocommerce.github.io/woocommerce-rest-api-docs/
 */
import { findCAS } from "@/helpers/cas";
import { ProductBuilder } from "@/helpers/productBuilder";
import { parseQuantity } from "@/helpers/quantity";
import { findFormulaInHtml } from "@/helpers/science";
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
   * Should be set in the constructor of implementing classes.
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
   * Maximum number of products to return in a single API query.
   * Limits the number of products returned from the WooCommerce API to prevent excessive data transfer.
   * Can be overridden in implementing classes to adjust the batch size.
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBaseWoocommerce {
   *   constructor() {
   *     super();
   *     this._limit = 50; // Increase limit to 50 products per request
   *   }
   * }
   * ```
   */
  protected _limit: number = 5;

  /**
   * Queries the WooCommerce API for products matching the given search term.
   * Makes a GET request to the WooCommerce Store API v1 products endpoint.
   *
   * @param query - Search term to filter products
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to an array of SearchResponseItem or void if the request fails
   *
   * @example
   * ```typescript
   * const products = await supplier._queryProducts("sodium chloride");
   * if (products) {
   *   console.log(`Found ${products.length} matching products`);
   * }
   * ```
   */
  protected async _queryProducts(
    query: string,
    limit: number = this._limit,
  ): Promise<Array<SearchResponseItem> | void> {
    const searchRequest = await this._httpGetJson({
      path: `/wp-json/wc/store/v1/products`,
      params: { search: query },
    });

    if (!this._isSearchResponse(searchRequest)) {
      this._logger.error("Invalid search response:", searchRequest);
      return;
    }

    return searchRequest.slice(0, limit) as Array<SearchResponseItem>;
  }

  /**
   * Type guard to validate if an unknown object is a valid SearchResponseItem.
   * Checks for the presence and correct types of all required properties.
   *
   * @param item - Object to validate
   * @returns Boolean indicating if the object is a valid SearchResponseItem
   *
   * @example
   * ```typescript
   * const response = await fetchData();
   * if (this._isSearchResponseItem(response)) {
   *   // TypeScript now knows response is SearchResponseItem
   *   console.log(response.name);
   * }
   * ```
   */
  protected _isSearchResponseItem(item: unknown): item is SearchResponseItem {
    if (typeof item !== "object" || item === null) {
      return false;
    }

    const requiredProps = {
      /* eslint-disable */
      id: "number",
      name: "string",
      type: "string",
      description: "string",
      short_description: "string",
      permalink: "string",
      is_in_stock: "boolean",
      sold_individually: "boolean",
      sku: "string",
      /* eslint-enable */
      prices: (val: unknown) => typeof val === "object" && val !== null,
    };

    const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
      if (typeof validator === "string") {
        if (key in item === false) {
          this._logger.debug(`Missing required property: ${key}`, item);
          return false;
        }
        if (typeof item[key as keyof typeof item] !== validator) {
          this._logger.debug(`Invalid property type: ${key}`);
          return false;
        }
        return true;
      }
      if (key in item === false) {
        this._logger.debug(`Missing required property: ${key}`, item);
        return false;
      }
      if (validator(item[key as keyof typeof item]) === false) {
        this._logger.debug(`Invalid property value: ${key}`, item);
        return false;
      }
      return true;
    });

    if (!hasRequiredProps) return false;

    // Check prices object structure
    const prices = (item as SearchResponseItem).prices;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const requiredPriceProps = {
      /* eslint-disable */
      price: "string",
      regular_price: "string",
      sale_price: "string",
      currency_code: "string",
      currency_symbol: "string",
      currency_minor_unit: "number",
      currency_decimal_separator: "string",
      currency_thousand_separator: "string",
      currency_prefix: "string",
      currency_suffix: "string",
      /* eslint-enable */
    };

    return Object.entries(requiredPriceProps).every(([key, type]) => {
      if (key in prices === false) {
        this._logger.debug(`Missing required property: ${key}`, prices);
        return false;
      }
      if (typeof prices[key as keyof typeof prices] !== type) {
        this._logger.debug(`Invalid property type: ${key}`, prices);
        return false;
      }
      return true;
    });
  }

  /**
   * Type guard to validate if an unknown value is a valid SearchResponse.
   * Checks if the value is an array and all items are valid SearchResponseItems.
   *
   * @param response - Value to validate
   * @returns Boolean indicating if the value is a valid SearchResponse
   *
   * @example
   * ```typescript
   * const response = await fetchSearchResults();
   * if (this._isSearchResponse(response)) {
   *   // TypeScript now knows response is SearchResponse
   *   response.forEach(item => console.log(item.name));
   * }
   * ```
   */
  protected _isSearchResponse(response: unknown): response is SearchResponse {
    if (!Array.isArray(response)) {
      this._logger.debug("Invalid search response (expected an array):", response);
      return false;
    }

    return response.every((item) => this._isSearchResponseItem(item));
  }

  /**
   * Type guard to validate if an unknown object is a valid ProductVariant.
   * Checks if the object is a valid SearchResponseItem and has the required variant properties.
   *
   * @param product - Object to validate
   * @returns Boolean indicating if the object is a valid ProductVariant
   *
   * @example
   * ```typescript
   * const product = await fetchProduct();
   * if (this._isProductVariant(product)) {
   *   // TypeScript now knows product is ProductVariant
   *   console.log(product.variation);
   * }
   * ```
   */
  protected _isProductVariant(product: unknown): product is ProductVariant {
    if (!this._isSearchResponseItem(product)) {
      this._logger.debug("Invalid product variant:", product);
      return false;
    }

    if (typeof (product as ProductVariant).variation !== "string") {
      this._logger.debug("Invalid product variant:", product);
      return false;
    }

    return true;
  }

  /**
   * Validates if a product response contains all required variant information.
   * Extends the basic ProductVariant validation with additional required properties.
   *
   * @param response - Object to validate
   * @returns Boolean indicating if the response is a valid and complete ProductVariant
   *
   * @example
   * ```typescript
   * const response = await fetchProductDetails();
   * if (this._isValidProductVariant(response)) {
   *   // TypeScript now knows response is a complete ProductVariant
   *   console.log(response.variations);
   * }
   * ```
   */
  protected _isValidProductVariant(response: unknown): response is ProductVariant {
    if (!this._isProductVariant(response)) {
      return false;
    }

    const requiredProps = {
      variation: "string",
      sku: "string",
      description: "string",
      variations: Array.isArray,
    };

    return Object.entries(requiredProps).every(([key, validator]) => {
      if (typeof validator === "string") {
        if (key in response === false) {
          this._logger.debug(`Missing required property: ${key}`, response);
          return false;
        }
        if (typeof response[key as keyof typeof response] !== validator) {
          this._logger.debug(`Invalid property type: ${key}`, response);
          return false;
        }
        return true;
      }
      if (key in response === false) {
        this._logger.debug(`Missing required property: ${key}`, response);
        return false;
      }
      if (validator(response[key as keyof typeof response]) === false) {
        this._logger.debug(`Invalid property value: ${key}`, response);
        return false;
      }
      return true;
    });
  }

  /**
   * Transforms a WooCommerce product item into the common Product type.
   * Fetches additional product details, extracts relevant information, and builds a standardized Product object.
   *
   * This method:
   * 1. Validates the input product
   * 2. Fetches detailed product information
   * 3. Extracts price, quantity, CAS number, and chemical formula
   * 4. Builds and returns a standardized Product object
   *
   * @param product - WooCommerce product item to transform
   * @returns Promise resolving to a partial Product object or void if transformation fails
   *
   * @example
   * ```typescript
   * const searchItem = await supplier._queryProducts("sodium");
   * if (searchItem?.[0]) {
   *   const product = await supplier._getProductData(searchItem[0]);
   *   if (product) {
   *     console.log("Transformed product:", product);
   *   }
   * }
   * ```
   */
  protected async _getProductData(product: SearchResponseItem): Promise<Partial<Product> | void> {
    if (!this._isSearchResponseItem(product)) {
      this._logger.error("Invalid search response item:", product);
      return;
    }

    this._logger.debug("product:", product);

    const productResponse: unknown = await this._httpGetJson({
      path: `/wp-json/wc/store/v1/products/${product.id}`,
    });

    this._logger.debug("productResponse:", productResponse);

    if (!this._isValidProductVariant(productResponse)) {
      this._logger.error("Invalid product object:", productResponse);
      return;
    }

    const productPrice = parseInt(productResponse.prices.price) / 100;

    if ("variation" in productResponse === false) {
      this._logger.error("No variation found for product:", product);
      return;
    }

    const quantity = firstMap(parseQuantity, [
      productResponse.name,
      productResponse.variation,
      productResponse.sku,
      productResponse.description,
      productResponse?.variations?.[0]?.attributes?.[0]?.value || "",
      productResponse?.add_to_cart?.description || "",
    ]);

    if (!quantity) {
      this._logger.error("No quantity found for product:", product);
      return;
    }

    const casNumber = firstMap(findCAS, [
      productResponse.description,
      productResponse.short_description,
    ]);

    const formula = firstMap(findFormulaInHtml, [
      productResponse.description,
      productResponse.short_description,
    ]);

    const builder = new ProductBuilder<Product>(this._baseURL);
    return builder
      .setBasicInfo(product.name, product.permalink, this.supplierName)
      .setPricing(
        productPrice,
        productResponse.prices.currency_code,
        productResponse.prices.currency_symbol,
      )
      .setQuantity(quantity.quantity, quantity.uom)
      .setCAS(casNumber || "")
      .setFormula(formula || "")
      .build();
  }
}
