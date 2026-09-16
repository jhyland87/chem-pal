import { findPdfHref, stripPdfLink } from '@/helpers/utils';
import type { ProductBuilder } from '@/utils/ProductBuilder';
import { SupplierBaseWoocommerce } from './SupplierBaseWoocommerce';

/**
 * Supplier class for DIY Chemicals, a chemical supplier using the WooCommerce platform.
 * Implements product fetching and parsing functionality specific to DIY Chemicals's website.
 *
 * @example
 * ```typescript
 * const supplier = new SupplierDiyChemicals();
 *
 * // Iterate over all products
 * for await (const product of supplier) {
 *   console.log(product.name, product.cas, product.price);
 * }
 *
 * // Search for specific products
 * const products = await supplier.search("acetone");
 * console.log(`Found ${products.length} products`);
 * ```
 *
 * @see https://diychemicals.com/
 * @see https://diychemicals.com/wp-json/wc/store/v1/products
 * @source
 */
export class SupplierDiyChemicals extends SupplierBaseWoocommerce implements ISupplier {
  /**
   * The display name of the supplier.
   * Used for identifying the supplier in product listings and user interfaces.
   *
   * @example
   * ```typescript
   * const supplier = new SupplierDiyChemicals();
   * console.log(`Products from ${supplier.supplierName}`);
   * // Output: "Products from DIY Chemicals"
   * ```
   * @source
   */
  public static readonly supplierName: string = 'DIY Chemicals';

  // The base URL for the supplier's website.
  public static readonly baseURL: string = 'https://diychemicals.com';

  // Shipping scope for DIY Chemicals
  public static readonly shipping: ShippingRange = 'domestic';

  // The country code of the supplier.
  public static readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = [
    'mastercard',
    'visa',
    'paypal',
    'amazon',
  ];

  /**
   * DIY Chemicals stores each variation's pack size as a slug under
   * `variations[].attributes[].value` (e.g. `"4-gallon-pack"`), which
   * `parseQuantity` can't read since it has no whitespace between the number
   * and the unit. The human-readable form lives instead on the product-level
   * `attributes[].terms[].name` (e.g. `"4 Gallon Pack"`). Surface every term
   * name as a quantity-parsing candidate so the base class can extract
   * quantity/UoM via its existing `parseQuantity` pipeline. `parseQuantity`
   * ignores strings that don't match a quantity pattern, so unrelated
   * attribute terms are harmless.
   * @param item - The raw WooCommerce search response item
   * @returns Term names from every product attribute, as quantity candidates
   * @example
   * ```typescript
   * // input:  { attributes: [{ terms: [{ name: "4 Gallon Pack" }] }] }
   * // output: ["4 Gallon Pack"]
   * ```
   * @source
   */
  protected getAdditionalQuantityStrings(item: WooCommerceSearchResponseItem): string[] {
    if (!Array.isArray(item.attributes)) return [];
    return item.attributes.flatMap((attr) => attr.terms?.map((term) => term.name) ?? []);
  }

  /**
   * DIY Chemicals embeds its SDS link directly in the product description as
   * an `<a href="….pdf">DOWNLOAD SDS</a>` anchor (usually at the start,
   * occasionally at the end), rather than exposing it as its own field.
   * Left alone, the base class's plain `htmlToAscii` conversion strips the
   * markup and drops the `href`, leaving the dead text "DOWNLOAD SDS" sitting
   * in the description with no way to reach the actual document. Runs after
   * the base class builds its builders, extracting the link's URL into
   * `sdsUrl` via `findPdfHref` and removing the anchor from the description
   * text via `stripPdfLink`. `findPdfHref` matches the first PDF link in the
   * description regardless of what it's for, so the match is additionally
   * required to mention "sds" (every real example's URL contains "MSDS")
   * before being trusted as the SDS — an unrelated PDF (a spec sheet, say)
   * is left alone rather than misfiled as the safety data sheet. Products
   * with no matching link are returned untouched.
   * @param results - Array of WooCommerce search response items
   * @returns Product builders with the SDS link moved out of the description
   * and into `sdsUrl`, where present
   * @example
   * ```typescript
   * // input description: '<p><a href="…MSDS….pdf">DOWNLOAD SDS</a></p><h1>EDTA 40%</h1>...'
   * // output: builder.dump().sdsUrl -> "…MSDS….pdf"
   * // output: builder.dump().description -> "EDTA 40%\n..." (no "DOWNLOAD SDS" text)
   * ```
   * @source
   */
  protected initProductBuilders(results: WooCommerceSearchResponseItem[]): ProductBuilder<Product>[] {
    const builders = super.initProductBuilders(results);
    return builders.map((builder, index) => {
      const description = results[index]?.description;
      if (typeof description !== 'string') return builder;

      const sdsUrl = findPdfHref(description);
      if (sdsUrl && /sds/i.test(sdsUrl)) {
        builder.setDescription(stripPdfLink(description)).setSDSUrl(sdsUrl);
      }
      return builder;
    });
  }
}
