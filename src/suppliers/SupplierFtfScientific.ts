import { SupplierBaseWix } from './SupplierBaseWix';

/**
 * SupplierFtfScientific class that extends SupplierBaseWix and implements AsyncIterable<Product>.
 *
 * @category Suppliers
 * @source
 */
export class SupplierFtfScientific extends SupplierBaseWix implements ISupplier {
  // Name of supplier (for display purposes)
  public static readonly supplierName: string = 'FTF Scientific';

  // Base URL for HTTP(s) requests
  public static readonly baseURL: string = 'https://www.ftfscientific.com';

  // Shipping scope for FtfScientific
  public static readonly shipping: ShippingRange = 'worldwide';

  // The country code of the supplier.
  public static readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa', 'paypal', 'other'];

  // Pure-search supplier: the initial search returns every field and
  // getProductData is a passthrough, so there's no per-product detail to cache.
  protected readonly skipProductDetailCache: boolean = true;
}
