import { ProductCategory as ACSProductCategory } from "@/constants/amarischemicalsolutions";
import { SupplierBaseWoocommerce } from "./SupplierBaseWoocommerce";

/**
 * Supplier class for Amaris Chemical Solutions, a chemical supplier using the WooCommerce platform.
 * Implements product fetching and parsing functionality specific to Amaris Chemical Solutions's website.
 * The supplier uses the WooCommerce platform to sell its products.
 *
 * @remarks
 * Amaris Chemical Solutions seems to either not list the price for a lot of products on their website
 * or API respones, or sometimes they do but they don't include a quantity anywhere that I can find or
 * parse (sometimes itll show the quantity on the bottle in the photo, but that's not parseable text).
 * Both of these issues would precent items from being included in the search results.
 *
 * @example
 * ```typescript
 * const supplier = new SupplierAmarisChemicalSolutions();
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
 * @see https://amarischemicalsolutions.com/
 * @see https://amarischemicalsolutions.com/wp-json/wc/store/v1/products
 * @source
 */
export class SupplierAmarisChemicalSolutions extends SupplierBaseWoocommerce implements ISupplier {
  /**
   * The display name of the supplier.
   * Used for identifying the supplier in product listings and user interfaces.
   *
   * @example
   * ```typescript
   * const supplier = new SupplierAmarisChemicalSolutions();
   * console.log(`Products from ${supplier.supplierName}`);
   * // Output: "Products from Carolina Chemical"
   * ```
   * @source
   */
  public readonly supplierName: string = "Amaris Chemical Solutions";

  // The base URL for the supplier's website.
  public readonly baseURL: string = "https://amarischemicalsolutions.com";

  // Shipping scope for Alchemie Labs
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  public readonly productSearchFilters: WooCommerceProductSearchParams = {
    category: [
      ACSProductCategory.ACCELERATORS_RETARDERS,
      ACSProductCategory.ACIDULANTS,
      ACSProductCategory.ACTIVE_INGREDIENT,
      ACSProductCategory.ACTIVE_PHARMACEUTICAL_INGREDIENTS_APIS,
      ACSProductCategory.ADDITIVES,
      ACSProductCategory.ADHESION_PROMOTERS,
      ACSProductCategory.AGRICULTURAL_CHEMICALS,
      ACSProductCategory.ANALYTICAL_REAGENTS_LABORATORY_CHEMICALS,
      ACSProductCategory.ANTI_CORROSION_AGENTS,
      ACSProductCategory.ANTI_CORROSION_COATINGS,
      ACSProductCategory.ANTIFOAMING_AGENTS,
      ACSProductCategory.APPLICATION_SPECIFIC_COATINGS,
      ACSProductCategory.AUTOMOTIVE_CHEMICALS,
      ACSProductCategory.BAKING_INGREDIENTS,
      ACSProductCategory.BINDERS_RESINS,
      ACSProductCategory.BIO_BASED_SOLVENTS,
      ACSProductCategory.BIOCHEMICAL_REAGENTS,
      ACSProductCategory.BLEACHING_AGENTS_CLEANING_AND_DETERGENT_CHEMICALS,
      ACSProductCategory.BUILDERS,
      ACSProductCategory.CATALYSTS_SPECIALTY_AND_FINE_CHEMICALS,
      ACSProductCategory.CHELATING_AGENTS,
      ACSProductCategory.CHROMATOGRAPHY_CHEMICALS,
      ACSProductCategory.CLEANING_AND_DETERGENT_CHEMICALS,
      ACSProductCategory.COAGULANTS_AND_FLOCCULANTS,
      ACSProductCategory.COLORANTS_PIGMENTS_DYES,
      ACSProductCategory.COLORANTSFOOD,
      ACSProductCategory.CORROSION_INHIBITORS,
      ACSProductCategory.DYES_AND_PIGMENTS,
      ACSProductCategory.ELECTRONIC_CHEMICALS,
      ACSProductCategory.EMULSIFIERS,
      ACSProductCategory.ENVIRONMENTAL_AND_GREEN_CHEMICALS,
      ACSProductCategory.EXPLOSIVES_AND_BLASTING_AGENTS,
      ACSProductCategory.FERTILIZERS,
      ACSProductCategory.FOOD_AND_BEVERAGE_CHEMICALS,
      ACSProductCategory.FRAGRANCES,
      ACSProductCategory.FRAGRANCES_AND_ESSENTIAL_OILS,
      ACSProductCategory.INDUSTRIAL_ADDITIVES,
      ACSProductCategory.INORGANIC_AND_ORGANIC_STANDARDS,
      ACSProductCategory.LABORATORY_CHEMICALS,
      ACSProductCategory.LABORATORY_SAFETY_CHEMICALS,
      ACSProductCategory.MINING_CHEMICALS,
      ACSProductCategory.MOLECULAR_BIOLOGY_REAGENTS,
      ACSProductCategory.MONOMERS,
      ACSProductCategory.NUTRACEUTICAL_INGREDIENTS_PHARMACEUTICAL,
      ACSProductCategory.OIL_AND_GAS_CHEMICALS,
      ACSProductCategory.CHEMICALS,
      ACSProductCategory.OXIDIZING_AGENTS,
      ACSProductCategory.PESTICIDES_HERBICIDES_INSECTICIDES_FUNGICIDES,
      ACSProductCategory.PH_ADJUSTERS,
      ACSProductCategory.PH_MODIFIERS,
      ACSProductCategory.PHARMACEUTICAL_CHEMICALS,
      ACSProductCategory.PHOTOGRAPHIC_CHEMICALS,
      ACSProductCategory.PIGMENTS,
      ACSProductCategory.PLASTICIZERS,
      ACSProductCategory.PLASTICIZERS_SOFTENERS,
      ACSProductCategory.PLASTICS_AND_POLYMER_MANUFACTURING_CHEMICALS,
      ACSProductCategory.POLYMERIZATION_INITIATORS,
      ACSProductCategory.PRECIOUS_METAL_EXTRACTION_AGENTS,
      ACSProductCategory.PRESERVATIVES,
      ACSProductCategory.PRESERVATIVES_FOOD,
      ACSProductCategory.PYROTECHNIC_CHEMICALS,
      ACSProductCategory.SEALANTS_AND_ADHESIVES,
      ACSProductCategory.RUBBER_PROCESSING_CHEMICALS,
      ACSProductCategory.SOFTENING_AGENTS,
      ACSProductCategory.SOLVENTS_CLEANING,
      ACSProductCategory.SOLVENTS_LAB,
      ACSProductCategory.SOLVENTS_PAINT,
      ACSProductCategory.SOLVENTS_PHARMACEUTICAL,
      ACSProductCategory.SPECIALTY_AND_FINE_CHEMICALS,
      ACSProductCategory.SURFACTANTS_CLEANING,
      ACSProductCategory.TEXTILE_CHEMICALS,
      ACSProductCategory.THICKENERS,
      ACSProductCategory.TOPICAL_STEROIDS,
      ACSProductCategory.VULCANIZING_AGENTS,
      ACSProductCategory.WASTEWATER_TREATMENT_CHEMICALS,
      ACSProductCategory.WATER_TREATMENT_CHEMICALS,
    ].join(","),
    stock_status: ["instock", "onbackorder"],
    orderby: "title",
  };

  // Amaris sits behind a WAF that 403s the first API hit while planting a
  // session cookie, then expects the request retried with that cookie. With
  // credentials:"include" the cookie lands in the jar, so retrying the 403
  // clears the handshake. See SupplierBase.challengeRetryLimit.
  protected readonly challengeRetryLimit: number = 2;

  /**
   * Amaris stores pack sizes under attribute terms (e.g. taxonomy
   * `pa_pack-size`, term name `"500 grams Plastic Tin"`) rather than in the
   * product name/description or in variation attributes. Surface every term
   * name as a quantity-parsing candidate so the base class can extract
   * quantity/UoM via its existing `parseQuantity` pipeline. `parseQuantity`
   * ignores strings that don't match a quantity pattern, so unrelated
   * attribute terms (color, grade, etc.) are harmless.
   * @param item - The raw WooCommerce search response item
   * @returns Term names from every product attribute, as quantity candidates
   * @example
   * ```typescript
   * // input:  { attributes: [{ terms: [{ name: "500 grams Plastic Tin" }] }] }
   * // output: ["500 grams Plastic Tin"]
   * ```
   * @source
   */
  protected getAdditionalQuantityStrings(item: WooCommerceSearchResponseItem): string[] {
    if (!Array.isArray(item.attributes)) return [];
    return item.attributes.flatMap((attr) => attr.terms?.map((term) => term.name) ?? []);
  }
}
