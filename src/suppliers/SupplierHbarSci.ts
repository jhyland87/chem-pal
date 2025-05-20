import type { Product } from "types";
import ShopifyBase from "./ShopifyBase";

/**
 * SupplierHbarSci class that extends ShopifyBase and implements AsyncIterable<T>.
 * @module SupplierHbarSci
 * @category Supplier
 */
export default class SupplierHbarSci<T extends Product>
  extends ShopifyBase<T>
  implements AsyncIterable<T>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "SupplierHbarSci";

  protected _apiKey: string = "2H3i9C5v0m";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.hbarsci.com";
}
