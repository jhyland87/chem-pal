import { SupplierBaseSearchanise } from './SupplierBaseSearchanise';

/**
 * SupplierLaballey class that extends SupplierBaseSearchanise and implements AsyncIterable<T>.
 *
 * @category Suppliers
 * @source
 */
export class SupplierLaballey extends SupplierBaseSearchanise implements ISupplier {
  // Name of supplier (for display purposes)
  public static readonly supplierName: string = 'Laballey';

  // Base URL for HTTP(s) requests
  public static readonly baseURL: string = 'https://www.laballey.com';

  // Shipping scope for Laballey
  public static readonly shipping: ShippingRange = 'international';

  // The country code of the supplier.
  public static readonly country: CountryCode = 'US';

  // API key for Typesense search API
  protected apiKey: string = '8B7o0X1o7c';

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  // Pure-search supplier: the initial search returns every field and
  // getProductData is a passthrough, so there's no per-product detail to cache.
  protected readonly skipProductDetailCache: boolean = true;
}
