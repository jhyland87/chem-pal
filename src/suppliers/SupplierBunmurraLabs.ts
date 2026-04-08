import SupplierBaseWix from "./SupplierBaseWix";
/* @hideconstructor */
/* @hideden */
/**
 * Supplier implementation for BunmurraLabs, a US based chemical supplier.
 *
 * @deprecated Supplier is redoing website and has not gotten the new one live yet.
 * @source
 */
export default class SupplierBunmurraLabs extends SupplierBaseWix implements ISupplier {
  /* @deprecated */
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Bunmurra Labs";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.bunmurralabs.store";

  // Shipping scope for Bunmurra Labs
  public readonly shipping: ShippingRange = "domestic";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];
}
