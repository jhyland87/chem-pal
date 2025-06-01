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
  // The display name of the supplier.
  public readonly supplierName: string = "LibertySci";

  // Shipping scope for LibertySci
  public readonly shipping: ShippingRange = "worldwide";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The base URL for the supplier's website.
  public readonly baseURL: string = "https://libertysci.com";
}
