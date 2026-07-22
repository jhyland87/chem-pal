import { SupplierBaseWoocommerce } from './SupplierBaseWoocommerce';

/**
 * Supplier class for Consolidated Chemical & Solvents, a chemical supplier using the WooCommerce platform.
 * Implements product fetching and parsing functionality specific to Consolidated Chemical & Solvents's website.
 *
 * @example
 * ```typescript
 * const supplier = new SupplierConsolidatedChemical();
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
 * @see https://consolidated-chemical.com/
 * @see https://consolidated-chemical.com/wp-json/wc/store/v1/products
 * @source
 */
export class SupplierConsolidatedChemical extends SupplierBaseWoocommerce implements ISupplier {
  /**
   * The display name of the supplier.
   * Used for identifying the supplier in product listings and user interfaces.
   *
   * @example
   * ```typescript
   * const supplier = new SupplierConsolidatedChemical();
   * console.log(`Products from ${supplier.supplierName}`);
   * // Output: "Products from Consolidated Chemical & Solvents"
   * ```
   * @source
   */
  public readonly supplierName: string = 'Consolidated Chemical & Solvents';

  // The base URL for the supplier's website.
  public readonly baseURL: string = 'https://consolidated-chemical.com/';

  // Shipping scope for Consolidated Chemical & Solvents
  public readonly shipping: ShippingRange = 'domestic';

  // The country code of the supplier.
  public readonly country: CountryCode = 'US';

  protected readonly minMatchPercentage: number = 50;

  //protected readonly fuzzScorer: FuzzScorerFn = WRatio;

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];
}
