import { Product } from "types";
import SupplierWixBase from "./supplierWixBase";

/**
 * SupplierBunmurraLabs class that extends SupplierWixBase and implements AsyncIterable<T>.
 * @module SupplierBunmurraLabs
 * @category Supplier
 */
export default class SupplierBunmurraLabs<T extends Product>
  extends SupplierWixBase<T>
  implements AsyncIterable<T>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Bunmurra Labs";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.bunmurralabs.store";
}
