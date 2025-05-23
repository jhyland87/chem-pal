import { type Product } from "types";
import SupplierWixBase from "./supplierWixBase";

/**
 * SupplierBioFuranChem class that extends SupplierWixBase and implements AsyncIterable<Product>.
 * @module SupplierBioFuranChem
 * @category Supplier
 */
export default class SupplierBioFuranChem
  extends SupplierWixBase
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "BioFuran Chem";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.biofuranchem.com";
}
