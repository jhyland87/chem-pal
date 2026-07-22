import { SupplierBaseShopify } from './SupplierBaseShopify';

/**
 * SupplierAllianceChemical class that extends SupplierBaseShopify.
 *
 * @remarks
 * Alliance Chemical sells a wide range of chemicals, including acids, bases, and other chemicals.
 * Uses the Shopify GraphQL Storefront API via their myshopify.com domain.
 *
 * @category Suppliers
 * @source
 */
export class SupplierAllianceChemical extends SupplierBaseShopify implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = 'Alliance Chemical';

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = 'https://alliancechemical.com';

  // Shipping scope
  public readonly shipping: ShippingRange = 'domestic';

  // The country code of the supplier.
  public readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  // Pure-search supplier: the initial search returns every field and
  // getProductData is a passthrough, so there's no per-product detail to cache.
  protected readonly skipProductDetailCache: boolean = true;

  // Shopify API URL for GraphQL queries
  protected apiURL: string = 'alliance-chemical-store.myshopify.com';

  private accessToken: string = '93a39f1fae3783a080dafeb7f76e3620';

  private shopId: number = 58827341866;
}
