import { type Product } from "types";
import SupplierBaseWoocommerce from "./supplierBaseWoocommerce";

/**
 * Carolina Chemical - Uses  WooCommerce platform.
 * @see https://www.carolinachemical.com/
 * @see https://carolinachemical.com/wp-json/wc/store/v1/products
 * @module SupplierCarolinaChemical
 * @category Supplier
 */
export default class SupplierCarolinaChemical
  extends SupplierBaseWoocommerce
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Carolina Chemical";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://carolinachemical.com";
}
