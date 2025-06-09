import SupplierBaseAmazon from "./SupplierBaseAmazon";

/**
 * Supplier for Himedia (via Amazon marketplace)
 *
 * {@link https://www.amazon.com/s?k=Himedia | Himedias Amazon Listings}
 */
export default class SupplierHimedia extends SupplierBaseAmazon implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Himedia";

  // Shipping scope for HbarSci
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "IN";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];
}
