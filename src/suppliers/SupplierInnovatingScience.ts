import SupplierBaseAmazon from "./SupplierBaseAmazon";

/**
 * Supplier for Aldon Innovating Science (via Amazon marketplace)
 *
 * {@link https://www.amazon.com/stores/InnovatingScience/page/7D52B12B-90B5-4526-9355-D3F6B80B2E9D| Aldon Innovating Science Amazon Listings}
 */
export default class SupplierInnovatingScience extends SupplierBaseAmazon implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Innovating Science";

  // Shipping scope for HbarSci
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  // Terms that much be found in the listing (one of these terms must be found)
  protected termsFoundInListing: string[] = ["innovating science", "aldon"];
}
