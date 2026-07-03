import { SupplierBaseShopify } from "./SupplierBaseShopify";

/**
 * SupplierTheLabStockroom class that extends SupplierBaseShopify.
 *
 * @remarks
 * The Lab Stockroom (formerly HBar Sci) sells lab chemicals and equipment.
 * Search results come from the Shopify GraphQL Storefront API via their
 * myshopify.com domain. (Replaces the legacy Searchanise implementation,
 * `SupplierTheLabStockroomSearchanise`.) The public site is now
 * `thelabstockroom.com`, but the Shopify backend is still
 * `hbarsci.myshopify.com`.
 *
 * @category Suppliers
 * @source
 */
export class SupplierTheLabStockroom extends SupplierBaseShopify implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "The Lab Stockroom";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.thelabstockroom.com";

  // Shipping scope for The Lab Stockroom
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  // Pure-search supplier: the initial search returns every field and
  // getProductData is a passthrough, so there's no per-product detail to cache.
  protected readonly skipProductDetailCache: boolean = true;

  // Shopify API URL for GraphQL queries
  protected apiURL: string = "hbarsci.myshopify.com";
}
