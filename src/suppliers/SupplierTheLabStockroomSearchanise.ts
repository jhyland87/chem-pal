import { SupplierBaseSearchanise } from './SupplierBaseSearchanise';

/**
 * Legacy Searchanise-based implementation of The Lab Stockroom (formerly HBar Sci).
 *
 * @remarks
 * **Disabled** — this supplier was migrated to the Shopify Storefront API (see
 * `SupplierTheLabStockroom`). Kept for reference/rollback; not exported from the
 * supplier index, so it is not part of the active supplier list.
 *
 * Example search URL: https://www.hbarsci.com/pages/search-results-page?q=acid&tab=products&page=2&rb_filter_ptag_bf51a4bd1f5efe4002b3d50737306113=Chemicals
 *
 * @category Suppliers
 * @deprecated Replaced by the Shopify-based `SupplierTheLabStockroom`.
 * @source
 */
export class SupplierTheLabStockroomSearchanise
  extends SupplierBaseSearchanise
  implements ISupplier
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = 'The Lab Stockroom';

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = 'https://www.hbarsci.com';

  // Shipping scope for The Lab Stockroom
  public readonly shipping: ShippingRange = 'international';

  // The country code of the supplier.
  public readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  // Pure-search supplier: the initial search returns every field and
  // getProductData is a passthrough, so there's no per-product detail to cache.
  protected readonly skipProductDetailCache: boolean = true;

  // API key for Typesense search API
  protected apiKey: string = '2H3i9C5v0m';

  // Base search parameters for Typesense search API
  protected baseSearchParams: QueryParams = {
    tab: 'products',

    'restrictBy[filter_ptag_bf51a4bd1f5efe4002b3d50737306113]': 'Chemicals',
  };
}
