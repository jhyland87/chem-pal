import { parseQuantity } from "@/helpers/quantity";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { SupplierBaseShopify } from "./SupplierBaseShopify";

/** Storefront tag prefix (capital "C") marking a product as a specific chemical, e.g. `Chemical_Sodium Iodide`. */
const CHEMICAL_TAG_PREFIX = "Chemical_";

/**
 * Storefront tags that force-exclude a product even when it also carries a
 * chemical tag. Some equipment (e.g. indicator/test strips) is tagged as both
 * `Chemical_*` and `Category_Lab Equipment`; the equipment tag wins so those
 * don't surface as reagents.
 */
const EXCLUDED_TAGS: ReadonlySet<string> = new Set(["Category_Lab Equipment"]);

/**
 * Keyword-to-grade mappings for deriving a purity grade from a `Grade_`/`Grade__`
 * storefront tag. Matched by substring on the tag (lowercased), so variants
 * collapse together — `Grade_Lab`, `Grade_Lab-Grade`, and `Grade__Laboratory-Grade`
 * all yield "Lab Grade". Ordered most-specific first so, e.g., an ACS tag isn't
 * shadowed by a broader match.
 */
const GRADE_TAG_MATCHERS: ReadonlyArray<{ keyword: string; grade: string }> = [
  { keyword: "acs", grade: "ACS Grade" },
  { keyword: "reagent", grade: "Reagent Grade" },
  { keyword: "lab", grade: "Lab Grade" },
];

/**
 * Storefront tags that mark a product as a chemical/reagent rather than
 * equipment. A product is kept when it carries any of these tags or one
 * prefixed with `CHEMICAL_TAG_PREFIX`. Untagged products are handled
 * separately (kept only when their title yields a quantity).
 */
const CHEMICAL_TAGS: ReadonlySet<string> = new Set([
  "Category_Chemicals",
  "Chemistry_Chemicals",
  "Grade_Reagent-Grade",
  "Subject_Chemistry",
  "Chemistry",
  "Grade_Lab",
  "Subcategory_Acids and Bases",
  "Grade_Reagent",
  "Chemicals_Acids & Bases",
  "Grade__Laboratory-Grade",
  "Grade_ACS",
  "Grade_ACS-Grade",
  "Chemicals_Organic Compounds",
  "Chemicals_Solutions",
]);

/**
 * SupplierTheLabStockroom class that extends SupplierBaseShopify.
 *
 * @remarks
 * The Lab Stockroom (formerly HBar Sci) sells lab chemicals and equipment.
 * Search results come from the Shopify GraphQL Storefront API via their
 * myshopify.com domain. (Replaces the legacy Searchanise implementation,
 * `SupplierTheLabStockroomSearchanise`.) The public site is now
 * `thelabstockroom.com`, but the Shopify backend is still
 * `hbarsci.myshopify.com`.
 *
 * Beyond the shared Shopify parsing, {@link getProductData} probes a
 * predictable S3 location for the product's SDS PDF (keyed on the uppercase
 * SKU) and attaches it when present.
 *
 * @category Suppliers
 * @source
 */
export class SupplierTheLabStockroom extends SupplierBaseShopify implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "The Lab Stockroom";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.thelabstockroom.com";

  // Shipping scope for The Lab Stockroom
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  // Shopify API URL for GraphQL queries
  protected apiURL: string = "hbarsci.myshopify.com";

  // Base of the public S3 bucket that hosts SDS PDFs, keyed by uppercase SKU.
  private readonly sdsBaseUrl: string = "https://s3.amazonaws.com/enalas-public/Public/SDS";

  /**
   * Enriches a product with its SDS document link. The Shopify search response
   * carries every displayed field, so the only per-product work is probing the
   * SDS bucket (see {@link applySdsUrl}); the result is cached so a repeat search
   * doesn't re-probe.
   * @param product - The product builder from the Shopify search response
   * @returns The enriched builder (with `sdsUrl` set when a document exists)
   * @example
   * ```typescript
   * const [p] = (await this.queryProducts("sodium hydroxide", 1)) ?? [];
   * const enriched = p ? await this.getProductData(p) : undefined;
   * // enriched?.get("sdsUrl") === "https://s3.amazonaws.com/enalas-public/Public/SDS/IS28090.pdf"
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      await this.applySdsUrl(builder);
      return builder;
    });
  }

  /**
   * Probes the SDS bucket for `${sdsBaseUrl}/${SKU}.pdf` (SKU uppercased) with a
   * HEAD request via the background fetcher, and sets the product's `sdsUrl`
   * when it responds 200. No-ops when the product has no SKU, and swallows any
   * network error (the product is still listed, just without an SDS link). The
   * SDS is attached to the product only — not its variants.
   * @param builder - The product builder to enrich
   * @returns A promise that resolves once the probe completes
   * @example
   * ```typescript
   * await this.applySdsUrl(builder); // builder.get("sdsUrl") set iff the PDF exists
   * ```
   * @source
   */
  protected async applySdsUrl(builder: ProductBuilder<Product>): Promise<void> {
    const sku = builder.get("sku");
    if (typeof sku !== "string" || sku.trim() === "") {
      return;
    }
    const sdsUrl = `${this.sdsBaseUrl}/${sku.toUpperCase()}.pdf`;
    try {
      const response = await this.backgroundFetch(sdsUrl, {
        method: "HEAD",
        headers: { "content-type": "application/json" },
      });
      if (response.status === 200) {
        builder.setSDSUrl(sdsUrl);
      } else {
        this.logger.debug("No SDS document at probed URL", { sdsUrl, status: response.status });
      }
    } catch (error) {
      this.logger.debug("SDS HEAD probe failed", { sdsUrl, error });
    }
  }

  /**
   * Drops non-chemical results (equipment, kits, glassware) so a broad search
   * like `potassium OR sodium` doesn't surface, e.g., a sodium spoon. A product
   * is kept when it carries a qualifying chemical tag (see {@link isChemicalProduct}).
   * @param products - The fuzzy-matched Shopify product nodes
   * @returns Only the nodes that look like chemicals/reagents
   * @example
   * ```typescript
   * this.filterProducts(nodes); // Drops the "Medium Sodium Spoon" node
   * ```
   * @source
   */
  protected override filterProducts(products: ShopifyProductNode[]): ShopifyProductNode[] {
    return products.filter((product) => this.isChemicalProduct(product));
  }

  /**
   * Decides whether a product is a chemical/reagent worth showing. A product is
   * rejected outright when any tag is in `EXCLUDED_TAGS` (equipment wins even
   * over a chemical tag, e.g. test strips tagged both). Otherwise a tagged
   * product qualifies when any tag is in `CHEMICAL_TAGS` or is prefixed with
   * `CHEMICAL_TAG_PREFIX`. An untagged product (many real chemicals
   * carry no storefront tags) qualifies only when its title yields a parseable
   * quantity, which keeps untagged chemicals while still excluding untagged
   * equipment.
   * @param product - The Shopify product node to classify
   * @returns True when the product should appear in results
   * @example
   * ```typescript
   * this.isChemicalProduct(sodiumIodideNode) // true  (tag "Category_Chemicals")
   * this.isChemicalProduct(sodiumSpoonNode)  // false (only equipment tags)
   * this.isChemicalProduct(testStripNode)    // false (has "Category_Lab Equipment")
   * this.isChemicalProduct(untaggedKNO3Node) // true  (title "Potassium Nitrate 125g")
   * ```
   * @source
   */
  private isChemicalProduct(product: ShopifyProductNode): boolean {
    const tags = product.tags ?? [];
    if (tags.some((tag) => EXCLUDED_TAGS.has(tag))) {
      return false;
    }
    if (tags.length === 0) {
      return parseQuantity(product.title) != null;
    }
    return tags.some((tag) => tag.startsWith(CHEMICAL_TAG_PREFIX) || CHEMICAL_TAGS.has(tag));
  }

  /**
   * Attaches a purity grade to the product when one can be read from its tags.
   * @param builder - The product builder to enrich
   * @param product - The raw Shopify product node
   * @returns Nothing; the builder's grade is set when a grade tag is found
   * @example
   * ```typescript
   * this.enrichBuilder(builder, product); // builder.get("grade") === "Reagent Grade"
   * ```
   * @source
   */
  protected override enrichBuilder(
    builder: ProductBuilder<Product>,
    product: ShopifyProductNode,
  ): void {
    builder.setGrade(this.gradeFromTags(product.tags ?? []));
  }

  /**
   * Scans the storefront tags for a purity-grade tag (prefixed `Grade_`/`Grade__`)
   * and maps it to a canonical grade label. Matching is by keyword on the tag's
   * grade portion, so minor spelling variants collapse together: `Grade_Lab`,
   * `Grade_Lab-Grade`, and `Grade__Laboratory-Grade` all yield "Lab Grade";
   * `Grade_Reagent`/`Grade_Reagent-Grade` yield "Reagent Grade"; and
   * `Grade_ACS`/`Grade_ACS-Grade` yield "ACS Grade".
   * @param tags - The product's storefront tags
   * @returns The canonical grade label, or undefined when no grade tag is present
   * @example
   * ```typescript
   * this.gradeFromTags(["Manufacturer_Eisco", "Grade__Laboratory-Grade"]) // "Lab Grade"
   * this.gradeFromTags(["Grade_ACS-Grade"])                               // "ACS Grade"
   * this.gradeFromTags(["Category_Chemicals"])                           // undefined
   * ```
   * @source
   */
  private gradeFromTags(tags: string[]): string | undefined {
    for (const tag of tags) {
      const lowerTag = tag.toLowerCase();
      if (!lowerTag.startsWith("grade")) continue;
      const match = GRADE_TAG_MATCHERS.find(({ keyword }) => lowerTag.includes(keyword));
      if (match) return match.grade;
    }
    return undefined;
  }
}
