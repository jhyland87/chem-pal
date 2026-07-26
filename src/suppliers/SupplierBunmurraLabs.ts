import { SupplierBaseWix } from './SupplierBaseWix';
/* @hideconstructor */
/* @hideden */
/**
 * Supplier implementation for BunmurraLabs, a US based chemical supplier.
 *
 * @deprecated Supplier is redoing website and has not gotten the new one live yet.
 * @source
 */
export class SupplierBunmurraLabs extends SupplierBaseWix implements ISupplier {
  /* @deprecated */
  // Name of supplier (for display purposes)
  public static readonly supplierName: string = 'Bunmurra Labs';

  // Base URL for HTTP(s) requests
  public static readonly baseURL: string = 'https://www.bunmurralabs.store';

  // Shipping scope for Bunmurra Labs
  public static readonly shipping: ShippingRange = 'domestic';

  // The country code of the supplier.
  public static readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  // Pure-search supplier: the initial search returns every field and
  // getProductData is a passthrough, so there's no per-product detail to cache.
  protected readonly skipProductDetailCache: boolean = true;
}
