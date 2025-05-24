import { type Product } from "@/types";
import SupplierBaseShopify from "./supplierBaseShopify";

/**
 * SupplierLaballey class that extends SupplierBaseShopify and implements AsyncIterable<T>.
 * @module SupplierLaballey
 * @category Supplier
 */
export default class SupplierLaballey
  extends SupplierBaseShopify
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Laballey";

  protected _apiKey: string = "8B7o0X1o7c";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.laballey.com";
}
