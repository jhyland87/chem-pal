import { SupplierBaseShopify } from './SupplierBaseShopify';

/**
 * SupplierBVV class that extends SupplierBaseShopify.
 *
 * @remarks
 * BVV (Best Value Vacs) sells vacuum and extraction equipment, along with related lab
 * supplies and solvents. Uses the Shopify GraphQL Storefront API via their myshopify.com
 * domain.
 *
 * @category Suppliers
 * @source
 */
export class SupplierBVV extends SupplierBaseShopify implements ISupplier {
  // Name of supplier (for display purposes)
  public static readonly supplierName: string = 'BVV';

  // Base URL for HTTP(s) requests
  public static readonly baseURL: string = 'https://shopbvv.com';

  // Shipping scope
  public static readonly shipping: ShippingRange = 'domestic';

  // The country code of the supplier.
  public static readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  // Pure-search supplier: the initial search returns every field and
  // getProductData is a passthrough, so there's no per-product detail to cache.
  protected readonly skipProductDetailCache: boolean = true;

  // Shopify API URL for GraphQL queries
  protected static readonly apiURL: string = 'best-value-vacs.myshopify.com';
}
