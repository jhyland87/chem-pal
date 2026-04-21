import SupplierBaseMagento2 from "./SupplierBaseMagento2";

/**
 * SupplierAladdinSci class that extends SupplierBaseMagento2 and implements AsyncIterable<Product>.
 *
 * @remarks
 * AladdinSci is a Magento 2 storefront that exposes the public unauthenticated
 * GraphQL endpoint at `/graphql`. The `Store: us_en` header (default) selects
 * the US storefront.
 *
 * @category Suppliers
 * @source
 */
export default class SupplierAladdinSci extends SupplierBaseMagento2 implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "AladdinSci";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.aladdinsci.com";

  // Shipping scope for AladdinSci
  public readonly shipping: ShippingRange = "worldwide";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];
}
