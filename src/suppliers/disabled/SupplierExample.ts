/* THIS FILE IS TO BE IGNORED - Its just a template file for making suppliers. DO NOT DELETE IT. */

import { SupplierBase } from '@/suppliers/SupplierBase';
import type { ProductBuilder } from '@/utils/ProductBuilder';

/**
 * SupplierExample class that extends SupplierBase.
 *
 * @remarks
 * Just a bootstrap supplier that will be used to test the supplier system.
 *
 * @category Suppliers
 * @source
 */
export class SupplierExample extends SupplierBase<Partial<Product>, Product> implements ISupplier {
  // Name of supplier (for display purposes)
  public static readonly supplierName: string = 'Example';

  // Base URL for HTTP(s) requests
  public static readonly baseURL: string = 'https://example.com';

  // Shipping scope
  public static readonly shipping: ShippingRange = 'international';

  // The country code of the supplier.
  public static readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  protected async queryProducts(
    _query: string,
    _limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    return [];
  }

  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return product;
  }

  protected titleSelector(data: Partial<Product>): string {
    return data.title ?? '';
  }

  /**
   * Derives the unique product key from a Foobar product item: its `url` (a
   * stable per-product identifier). Returns an empty-safe string when the url is
   * missing.
   * @param data - The raw Foobar product item
   * @returns The product's URL
   * @example
   * ```typescript
   * this.getUniqueProductKey({ url: "https://example.com/p/1" }); // "https://example.com/p/1"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: Partial<Product>): string {
    return this.href(String(data.url ?? ''));
  }
}
