/* THIS FILE IS TO BE IGNORED - Its just a template file for making suppliers. DO NOT DELETE IT. */

import type { ProductBuilder } from "@/utils/ProductBuilder";
import { SupplierBase } from "./SupplierBase";

/**
 * SupplierVWR class that extends SupplierBase.
 *
 * @remarks
 * Just a bootstrap supplier that will be used to test the supplier system.
 *
 * @category Suppliers
 * @source
 */
export class SupplierFoobar extends SupplierBase<Partial<Product>, Product> implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Foobar";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://foobar.com";

  // Shipping scope
  public readonly shipping: ShippingRange = "domestic";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    return [];
  }

  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return product;
  }

  protected titleSelector(data: Partial<Product>): string {
    return data.title ?? "";
  }
}
