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
   * Query products from the WooCommerce API
   */
  protected async _queryProducts(query: string): Promise<Array<SearchResponseItem> | void> {
    const searchRequest = await this._httpGetJson({
      path: `/wp-json/wc/store/v1/products`,
      params: { search: query },
    });

    if (!this._isSearchResponse(searchRequest)) {
      console.error("Invalid search response:", searchRequest);
      return;
    }

    return searchRequest;
  }

  /**
   * Type guard for SearchResponseItem
   */
  protected _isSearchResponseItem(item: unknown): item is SearchResponseItem {
    if (typeof item !== "object" || item === null) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
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
        return key in item && typeof item[key as keyof typeof item] === validator;
      }
      return key in item && validator(item[key as keyof typeof item]);
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

    return Object.entries(requiredPriceProps).every(
      ([key, type]) => key in prices && typeof prices[key as keyof typeof prices] === type,
    );
  }

  /**
   * Type guard for SearchResponse
   */
  protected _isSearchResponse(response: unknown): response is SearchResponse {
    if (!Array.isArray(response)) {
      return false;
    }

    return response.every((item) => this._isSearchResponseItem(item));
  }

  /**
   * Type guard for ProductVariant
   */
  protected _isProductVariant(product: unknown): product is ProductVariant {
    if (!this._isSearchResponseItem(product)) {
      return false;
    }

    return typeof (product as ProductVariant).variation === "string";
  }

  /**
   * Check if the product response is valid
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

    const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
      if (typeof validator === "string") {
        return key in response && typeof response[key as keyof typeof response] === validator;
      }
      return key in response && validator(response[key as keyof typeof response]);
    });

    if (!hasRequiredProps) return false;

    // Check variations array
    return response.variations.length > 0 && Array.isArray(response.variations[0].attributes);
  }

  /**
   * Transforms a WooCommerce product item into the common Product type.
   */
  protected async _getProductData(product: SearchResponseItem): Promise<Partial<Product> | void> {
    if (!this._isSearchResponseItem(product)) {
      console.error("Invalid search response item:", product);
      return;
    }

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
      .build();
  }
}
