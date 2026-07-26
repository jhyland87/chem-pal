import { SupplierBaseShopify } from './SupplierBaseShopify';

/**
 * SupplierGoldAndSilverTesting class that extends SupplierBaseShopify.
 *
 * @remarks
 * Gold and Silver Testing sells precious metal testing kits, acids, and supplies.
 * Uses the Shopify GraphQL Storefront API via their myshopify.com domain.
 *
 * @category Suppliers
 * @source
 */
export class SupplierGoldAndSilverTesting extends SupplierBaseShopify implements ISupplier {
  // Name of supplier (for display purposes)
  public static readonly supplierName: string = 'Gold and Silver Testing';

  // Base URL for HTTP(s) requests
  public static readonly baseURL: string = 'https://www.goldandsilvertesting.com';

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
  protected static readonly apiURL: string = 'gold-testing-equipment.myshopify.com';
}
