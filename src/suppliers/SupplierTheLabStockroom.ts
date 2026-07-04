import { ProductBuilder } from "@/utils/ProductBuilder";
import { SupplierBaseShopify } from "./SupplierBaseShopify";

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
        // eslint-disable-next-line @typescript-eslint/naming-convention
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
}
