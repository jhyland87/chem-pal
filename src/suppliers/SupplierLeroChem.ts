import { CURRENCY_SYMBOL_MAP } from "@/constants/currency";
import { FUZZ_SCORERS, type FuzzScorerFn } from "@/constants/fuzzScorers";
import { findCAS } from "@/helpers/cas";
import { parseQuantity } from "@/helpers/quantity";
import { createDOM } from "@/helpers/request";
import { SchemaOrgData } from "@/helpers/schema-org";
import { findFormulaInHtml, formatFormula, parseLocalizedNumber } from "@/helpers/science";
import { firstMap, htmlToAscii, mapDefined, tryParseJson } from "@/helpers/utils";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { isLeroChemDataProduct, isLeroChemVariantRefresh } from "@/utils/typeGuards/lerochem";
import { SupplierBase } from "./SupplierBase";

/**
 * Supplier implementation for LeroChem, a Lithuania-based chemical supplier
 * running on PrestaShop (lerochem.eu). Like the Warchem supplier it is
 * HTML-based, but the pages embed rich JSON: search results are parsed from the
 * `article.product-miniature` cards, and each product page carries a schema.org
 * `Product` `ld+json` block plus a `#product-details` `data-product` dataset.
 * Per-size prices are fetched from the PrestaShop product `refresh` AJAX
 * endpoint.
 *
 * @typeParam S - The supplier-specific product type (Partial<Product>)
 * @typeParam T - The common Product type that all suppliers map to
 * @example
 * ```typescript
 * const supplier = new SupplierLeroChem("sulfuric acid", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log("Found product:", product.title, product.price);
 * }
 * ```
 * @source
 */
export class SupplierLeroChem extends SupplierBase<Partial<Product>, Product> implements ISupplier {
  // Display name of the supplier used for UI and logging
  public readonly supplierName: string = "LeroChem";

  // Base URL for all API and web requests to LeroChem
  public readonly baseURL: string = "https://lerochem.eu";

  // Shipping scope for LeroChem (ships across the EU, per /en/content/10-delivery-information)
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier (Lithuania).
  // This is used to determine the currency and other country-specific information.
  public readonly country: CountryCode = "LT";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa", "ach", "paypal"];

  // Cached search results from the last query execution
  protected queryResults: Array<Partial<Product>> = [];

  // Maximum number of HTTP requests allowed per search query
  // Used to prevent excessive requests to supplier
  protected httpRequestHardLimit: number = 50;

  // Counter for HTTP requests made during current query execution
  protected httpRequstCount: number = 0;

  // Number of requests to process in parallel when fetching product details
  protected maxConcurrentRequests: number = 5;

  // LeroChem product names append qualifiers (%, grade, pack unit), so the
  // default `ratio` scorer penalizes a short query against the longer full
  // names. token_set_ratio scores ~100 when the query's words are a subset of
  // the title, keeping those fuller-named variants in the results.
  protected readonly fuzzScorer: FuzzScorerFn = FUZZ_SCORERS.token_set_ratio;

  /**
   * Derives the stable unique key for a LeroChem search-result card: the
   * `data-id-product` attribute (the PrestaShop product id, which survives the
   * query→detail transition). When the card carries no id, the same numeric id
   * is recovered from the product URL's last segment, falling back to the full
   * href only if that fails — so the key is always a non-empty string.
   * @param data - The raw LeroChem `article.product-miniature` Element
   * @returns The card's product id, or its product href when no id is present
   * @example
   * ```typescript
   * this.getUniqueProductKey(element); // "208"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: Element): string {
    const productId = data.getAttribute("data-id-product");
    if (productId) {
      return productId;
    }
    const href = data.querySelector(".product-title a")?.getAttribute("href");
    return this.productIdFromUrl(href) ?? this.href(String(href ?? ""));
  }

  /**
   * Extracts the numeric PrestaShop product id from a LeroChem product URL — the
   * leading digits of the last path segment (e.g.
   * ".../pagrindinis/126-abs-acid-labsa-96-l.html" -&gt; "126"). Used as a backup
   * source for the product id when the `data-id-product` attribute is absent.
   * @param url - The product URL (absolute or relative), or null/undefined
   * @returns The numeric product id, or undefined when the URL has no id segment
   * @example
   * ```typescript
   * this.productIdFromUrl("https://lerochem.eu/en/pagrindinis/126-abs-acid.html"); // "126"
   * ```
   * @source
   */
  private productIdFromUrl(url: string | null | undefined): Maybe<string> {
    return url?.match(/\/(\d+)-[^/]*\.html/)?.[1] ?? undefined;
  }

  /**
   * Extracts the product title from a LeroChem search-result card. Used by the
   * base fuzzy filter to score each card against the query.
   * @param data - The `article.product-miniature` Element
   * @returns The product title, or undefined when the card has no title link
   * @example
   * ```typescript
   * this.titleSelector(card); // "SULFURIC ACID (tech grade), 98%, L"
   * ```
   * @source
   */
  protected titleSelector(data: Element): Maybe<string> {
    if (!data) {
      this.logger.error("No data for product", { data });
      return undefined;
    }
    return data.querySelector(".product-title a")?.textContent?.trim() ?? undefined;
  }

  /**
   * Queries LeroChem products for a search term. Fetches the first PrestaShop
   * search-results page, reads how many pages the pagination reports, then
   * fetches further pages only while more fuzzy matches are still needed (never
   * beyond the reported total or the {@link httpRequestHardLimit} request cap). The collected cards
   * are fuzzy-filtered and turned into product builders for the top matches.
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to return
   * @returns Promise resolving to product builders, or void when the search fails
   * @example
   * ```typescript
   * const results = await supplier.queryProducts("acetone", 5);
   * console.log(results?.length); // up to 5
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const firstPage = await this.httpGetHtml({
      path: "/en/search",
      params: { controller: "search", s: query },
    });

    if (!firstPage) {
      this.logger.error("No search response", { query });
      return;
    }

    const cards: Element[] = this.parseSearchCards(firstPage);
    const totalPages = Math.min(this.parseTotalPages(firstPage), this.httpRequestHardLimit);
    this.logger.info("Search pagination", { query, totalPages });

    for (let page = 2; page <= totalPages && this.fuzzyFilterAst(cards).length < limit; page++) {
      const pageResponse = await this.httpGetHtml({
        path: "/en/search",
        params: { controller: "search", s: query, page },
      });
      if (!pageResponse) {
        this.logger.warn("No search response for page", { query, page });
        break;
      }
      cards.push(...this.parseSearchCards(pageResponse));
    }

    if (cards.length === 0) {
      this.logger.log("No products found", { query });
      return;
    }

    const fuzzResults = this.fuzzyFilterAst(cards);
    this.logger.info("fuzzResults:", { query, count: fuzzResults.length });

    return this.initProductBuilders(fuzzResults.slice(0, limit));
  }

  /**
   * Determines how many result pages a LeroChem search returned, from the
   * `nav.pagination` block. Prefers the exact "Showing X-Y of Z item(s)" count
   * (which is not truncated when the page links collapse behind an ellipsis),
   * and falls back to the highest numbered page link. Returns 1 when there is no
   * pagination (a single page of results).
   * @param html - The raw search-results HTML
   * @returns The total number of result pages (at least 1)
   * @example
   * ```typescript
   * this.parseTotalPages(html); // 9  (for "Showing 1-24 of 201 item(s)")
   * ```
   * @source
   */
  protected parseTotalPages(html: string): number {
    const dom = createDOM(html);

    const summary = dom.querySelector("nav.pagination")?.textContent ?? "";
    const match = summary.match(/Showing\s+(\d+)\s*[-–]\s*(\d+)\s+of\s+(\d+)/i);
    if (match) {
      const perPage = Number(match[2]) - Number(match[1]) + 1;
      const total = Number(match[3]);
      if (perPage > 0 && total > 0) {
        return Math.max(1, Math.ceil(total / perPage));
      }
    }

    const pageNumbers = Array.from(
      dom.querySelectorAll('nav.pagination a[aria-label^="Page"]'),
    ).map((anchor) => Number(anchor.getAttribute("aria-label")?.replace(/\D+/g, "")));
    const highest = pageNumbers.filter((n) => Number.isFinite(n) && n > 0);
    return highest.length > 0 ? Math.max(...highest) : 1;
  }

  /**
   * Parses a PrestaShop search-results HTML page into its product cards.
   * @param html - The raw search-results HTML
   * @returns The `article.product-miniature` Elements on the page
   * @example
   * ```typescript
   * const cards = this.parseSearchCards(html);
   * console.log(cards.length); // up to 24
   * ```
   * @source
   */
  protected parseSearchCards(html: string): Element[] {
    const dom = createDOM(html);
    if (!dom) {
      throw new Error("No data found when loading search HTML");
    }
    return Array.from(dom.querySelectorAll("article.product-miniature"));
  }

  /**
   * Initializes product builders from LeroChem search-result cards. Each card
   * yields the product id, title, URL, thumbnail, and the "From" price shown in
   * the listing (the authoritative price is refreshed from the product page in
   * {@link getProductData}).
   * @param elements - The `article.product-miniature` Elements to convert
   * @returns Product builders seeded with the listing data
   * @example
   * ```typescript
   * const builders = this.initProductBuilders(cards);
   * const product = await builders[0].build();
   * console.log(product.title, product.price);
   * ```
   * @source
   */
  protected initProductBuilders(elements: Element[]): ProductBuilder<Product>[] {
    return mapDefined(elements, (element: Element) => {
      const anchor = element.querySelector(".product-title a");
      const title = anchor?.textContent?.trim();
      const url = anchor?.getAttribute("href");

      if (!title || !url) {
        this.logger.error("Card missing title or URL", { element });
        return;
      }

      const builder = new ProductBuilder<Product>(this.baseURL);
      const image =
        element.querySelector(".product-image img")?.getAttribute("data-full-size-image-url") ??
        element.querySelector(".product-image img")?.getAttribute("src");
      const currency = this.cardCurrency(element);

      builder
        .setBasicInfo(title, url, this.supplierName)
        .setID(element.getAttribute("data-id-product") ?? this.productIdFromUrl(url))
        .setCacheKey(this.getUniqueProductKey(element))
        .setImage(image)
        .setPrice(this.cardPrice(element))
        .setCurrencyCode(currency)
        .setCurrencySymbol(CURRENCY_SYMBOL_MAP[currency]);

      return builder;
    });
  }

  /**
   * Reads the numeric "From" price from a search-result card. PrestaShop renders
   * the price as `<span content="EUR"></span><span content="5">5.00 €</span>`;
   * the numeric `content` value is used to avoid parsing the currency-suffixed
   * display text.
   * @param element - The `article.product-miniature` Element
   * @returns The numeric price string (e.g. "5"), or undefined when absent
   * @example
   * ```typescript
   * this.cardPrice(card); // "5"
   * ```
   * @source
   */
  private cardPrice(element: Element): Maybe<string> {
    const contents = Array.from(
      element.querySelectorAll(".product-price-and-shipping .price span[content]"),
    );
    return (
      contents
        .map((span) => span.getAttribute("content"))
        .find((content) => content != null && /^\d+(\.\d+)?$/.test(content)) ?? undefined
    );
  }

  /**
   * Reads the currency code from a search-result card, defaulting to EUR (the
   * shop's only currency) when the microdata span is absent.
   * @param element - The `article.product-miniature` Element
   * @returns The ISO currency code, e.g. "EUR"
   * @example
   * ```typescript
   * this.cardCurrency(card); // "EUR"
   * ```
   * @source
   */
  private cardCurrency(element: Element): string {
    const span = element.querySelector('.product-price-and-shipping .price span[content="EUR"]');
    return span?.getAttribute("content") ?? "EUR";
  }

  /**
   * Fetches and parses a LeroChem product page into a complete product. Pulls
   * data from the schema.org `Product` `ld+json`, the `#product-details`
   * `data-product` dataset, the `#description` spec table, and the per-size
   * `refresh` AJAX endpoint.
   * @param product - The product builder seeded from the search listing
   * @returns Promise resolving to the enriched builder, or void on failure
   * @example
   * ```typescript
   * const full = await supplier.getProductData(builder);
   * console.log(full?.dump().cas, full?.dump().quantity);
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      if (typeof builder === "undefined") {
        this.logger.error("No products to get data for", { builder });
        return;
      }

      const productResponse = await this.httpGetHtml({ path: builder.get("url") });
      if (!productResponse) {
        this.logger.warn("No product response", { builder });
        return;
      }

      const dom = createDOM(productResponse);

      // schema.org Product ld+json: sku, image, price, currency, availability.
      const schema = SchemaOrgData.fromDocument(dom);
      const product = schema.first("Product");
      const offer = schema.all("Offer")[0];
      if (product) {
        builder.setSku(product.sku);
        // The ld+json sku/mpn equal the numeric product id — a backup for the id set from the card.
        builder.setID(product.sku);
        builder.setImage(Array.isArray(product.image) ? product.image[0] : product.image);
      }
      if (offer) {
        if (offer.price != null) {
          builder.setPrice(offer.price);
        }
        const currencyCode = typeof offer.priceCurrency === "string" ? offer.priceCurrency : "EUR";
        builder.setCurrencyCode(currencyCode);
        builder.setCurrencySymbol(CURRENCY_SYMBOL_MAP[currencyCode]);
        // SchemaOrgData already strips the schema.org enum prefix (".../PreOrder" -> "PreOrder").
        if (typeof offer.availability === "string") {
          builder.setAvailability(offer.availability);
        }
      }

      // #product-details data-product: authoritative price, default size, description.
      const dataProduct = this.parseDataProduct(dom);
      if (dataProduct) {
        // data-product `id`/`id_product` is another backup for the numeric product id.
        builder.setID(dataProduct.id_product ?? dataProduct.id);
        if (typeof dataProduct.price_amount === "number") {
          builder.setPrice(dataProduct.price_amount);
        }
        builder.setDescription(
          this.descriptionToText(dataProduct.description) ?? dataProduct.meta_description,
        );
        builder.setShortDescription(
          dataProduct.meta_description ??
            this.shortDescriptionToText(dataProduct.description_short),
        );
        const defaultQty = this.defaultSizeQuantity(dataProduct);
        if (defaultQty) {
          builder.setQuantity(defaultQty);
        }
        // CAS most reliably lives in the meta description ("… CAS <number> …").
        builder.setCAS(
          firstMap(
            (text) => findCAS(text),
            [dataProduct.meta_description, dataProduct.name, dataProduct.description].filter(
              (value): value is string => typeof value === "string",
            ),
          ),
        );
      }

      // The product name carries the purity ("… 98%, L" -> "98%"); findPurity
      // (via setPurity) ignores the pack unit and pulls the percentage.
      builder.setPurity(builder.get("title"));
      builder.setGrade(this.gradeFromName(builder.get("title")));

      // The #description spec table carries the most reliable CAS, formula, and molar mass.
      this.applyDataTable(builder, dom);

      // The short-description block links the COA and the SDS (labelled "Declaration").
      this.applyDocumentLinks(builder, dom);

      const variants = await this.parseVariants(builder, dom);
      if (variants.length > 0) {
        builder.setVariants(variants);
      }

      return builder;
    });
  }

  /**
   * Extracts a chemical grade from a LeroChem product name. Many names tag a
   * grade in the title (e.g. "(tech grade)", "food grade", "E300 food grade"),
   * which `findPurity`'s generic grade fallback does not recognise, so a curated
   * set of grade words is matched here.
   * @param name - The product name/title (or any value)
   * @returns The normalised grade phrase (e.g. "tech grade"), or undefined
   * @example
   * ```typescript
   * this.gradeFromName("SULFURIC ACID (tech grade), 98%, L"); // "tech grade"
   * ```
   * @source
   */
  private gradeFromName(name: unknown): Maybe<string> {
    if (typeof name !== "string") {
      return undefined;
    }
    const match = name.match(
      /\b(tech(?:nical)?|food|feed|reagent|analytical|industrial|cosmetic|pharmaceutical|laboratory|lab)\s+grade\b/i,
    );
    return match ? match[0].toLowerCase() : undefined;
  }

  /**
   * Reads and parses the `#product-details` `data-product` dataset from a
   * product page or a `refresh` response fragment.
   * @param dom - The parsed Document containing a `#product-details` element
   * @returns The data-product object, or undefined when absent/invalid
   * @example
   * ```typescript
   * this.parseDataProduct(dom)?.price_amount; // 5.2
   * ```
   * @source
   */
  private parseDataProduct(dom: Document): Maybe<LeroChemDataProduct> {
    const raw = dom.querySelector("#product-details")?.getAttribute("data-product");
    const parsed = tryParseJson(raw);
    return isLeroChemDataProduct(parsed) ? parsed : undefined;
  }

  /**
   * Parses the default (selected) combination's size into a quantity object,
   * e.g. the "1 L" attribute becomes `{ quantity: 1, uom: "l" }`.
   * @param dataProduct - The parsed `data-product` dataset
   * @returns The parsed quantity, or undefined when no size attribute is present
   * @example
   * ```typescript
   * this.defaultSizeQuantity(dataProduct); // { quantity: 1, uom: "l" }
   * ```
   * @source
   */
  private defaultSizeQuantity(dataProduct: LeroChemDataProduct): Maybe<QuantityObject> {
    const label = Object.values(dataProduct.attributes ?? {})[0]?.name;
    return label ? (parseQuantity(label) ?? undefined) : undefined;
  }

  /**
   * Converts the `data-product` `description` HTML into plain text: strips every
   * `<table>` (LeroChem embeds a spec table that duplicates the detail fields, and
   * a hazard table) and runs the remainder through {@link htmlToAscii}.
   * @param html - The raw description HTML (or any value)
   * @returns The plain-text description, or undefined when empty/absent
   * @example
   * ```typescript
   * this.descriptionToText("<table>…</table><p>Some acid.</p>"); // "Some acid."
   * ```
   * @source
   */
  private descriptionToText(html: Maybe<string>): Maybe<string> {
    if (typeof html !== "string" || html.length === 0) {
      return undefined;
    }
    const dom = createDOM(html);
    for (const table of Array.from(dom.querySelectorAll("table"))) {
      table.remove();
    }
    const text = htmlToAscii(dom.body?.innerHTML ?? html);
    return text.length > 0 ? text : undefined;
  }

  /**
   * Converts the `data-product` `description_short` HTML into plain text: removes
   * the COA/Declaration document links (they are surfaced separately as
   * `coaUrl`/`sdsUrl`) and runs the remainder through {@link htmlToAscii}.
   * @param html - The raw short-description HTML (or any value)
   * @returns The plain-text short description, or undefined when empty/absent
   * @example
   * ```typescript
   * this.shortDescriptionToText(
   *   '<p><a href="/COA.pdf">CERTIFICATE OF ANALYSIS</a></p><p>ABS acid.</p>',
   * ); // "ABS acid."
   * ```
   * @source
   */
  private shortDescriptionToText(html: Maybe<string>): Maybe<string> {
    if (typeof html !== "string" || html.length === 0) {
      return undefined;
    }
    const dom = createDOM(html);
    for (const anchor of Array.from(dom.querySelectorAll("a[href]"))) {
      const text = anchor.textContent ?? "";
      const href = anchor.getAttribute("href") ?? "";
      if (
        /certificate of analysis|declaration/i.test(text) ||
        /\/COA[\s%/]|declaration/i.test(href)
      ) {
        (anchor.closest("p") ?? anchor).remove();
      }
    }
    const text = htmlToAscii(dom.body?.innerHTML ?? html);
    return text.length > 0 ? text : undefined;
  }

  /**
   * Extracts the datasheet links from the `#product-description-short` block:
   * the Certificate of Analysis (COA) and the SDS (which LeroChem labels
   * "Declaration"). Links are matched by anchor text or href, so the id suffix
   * (`product-description-short-<id>`) does not need to be known.
   * @param builder - The product builder to enrich
   * @param dom - The parsed product page Document
   * @returns Nothing; mutates the builder in place
   * @example
   * ```typescript
   * this.applyDocumentLinks(builder, dom);
   * // builder.dump().coaUrl -> ".../COA Sulfuric acid.pdf"
   * // builder.dump().sdsUrl -> ".../DECLARATION Sulfuric acid 98.pdf"
   * ```
   * @source
   */
  private applyDocumentLinks(builder: ProductBuilder<Product>, dom: Document): void {
    const anchors = Array.from(dom.querySelectorAll('[id^="product-description-short"] a[href]'));

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href");
      if (!href) {
        continue;
      }
      const text = anchor.textContent?.trim() ?? "";
      if (/certificate of analysis/i.test(text) || /\/COA[\s%/]/i.test(href)) {
        builder.setCoaUrl(href);
      } else if (/declaration/i.test(text) || /declaration/i.test(href)) {
        builder.setSDSUrl(href);
      }
    }
  }

  /**
   * Reads the `#description` spec table — a two-column label/value grid — and
   * applies the structured fields it carries: the CAS number (more reliable than
   * scraping the description), the molecular formula, and the molar mass. Labels
   * are English: "CAS", "Formula", and "Molar mass" (e.g. "326,49", using a
   * decimal comma).
   * @param builder - The product builder to enrich
   * @param dom - The parsed product page Document
   * @returns Nothing; mutates the builder in place
   * @example
   * ```typescript
   * this.applyDataTable(builder, dom);
   * // builder.dump().cas -> "27176-87-0", builder.dump().moleweight -> 326.49
   * ```
   * @source
   */
  private applyDataTable(builder: ProductBuilder<Product>, dom: Document): void {
    const rows = Array.from(dom.querySelectorAll("#description table tbody tr"));

    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      const label = cells[0]?.textContent?.replace(/\s+/g, " ").replace(/:\s*$/, "").trim();
      const value = cells[1]?.textContent?.replace(/\s+/g, " ").trim();
      if (!label || !value) {
        continue;
      }

      if (/^CAS$/i.test(label)) {
        const cas = findCAS(value);
        if (cas) {
          builder.setCAS(cas);
        }
      } else if (/^Formula$/i.test(label)) {
        // The cell tags atom counts as <sub>, which render across lines; collapse
        // that inter-tag whitespace so findFormulaInHtml matches the whole formula
        // and converts the tags to Unicode subscripts. Fall back to subscripting
        // the flattened text if no tagged formula is found.
        const cellHtml = cells[1]?.innerHTML?.replace(/\s+/g, "");
        const formula =
          (cellHtml ? findFormulaInHtml(cellHtml) : undefined) ??
          formatFormula(value.replace(/\s+/g, ""));
        builder.setData({ formula });
      } else if (/^IUPAC$/i.test(label)) {
        builder.setIupacName(value);
      } else if (/^Molar mass$/i.test(label)) {
        // e.g. "98,079 g/mol" or "326,49" — strip the unit; parseLocalizedNumber
        // resolves the European decimal comma.
        builder.setMoleweight(parseLocalizedNumber(value.replace(/[^\d.,]/g, "")));
      }
    }
  }

  /**
   * Builds the size/price variants for a LeroChem product. The default size is
   * priced from the product page; every other size is priced with a PrestaShop
   * `refresh` AJAX call (`controller=product&action=refresh`). Currency is left
   * unset so each variant inherits the parent product's currency at build time.
   * When the page lacks a session token or product id, only the default size is
   * returned.
   * @param builder - The product builder (source of the default price)
   * @param dom - The parsed product page Document
   * @returns The parsed variants in the page's (ascending-size) order
   * @example
   * ```typescript
   * const variants = await this.parseVariants(builder, dom);
   * // [{ id: "934", title: "1 L", quantity: 1, uom: "l", price: 5 }, ...]
   * ```
   * @source
   */
  private async parseVariants(
    builder: ProductBuilder<Product>,
    dom: Document,
  ): Promise<Partial<Variant>[]> {
    const radios = Array.from(dom.querySelectorAll(".product-variants input.input-radio"));
    if (radios.length === 0) {
      return [];
    }

    const token = dom
      .querySelector('#add-to-cart-or-refresh input[name="token"]')
      ?.getAttribute("value");
    const idProduct =
      dom.querySelector("#product_page_product_id")?.getAttribute("value") ??
      dom.querySelector('#add-to-cart-or-refresh input[name="id_product"]')?.getAttribute("value");

    const defaultPrice = builder.get("price");

    const variants = await Promise.all(
      radios.map(async (radio) => {
        const groupId = radio.getAttribute("name")?.match(/group\[(\d+)\]/)?.[1];
        const valueId = radio.getAttribute("value");
        const label = radio.parentElement?.querySelector(".radio-label")?.textContent?.trim();
        if (!groupId || !valueId) {
          return undefined;
        }

        const qty = label ? parseQuantity(label) : undefined;
        const base: Partial<Variant> = {
          id: valueId,
          title: label ?? undefined,
          quantity: qty?.quantity,
          uom: qty?.uom,
        };

        // The checked radio is the default size, already priced from the page.
        if (radio.hasAttribute("checked")) {
          return { ...base, price: typeof defaultPrice === "number" ? defaultPrice : undefined };
        }

        if (!token || !idProduct) {
          return base;
        }

        const price = await this.fetchVariantPrice(idProduct, token, groupId, valueId);
        return { ...base, price };
      }),
    );

    return variants.filter((variant): variant is Partial<Variant> => variant !== undefined);
  }

  /**
   * Prices a single non-default size via the PrestaShop product `refresh` AJAX
   * endpoint, reading the combination's `price_amount` from the returned
   * `product_details` fragment.
   * @param idProduct - The PrestaShop product id
   * @param token - The per-session product form token
   * @param groupId - The attribute group id (e.g. "5" for Size/capacity)
   * @param valueId - The attribute value id for the size to price
   * @returns The variant price, or undefined when the refresh fails
   * @example
   * ```typescript
   * await this.fetchVariantPrice("208", "abc123", "5", "27"); // 22
   * ```
   * @source
   */
  private async fetchVariantPrice(
    idProduct: string,
    token: string,
    groupId: string,
    valueId: string,
  ): Promise<Maybe<number>> {
    const response = await this.httpPostJson({
      path: "/en/index.php",
      params: {
        controller: "product",
        token,
        id_product: idProduct,
        id_customization: "0",
        group: { [groupId]: valueId },
        qty: "1",
      },
      body: "ajax=1&action=refresh&quantity_wanted=1",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!isLeroChemVariantRefresh(response)) {
      this.logger.warn("Invalid variant refresh response", { idProduct, groupId, valueId });
      return undefined;
    }

    const dataProduct = this.parseDataProduct(createDOM(response.product_details ?? ""));
    return typeof dataProduct?.price_amount === "number" ? dataProduct.price_amount : undefined;
  }
}
