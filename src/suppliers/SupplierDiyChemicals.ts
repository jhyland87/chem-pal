import { SupplierBaseWoocommerce } from './SupplierBaseWoocommerce';

/**
 * Supplier class for DIY Chemicals, a chemical supplier using the WooCommerce platform.
 * Implements product fetching and parsing functionality specific to DIY Chemicals's website.
 *
 * @example
 * ```typescript
 * const supplier = new SupplierDiyChemicals();
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
 * @see https://diychemicals.com/
 * @see https://diychemicals.com/wp-json/wc/store/v1/products
 * @source
 */
export class SupplierDiyChemicals extends SupplierBaseWoocommerce implements ISupplier {
  /**
   * The display name of the supplier.
   * Used for identifying the supplier in product listings and user interfaces.
   *
   * @example
   * ```typescript
   * const supplier = new SupplierDiyChemicals();
   * console.log(`Products from ${supplier.supplierName}`);
   * // Output: "Products from DIY Chemicals"
   * ```
   * @source
   */
  public static readonly supplierName: string = 'DIY Chemicals';

  // The base URL for the supplier's website.
  public static readonly baseURL: string = 'https://diychemicals.com';

  // Shipping scope for DIY Chemicals
  public static readonly shipping: ShippingRange = 'domestic';

  // The country code of the supplier.
  public static readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = [
    'mastercard',
    'visa',
    'paypal',
    'amazon',
  ];

  /**
   * DIY Chemicals stores each variation's pack size as a slug under
   * `variations[].attributes[].value` (e.g. `"4-gallon-pack"`), which
   * `parseQuantity` can't read since it has no whitespace between the number
   * and the unit. The human-readable form lives instead on the product-level
   * `attributes[].terms[].name` (e.g. `"4 Gallon Pack"`). Surface every term
   * name as a quantity-parsing candidate so the base class can extract
   * quantity/UoM via its existing `parseQuantity` pipeline. `parseQuantity`
   * ignores strings that don't match a quantity pattern, so unrelated
   * attribute terms are harmless.
   * @param item - The raw WooCommerce search response item
   * @returns Term names from every product attribute, as quantity candidates
   * @example
   * ```typescript
   * // input:  { attributes: [{ terms: [{ name: "4 Gallon Pack" }] }] }
   * // output: ["4 Gallon Pack"]
   * ```
   * @source
   */
  protected getAdditionalQuantityStrings(item: WooCommerceSearchResponseItem): string[] {
    if (!Array.isArray(item.attributes)) return [];
    return item.attributes.flatMap((attr) => attr.terms?.map((term) => term.name) ?? []);
  }
}
