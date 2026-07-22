import { findCAS } from '@/helpers/cas';
import { getPubchemIdFromDocument } from '@/helpers/pubchem';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { SupplierBaseShopify } from './SupplierBaseShopify';

/**
 * SupplierAsesChem class that extends SupplierBaseShopify.
 *
 * @remarks
 * AsesChem sells cosmetic and personal-care chemical ingredients. Search results come from the
 * Shopify GraphQL Storefront API, but the extra product details (SDS/COA documents, description,
 * molecular formula, PubChem ID and reviews) are only rendered on the product page HTML, so
 * {@link SupplierAsesChem.getProductData} fetches and scrapes that page per product.
 *
 * @category Suppliers
 * @source
 */
export class SupplierAsesChem extends SupplierBaseShopify implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = 'AsesChem';

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = 'https://ases.in';

  // Shipping scope
  public readonly shipping: ShippingRange = 'domestic';

  // The country code of the supplier.
  public readonly country: CountryCode = 'IN';

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  // Shopify API URL for GraphQL queries
  protected apiURL: string = 'aseschem.myshopify.com';

  /**
   * Enriches a search-result product with details only present on its product page. Fetches the
   * product page HTML and scrapes the SDS/COA document links, description, molecular formula,
   * PubChem ID and review summary, applying each to the builder via its validating setters (any
   * missing field is skipped silently).
   *
   * @param product - The product builder created from the Shopify search response
   * @returns Promise resolving to the enriched builder, or void if the page could not be fetched
   * @example
   * ```typescript
   * const partial = (await this.queryProducts("triethanolamine", 1))?.[0];
   * const full = partial ? await this.getProductData(partial) : undefined;
   * // full?.get("formula") === "C₆H₁₅NO₃"
   * // full?.get("sdsUrl")  === "https://ases.in/cdn/shop/files/Triethanolamine_-_SDS.pdf?..."
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      if (typeof builder === 'undefined') {
        this.logger.error('No product to get data for');
        return;
      }

      const productResponse = await this.httpGetHtml({ path: builder.get('url') });
      if (!productResponse) {
        this.logger.warn('No product page response', { builder });
        return builder;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(productResponse, 'text/html');

      this.applyDocuments(builder, doc);
      this.applyDescriptionDetails(builder, doc);
      this.applyImages(builder, doc);
      this.applyReviews(builder, doc);

      return builder;
    });
  }

  /**
   * Scrapes the SDS/COA document links (pdf/doc only) from the product page and applies them to the
   * builder. Matches links by their visible text: text containing "coa" sets the COA URL, text
   * containing "sds" (including "MSDS") sets the SDS URL.
   *
   * @param builder - The product builder to populate
   * @param doc - The parsed product page document
   * @returns void
   * @example
   * ```typescript
   * this.applyDocuments(builder, doc);
   * // builder.get("sdsUrl") -> "https://ases.in/cdn/shop/files/Triethanolamine_-_SDS.pdf?..."
   * ```
   * @source
   */
  private applyDocuments(builder: ProductBuilder<Product>, doc: Document): void {
    const links = doc.querySelectorAll<HTMLAnchorElement>(
      'div[class^="product-detail"] a[href*="pdf"], div[class^="product-detail"] a[href*="doc"]',
    );
    for (const link of links) {
      const text = (link.textContent ?? '').toLowerCase();
      const href = link.getAttribute('href');
      if (text.includes('coa')) {
        builder.setCoaUrl(href);
      } else if (text.includes('sds')) {
        builder.setSDSUrl(href);
      }
    }
  }

  /**
   * Scrapes the product description block and applies the description, molecular formula, PubChem
   * CID, CAS number and molecular weight to the builder. Labelled layouts expose the description and
   * formula in their own `<strong>`-tagged paragraphs; the CAS and molecular weight are pulled from
   * the block's full text, which also covers the plain-text layout (e.g. "CAS No. 27028-82-6
   * Formula: C18H41NO7S M.W. 415.6").
   *
   * @param builder - The product builder to populate
   * @param doc - The parsed product page document
   * @returns void
   * @example
   * ```typescript
   * this.applyDescriptionDetails(builder, doc);
   * // builder.get("formula") -> "C₆H₁₅NO₃", builder.get("cas") -> "27028-82-6"
   * ```
   * @source
   */
  private applyDescriptionDetails(builder: ProductBuilder<Product>, doc: Document): void {
    const container = doc.querySelector('div.product-description');
    if (!container) return;

    const paragraphs = Array.from(container.querySelectorAll(':scope > p'));

    const labelMatches = (paragraph: Element, label: string): boolean =>
      (paragraph.querySelector('strong')?.textContent ?? '').toLowerCase().includes(label);

    const descriptionParagraph = paragraphs.find((p) => labelMatches(p, 'description'));
    if (descriptionParagraph) {
      const label = descriptionParagraph.querySelector('strong')?.textContent ?? '';
      const full = descriptionParagraph.textContent ?? '';
      const description = (full.startsWith(label) ? full.slice(label.length) : full)
        .replace(/^[\s\-–—:]+/, '')
        .trim();
      builder.setDescription(description);
    }

    const formulaParagraph = paragraphs.find((p) => labelMatches(p, 'molecular formula'));
    if (formulaParagraph) {
      // The formula text carries <sub> markup (e.g. C<sub>6</sub>H<sub>15</sub>NO<sub>3</sub>),
      // which setFormula parses into unicode subscripts, so pass innerHTML rather than textContent.
      const formulaSource =
        formulaParagraph.querySelector('a') ?? formulaParagraph.querySelector('span');
      builder.setFormula(formulaSource?.innerHTML);

      const pubchemHref = formulaParagraph.querySelector('a')?.getAttribute('href');
      if (pubchemHref) {
        const cid = pubchemHref?.match(/\/compound\/(\d+)/i)?.[1];
        builder.setPubchemId(cid);
      } else {
        const pubchemLinkSearch = getPubchemIdFromDocument(doc);
        if (pubchemLinkSearch) {
          builder.setPubchemId(pubchemLinkSearch);
        }
      }
    }

    // CAS and molecular weight appear inline in the block text (setCAS validates the checksum).
    const text = container.textContent ?? '';
    builder.setCAS(findCAS(text));
    builder.setMoleweight(text.match(/M\.?\s*W\.?\s*[:-]?\s*([\d.]+)/i)?.[1]);
  }

  /**
   * Scrapes the main product image from the product page and applies both the full-size image and a
   * downsized thumbnail to the builder. Both are derived from the same
   * `a.main-img-link img.rimage__image` source (sized at 1024px and 150px respectively).
   *
   * @param builder - The product builder to populate
   * @param doc - The parsed product page document
   * @returns void
   * @example
   * ```typescript
   * this.applyImages(builder, doc);
   * // builder.get("images") -> [{ url: "https://ases.in/cdn/shop/products/Triethanolamine_1024x.jpg?...", thumbnail: "https://ases.in/cdn/shop/products/Triethanolamine_150x.jpg?..." }]
   * ```
   * @source
   */
  private applyImages(builder: ProductBuilder<Product>, doc: Document): void {
    const mainImage = doc.querySelector<HTMLImageElement>('a.main-img-link img.rimage__image');
    if (!mainImage) return;
    builder.setImage(this.resolveImageSrc(mainImage, 1024), mainImage.getAttribute('alt'));
    builder.setThumbnail(this.resolveImageSrc(mainImage, 150));
  }

  /**
   * Resolves a usable image URL from a lazy-loaded `<img>` at the given width. Prefers `src`,
   * falling back to `data-lazy-src` / `data-src`, and replaces the `{width}` size token Shopify's
   * responsive markup leaves in the lazy source with the requested width.
   *
   * @param img - The image element to read the source from
   * @param width - The pixel width to substitute for the `{width}` token
   * @returns The resolved image URL, or undefined if no source attribute is present
   * @example
   * ```typescript
   * // <img data-lazy-src="//cdn/shop/x_{width}x.jpg">
   * this.resolveImageSrc(img, 150); // "//cdn/shop/x_150x.jpg"
   * ```
   * @source
   */
  private resolveImageSrc(img: HTMLImageElement, width: number): string | undefined {
    const raw =
      img.getAttribute('src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-src');
    return raw?.replace('{width}', String(width)) ?? undefined;
  }

  /**
   * Scrapes the review summary (average rating and review count) from the Judge.me review widget
   * and applies it to the builder.
   *
   * @param builder - The product builder to populate
   * @param doc - The parsed product page document
   * @returns void
   * @example
   * ```typescript
   * this.applyReviews(builder, doc);
   * // builder.get("rating") -> 4.57, builder.get("reviewCount") -> 14
   * ```
   * @source
   */
  private applyReviews(builder: ProductBuilder<Product>, doc: Document): void {
    const widget = doc.querySelector('.jdgm-rev-widg');
    if (!widget) return;
    builder.setRating(widget.getAttribute('data-average-rating'));
    builder.setReviewCount(widget.getAttribute('data-number-of-reviews'));
  }
}
