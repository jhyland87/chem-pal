import SupplierBaseShopify from "./SupplierBaseShopify";

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
export default class SupplierBVV extends SupplierBaseShopify implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "BVV";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://shopbvv.com";

  // Shipping scope
  public readonly shipping: ShippingRange = "domestic";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  // Shopify API URL for GraphQL queries
  protected apiURL: string = "best-value-vacs.myshopify.com";
}
