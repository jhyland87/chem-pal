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

      // LibertySci puts the formula immediately before a formula/molecular weight label
      // (e.g. "NaOH, F.W. 40.00"). Anchor on that label: scanning the whole description
      // instead mistakes the "F.W." label itself for a formula (F·W — both real element
      // symbols) or a code like "UN1824" for one. Without a label (e.g. solutions) there's
      // no reliable formula to read, so leave it unset.
      const weightMatch = description.match(MOLE_WEIGHT_REGEX);
      if (!weightMatch) {
        return;
      }

      builder.setMoleweight(weightMatch[1]);

      // The formula is the last non-empty segment before the label. setFormula runs
      // findFormulaInHtml internally, so a tagged formula like "KClO<sub>3</sub>" is
      // rendered to "KClO₃" and a clean one like "NaOH" is stored as-is.
      const formulaSegment = description
        .slice(0, weightMatch.index)
        .split(/<br\s*\/?>|\r?\n/i)
        .map((segment) => segment.trim())
        .filter(Boolean)
        .pop()
        ?.replace(/[\s,;:·]+$/, "");
      if (formulaSegment) {
        builder.setFormula(formulaSegment);
      }
    });

    return builders;
  }
}
