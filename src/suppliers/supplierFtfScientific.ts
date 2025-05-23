import { type Product } from "types";
import SupplierBaseWix from "./supplierBaseWix";

/**
 * SupplierFtfScientific class that extends SupplierBaseWix and implements AsyncIterable<Product>.
 * @module SupplierFtfScientific
 * @category Supplier
 */
export default class SupplierFtfScientific
  extends SupplierBaseWix
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "FTF Scientific";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.ftfscientific.com";
}
