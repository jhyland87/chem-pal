import { SupplierBaseShopify } from './SupplierBaseShopify';

/**
 * SupplierHyperFuels class that extends SupplierBaseShopify.
 *
 * @remarks
 * HyperFuels sells racing and small-engine fuels and fuel chemicals (PurFuels ethanol race
 * fuels, ethanol-free and biobutanol blends). Uses the Shopify GraphQL Storefront API via
 * their myshopify.com domain.
 *
 * @category Suppliers
 * @example
 * ```typescript
 * const supplier = new SupplierHyperFuels('ethanol', 5, new AbortController());
 * const products = await supplier.queryProducts('ethanol', 5);
 * ```
 * @source
 */
export class SupplierHyperFuels extends SupplierBaseShopify implements ISupplier {
  // Name of supplier (for display purposes)
  public static readonly supplierName: string = 'HyperFuels';

  // Base URL for HTTP(s) requests
  public static readonly baseURL: string = 'https://hyperfuels.com';

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
  protected static readonly apiURL: string = 'hyper-fuels.myshopify.com';
}
