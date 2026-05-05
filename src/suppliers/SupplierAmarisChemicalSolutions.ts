import SupplierBaseWoocommerce from "./SupplierBaseWoocommerce";

/**
 * Supplier class for Amaris Chemical Solutions, a chemical supplier using the WooCommerce platform.
 * Implements product fetching and parsing functionality specific to Amaris Chemical Solutions's website.
 * The supplier uses the WooCommerce platform to sell its products.
 *
 * @remarks
 * Amaris Chemical Solutions seems to either not list the price for a lot of products on their website
 * or API respones, or sometimes they do but they don't include a quantity anywhere that I can find or
 * parse (sometimes itll show the quantity on the bottle in the photo, but that's not parseable text).
 * Both of these issues would precent items from being included in the search results.
 *
 * @example
 * ```typescript
 * const supplier = new SupplierAmarisChemicalSolutions();
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
 * @see https://amarischemicalsolutions.com/
 * @see https://amarischemicalsolutions.com/wp-json/wc/store/v1/products
 * @source
 */
export default class SupplierAmarisChemicalSolutions
  extends SupplierBaseWoocommerce
  implements ISupplier
{
  /**
   * The display name of the supplier.
   * Used for identifying the supplier in product listings and user interfaces.
   *
   * @example
   * ```typescript
   * const supplier = new SupplierAmarisChemicalSolutions();
   * console.log(`Products from ${supplier.supplierName}`);
   * // Output: "Products from Carolina Chemical"
   * ```
   * @source
   */
  public readonly supplierName: string = "Amaris Chemical Solutions";

  // The base URL for the supplier's website.
  public readonly baseURL: string = "https://amarischemicalsolutions.com";

  // Shipping scope for Alchemie Labs
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  /**
   * Amaris stores pack sizes under attribute terms (e.g. taxonomy
   * `pa_pack-size`, term name `"500 grams Plastic Tin"`) rather than in the
   * product name/description or in variation attributes. Surface every term
   * name as a quantity-parsing candidate so the base class can extract
   * quantity/UoM via its existing `parseQuantity` pipeline. `parseQuantity`
   * ignores strings that don't match a quantity pattern, so unrelated
   * attribute terms (color, grade, etc.) are harmless.
   * @param item - The raw WooCommerce search response item
   * @returns Term names from every product attribute, as quantity candidates
   * @example
   * ```typescript
   * // input:  { attributes: [{ terms: [{ name: "500 grams Plastic Tin" }] }] }
   * // output: ["500 grams Plastic Tin"]
   * ```
   * @source
   */
  protected getAdditionalQuantityStrings(
    item: WooCommerceSearchResponseItem,
  ): string[] {
    if (!Array.isArray(item.attributes)) return [];
    return item.attributes.flatMap((attr) => attr.terms?.map((term) => term.name) ?? []);
  }
}
