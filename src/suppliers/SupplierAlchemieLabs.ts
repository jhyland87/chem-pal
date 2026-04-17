import SupplierBaseWoocommerce from "./SupplierBaseWoocommerce";

/**
 * Supplier class for Alchemie Labs, a chemical supplier using the WooCommerce platform.
 * Implements product fetching and parsing functionality specific to Alchemie Labs's website.
 *
 * @example
 * ```typescript
 * const supplier = new SupplierAlchemieLabs();
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
 * @see https://alchemielabs.com/
 * @see https://alchemielabs.com/wp-json/wc/store/v1/products
 * @source
 */
export default class SupplierAlchemieLabs extends SupplierBaseWoocommerce implements ISupplier {
  /**
   * The display name of the supplier.
   * Used for identifying the supplier in product listings and user interfaces.
   *
   * @example
   * ```typescript
   * const supplier = new SupplierAlchemieLabs();
   * console.log(`Products from ${supplier.supplierName}`);
   * // Output: "Products from Carolina Chemical"
   * ```
   * @source
   */
  public readonly supplierName: string = "Alchemie Labs";

  // The base URL for the supplier's website.
  public readonly baseURL: string = "https://alchemielabs.com";

  // Shipping scope for Alchemie Labs
  public readonly shipping: ShippingRange = "domestic";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];
}
