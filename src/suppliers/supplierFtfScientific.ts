import { SHIPPING_SCOPE } from "@/constants/common";
import { type CountryCode, type Product } from "@/types";
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
  protected _baseURL: string = "https://www.ftfscientific.com";

  /**
   * Shipping scope for FtfScientific
   * @defaultValue SHIPPING_SCOPE.Worldwide
   */
  public readonly shippingScope: SHIPPING_SCOPE = SHIPPING_SCOPE.Worldwide;

  /**
   * The country code of the supplier.
   * This is used to determine the currency and other country-specific information.
   */
  public readonly countryCode: CountryCode = "US";
}
