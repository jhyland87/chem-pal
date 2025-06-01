import SupplierBaseWix from "./supplierBaseWix";

/**
 * SupplierFtfScientific class that extends SupplierBaseWix and implements AsyncIterable<Product>.
 * @module SupplierFtfScientific
 * @category Suppliers
 */
export default class SupplierFtfScientific
  extends SupplierBaseWix
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "FTF Scientific";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.ftfscientific.com";

  // Shipping scope for FtfScientific
  public readonly shipping: ShippingRange = "worldwide";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";
}
