import SupplierBaseAmazon from "./SupplierBaseAmazon";

/**
 * Supplier for Akmekem (via Amazon marketplace)
 *
 * @remarks
 * I'm like 90% sure that Akmekem on Amazon is actually just Macklin, but if not, it's
 * an intermediate supplier who makes it easier to purchase from Macklin.
 * {@link https://www.amazon.com/s?k=Akmekem | Akmechem Amazon Listings}
 */
export default class SupplierAkmekem extends SupplierBaseAmazon implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Akmekem";

  // Shipping scope for HbarSci
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "CN";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  // Terms found in the listing
  protected termsFoundInListing: string[] = ["macklin", "akmekem"];
}
