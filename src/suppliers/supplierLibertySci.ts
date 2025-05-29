import { SHIPPING_SCOPE } from "@/constants/common";
import { type CountryCode, type Product } from "@/types";
import SupplierBaseWoocommerce from "./supplierBaseWoocommerce";

/**
 * Supplier class for LibbertySci, a chemical supplier using the WooCommerce platform.
 * Implements product fetching and parsing functionality specific to LibertySci's website.
 *
 * @example
 * ```typescript
 * const supplier = new SupplierLibertySci();
 *
 * // Iterate over all products
 * for await (const product of supplier) {
 *   console.log(product.name, product.cas, product.price);
 * }
 *
 * // Search for specific products
 * const products = await supplier.search("acetone");
 * console.log(`Found ${products.length} products`);
 * ```
 *
 * @see https://www.libertysci.com/
 * @see https://www.libertysci.com/wp-json/wc/store/v1/products
 */
export default class SupplierLibertySci
  extends SupplierBaseWoocommerce
  implements AsyncIterable<Product>
{
  /**
   * The display name of the supplier.
   * Used for identifying the supplier in product listings and user interfaces.
   *
   * @example
   * ```typescript
   * const supplier = new SupplierLibertySci();
   * console.log(`Products from ${supplier.supplierName}`);
   * // Output: "Products from Carolina Chemical"
   * ```
   */
  public readonly supplierName: string = "LibertySci";

  /**
   * Shipping scope for Loudwolf
   * @defaultValue SHIPPING_SCOPE.Worldwide
   */
  public readonly shippingScope: SHIPPING_SCOPE = SHIPPING_SCOPE.Worldwide;

  /**
   * The country code of the supplier.
   * This is used to determine the currency and other country-specific information.
   */
  public readonly countryCode: CountryCode = "US";

  /**
   * The base URL for the supplier's website.
   * Used as the root URL for all HTTP requests to the supplier's API.
   *
   * @example
   * ```typescript
   * class CustomLibertySci extends SupplierLibertySci {
   *   constructor() {
   *     super();
   *     // Use staging environment
   *     this._baseURL = "https://staging.libertysci.com";
   *   }
   * }
   * ```
   */
  protected _baseURL: string = "https://libertysci.com";
}
