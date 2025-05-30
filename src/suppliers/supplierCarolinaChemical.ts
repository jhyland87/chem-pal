import { type CountryCode, type Product, type ShippingRange } from "@/types";
import SupplierBaseWoocommerce from "./supplierBaseWoocommerce";

/**
 * Supplier class for Carolina Chemical, a chemical supplier using the WooCommerce platform.
 * Implements product fetching and parsing functionality specific to Carolina Chemical's website.
 *
 * @example
 * ```typescript
 * const supplier = new SupplierCarolinaChemical();
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
 * @see https://www.carolinachemical.com/
 * @see https://carolinachemical.com/wp-json/wc/store/v1/products
 */
export default class SupplierCarolinaChemical
  extends SupplierBaseWoocommerce
  implements AsyncIterable<Product>
{
  /**
   * The display name of the supplier.
   * Used for identifying the supplier in product listings and user interfaces.
   *
   * @example
   * ```typescript
   * const supplier = new SupplierCarolinaChemical();
   * console.log(`Products from ${supplier.supplierName}`);
   * // Output: "Products from Carolina Chemical"
   * ```
   */
  public readonly supplierName: string = "Carolina Chemical";

  // The base URL for the supplier's website.
  public readonly baseURL: string = "https://carolinachemical.com";

  // Shipping scope for Carolina Chemical
  public readonly shipping: ShippingRange = "domestic";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";
}
