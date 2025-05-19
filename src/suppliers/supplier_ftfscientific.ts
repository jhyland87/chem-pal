import type { Product } from "types";
import SupplierWixBase from "./supplier_wixbase";

/**
 * SupplierFtfScientific class that extends SupplierWixBase and implements AsyncIterable<T>.
 * @module SupplierFtfScientific
 * @category Supplier
 */
export default class SupplierFtfScientific<T extends Product>
  extends SupplierWixBase<T>
  implements AsyncIterable<T>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "FTF Scientific";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.ftfscientific.com";
}
