import { Product } from "types";
import ShopifyBase from "./shopifyBase";

/**
 * SupplierLaballey class that extends ShopifyBase and implements AsyncIterable<T>.
 * @module SupplierLaballey
 * @category Supplier
 */
export default class SupplierLaballey<T extends Product>
  extends ShopifyBase<T>
  implements AsyncIterable<T>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Laballey";

  protected _apiKey: string = "8B7o0X1o7c";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.laballey.com";
}
