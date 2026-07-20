import { SupplierBaseMySimpleStore } from "./SupplierBaseMySimpleStore";
/**
 * Supplier implementation for Orbit Natural Product Derivatives (ONPD), a US
 * supplier of natural aroma/pesticide chemicals running on the MySimpleStore
 * platform. Products are searched via the storefront API keyed by {@link storeId};
 * the supplier also sells on eBay, surfaced as an informational store notice.
 * @example
 * ```typescript
 * const supplier = new SupplierOrbitNaturalProductDerivatives("geraniol", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log("Found product:", product.title, product.price);
 * }
 * ```
 * @source
 */
export class SupplierOrbitNaturalProductDerivatives
  extends SupplierBaseMySimpleStore
  implements ISupplier
{
  // Display name of the supplier used for UI and logging
  public readonly supplierName: string = "Orbit Natural Product Derivatives";

  // Base URL for the supplier's own website (product pages, permalinks)
  public readonly baseURL: string = "https://orbitnaturalproductderivatives.com";

  // MySimpleStore store id (uuid) that keys every API request
  public readonly storeId: string = "7692587b-61ba-4b63-b329-a6ebcdb36c13";

  // US-based store; ships domestically
  public readonly shipping: ShippingRange = "domestic";

  // The country code of the supplier
  public readonly country: CountryCode = "US";

  // Accepts cards on its own checkout plus eBay; the eBay store is linked as an
  // informational notice (more products available there), not a restriction.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa", "ebay"];

  // The supplier's eBay storefront, surfaced via the "more products" notice.
  public readonly ebayStoreURL: string = "https://www.ebay.com/usr/orbitnaturalproductderivatives";
}
