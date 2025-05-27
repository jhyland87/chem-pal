import { type Product } from "@/types";
import SupplierBaseShopify from "./supplierBaseShopify";

/**
 * SupplierHbarSci class that extends SupplierBaseShopify and implements AsyncIterable<T>.
 *
 * Example search URL: https://www.hbarsci.com/pages/search-results-page?q=acid&tab=products&page=2&rb_filter_ptag_bf51a4bd1f5efe4002b3d50737306113=Chemicals
 * @module SupplierHbarSci
 * @category Suppliers
 */
export default class SupplierHbarSci extends SupplierBaseShopify implements AsyncIterable<Product> {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "SupplierHbarSci";

  protected _apiKey: string = "2H3i9C5v0m";

  protected _baseSearchParams: Record<string, string> = {
    tab: "products",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "restrictBy[filter_ptag_bf51a4bd1f5efe4002b3d50737306113]": "Chemicals",
  };

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.hbarsci.com";
}
