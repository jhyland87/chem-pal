import { Product } from "../types";
import SupplierWixBase from "./supplier_wixbase";

/**
 * SupplierBioFuranChem class that extends SupplierWixBase and implements AsyncIterable<T>.
 * @module SupplierBioFuranChem
 * @category Supplier
 */
export default class SupplierBioFuranChem<T extends Product>
  extends SupplierWixBase<T>
  implements AsyncIterable<T>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "BioFuran Chem";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.biofuranchem.com";
}
