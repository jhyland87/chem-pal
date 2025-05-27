import { type Product } from "@/types";
import SupplierBaseWix from "./supplierBaseWix";

/**
 * SupplierBioFuranChem class that extends SupplierBaseWix and implements AsyncIterable<Product>.
 * @module SupplierBioFuranChem
 * @category Suppliers
 */
export default class SupplierBioFuranChem
  extends SupplierBaseWix
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "BioFuran Chem";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.biofuranchem.com";
}
