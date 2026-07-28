import { SupplierBaseWoocommerce } from './SupplierBaseWoocommerce';

/**
 * Supplier class for Albo Chemicals, a chemical supplier using the WooCommerce platform.
 * Implements product fetching and parsing functionality specific to Albo Chemicals's website.
 *
 * @example
 * ```typescript
 * const supplier = new SupplierAlboChemicals();
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
 * @see https://albochem.com/
 * @see https://albochem.com/wp-json/wc/store/v1/products
 * @source
 */
export class SupplierAlboChemicals extends SupplierBaseWoocommerce implements ISupplier {
  /**
   * The display name of the supplier.
   * Used for identifying the supplier in product listings and user interfaces.
   *
   * @example
   * ```typescript
   * const supplier = new SupplierAlboChemicals();
   * console.log(`Products from ${supplier.supplierName}`);
   * // Output: "Products from Albo Chemicals"
   * ```
   * @source
   */
  public static readonly supplierName: string = 'Albo Chemicals';

  // The base URL for the supplier's website.
  public static readonly baseURL: string = 'https://albochem.com';

  // Shipping scope for Albo Chemicals
  public static readonly shipping: ShippingRange = 'domestic';

  // The country code of the supplier.
  public static readonly country: CountryCode = 'US';

  protected readonly minMatchPercentage: number = 50;
  //protected readonly fuzzScorer: FuzzScorerFn = WRatio;

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];
}
