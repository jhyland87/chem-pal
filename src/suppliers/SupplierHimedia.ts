import { SupplierBaseAmazon } from './SupplierBaseAmazon';

/**
 * Supplier for Himedia (via Amazon marketplace)
 *
 * {@link https://www.amazon.com/s?k=Himedia | Himedias Amazon Listings}
 * @source
 */
export class SupplierHimedia extends SupplierBaseAmazon implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = 'Himedia';

  // Shipping scope for HbarSci
  public readonly shipping: ShippingRange = 'international';

  // The country code of the supplier.
  public readonly country: CountryCode = 'IN';

  // Prefix to add to the query (ie: brand name or seller name)
  protected readonly queryPrefix: string = 'himedia';

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ['amazononly'];

  public readonly amazonStoreURL: string = 'https://www.amazon.com/s?k=HiMedia';

  // Pure-search supplier: the initial search returns every field and
  // getProductData is a passthrough, so there's no per-product detail to cache.
  protected readonly skipProductDetailCache: boolean = true;

  // This should select Himedia as the "Brand" in the search query
  protected extraParams: string = 'rh=p_123:569363';
}
