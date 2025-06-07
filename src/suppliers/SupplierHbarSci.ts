import SupplierBaseShopify from "./SupplierBaseShopify";

/**
 * SupplierHbarSci class that extends SupplierBaseShopify and implements AsyncIterable<T>.
 *
 * @remarks
 *
 * Example search URL: https://www.hbarsci.com/pages/search-results-page?q=acid&tab=products&page=2&rb_filter_ptag_bf51a4bd1f5efe4002b3d50737306113=Chemicals
 *
 * @category Suppliers
 */
export default class SupplierHbarSci extends SupplierBaseShopify implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "SupplierHbarSci";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.hbarsci.com";

  // Shipping scope for HbarSci
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // API key for Typesense search API
  protected apiKey: string = "2H3i9C5v0m";

  // Base search parameters for Typesense search API
  protected baseSearchParams: Record<string, string> = {
    tab: "products",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "restrictBy[filter_ptag_bf51a4bd1f5efe4002b3d50737306113]": "Chemicals",
  };
}
