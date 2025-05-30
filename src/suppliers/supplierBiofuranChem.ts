import { type CountryCode, type Product, type ShippingRange } from "@/types";
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
  public readonly baseURL: string = "https://www.biofuranchem.com";

  // Shipping scope for Biofuran Chem
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  // This is used to determine the currency and other country-specific information.
  public readonly country: CountryCode = "US";
}
