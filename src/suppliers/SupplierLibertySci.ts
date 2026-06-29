import { ProductBuilder } from "@/utils/ProductBuilder";
import { SupplierBaseWoocommerce } from "./SupplierBaseWoocommerce";

// Matches a molecular/formula weight label and its value in a description, e.g. "F.W. 122.55",
// "M.W.: 98.1", "Molecular Weight 140.22". The numeric value is captured in group 1.
const MOLE_WEIGHT_REGEX =
  /(?:f\.?\s*w\.?|m\.?\s*w\.?|molecular\s+weight|formula\s+weight)\s*[:.=]?\s*(\d+(?:\.\d+)?)/i;

/**
 * Supplier class for LibbertySci, a chemical supplier using the WooCommerce platform.
 * Implements product fetching and parsing functionality specific to LibertySci's website.
 *
 * @example
 * ```typescript
 * const supplier = new SupplierLibertySci();
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
 * @see https://www.libertysci.com/
 * @see https://www.libertysci.com/wp-json/wc/store/v1/products
 * @source
 */
export class SupplierLibertySci extends SupplierBaseWoocommerce implements ISupplier {
  // The display name of the supplier.
  public readonly supplierName: string = "LibertySci";

  // Shipping scope for LibertySci
  public readonly shipping: ShippingRange = "worldwide";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The base URL for the supplier's website.
  public readonly baseURL: string = "https://libertysci.com";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  /**
   * Builds the base WooCommerce product builders, then enriches each with the chemical formula and
   * molecular weight that LibertySci embeds in the product description (e.g. "KClO<sub>3</sub>,
   * F.W. 122.55"). The other description-derived fields (CAS, image, thumbnail, rating, review
   * count) are already handled by the base class.
   *
   * @param results - Array of WooCommerce product items from the search response
   * @returns Array of ProductBuilder instances with formula and molecular weight populated
   * @example
   * ```typescript
   * const builders = this.initProductBuilders(items);
   * // builders[0] now carries e.g. formula "KClO₃" and moleweight 122.55
   * ```
   * @source
   */
  protected initProductBuilders(
    results: WooCommerceSearchResponseItem[],
  ): ProductBuilder<Product>[] {
    // The base maps items to builders 1:1 (no filtering), so indexes line up with `results`.
    const builders = super.initProductBuilders(results);

    builders.forEach((builder, index) => {
      const description = results[index]?.description;
      if (typeof description !== "string" || description.length === 0) {
        return;
      }

      // setFormula runs findFormulaInHtml internally, so the raw HTML description (with <sub> tags)
      // is extracted into a display-formatted formula like "KClO₃".
      builder.setFormula(description);

      const moleWeight = description.match(MOLE_WEIGHT_REGEX)?.[1];
      if (moleWeight) {
        builder.setMoleweight(moleWeight);
      }
    });

    return builders;
  }
}
