import { type Product } from "types";
import SupplierBaseWix from "./supplierBaseWix";

/**
 * SupplierBunmurraLabs class that extends SupplierBaseWix and implements AsyncIterable<T>.
 * @module SupplierBunmurraLabs
 * @category Supplier
 */
export default class SupplierBunmurraLabs
  extends SupplierBaseWix
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Bunmurra Labs";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.bunmurralabs.store";
}
