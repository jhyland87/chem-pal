import { SHIPPING_SCOPE } from "@/constants/common";
import { type CountryCode, type Product } from "@/types";
import SupplierBaseShopify from "./supplierBaseShopify";

/**
 * SupplierLaballey class that extends SupplierBaseShopify and implements AsyncIterable<T>.
 * @module SupplierLaballey
 * @category Suppliers
 */
export default class SupplierLaballey
  extends SupplierBaseShopify
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Laballey";

  protected _apiKey: string = "8B7o0X1o7c";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.laballey.com";

  /**
   * Shipping scope for Laballey
   * @defaultValue SHIPPING_SCOPE.International
   */
  public readonly shippingScope: SHIPPING_SCOPE = SHIPPING_SCOPE.International;

  /**
   * The country code of the supplier.
   * This is used to determine the currency and other country-specific information.
   */
  public readonly countryCode: CountryCode = "US";
}
