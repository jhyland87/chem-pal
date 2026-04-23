import { findCAS } from "@/helpers/cas";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { createDOM } from "@/helpers/request";
import { firstMap, mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import { isCAS } from "@/utils/typeGuards/common";
import { WRatio } from "fuzzball";
import SupplierBase from "./SupplierBase";
/**
 * Supplier implementation for S3 Chemicals, a German based chemical supplier
 * (shop.es-drei.de) built on the Shopware 5 platform.
 *
 * Price currency is not hardcoded — the storefront serves either EUR or USD
 * depending on session detection, so the currency is always read from the
 * `meta[itemprop="priceCurrency"]` tag on the detail page (with the visible
 * symbol inferred from the rendered price text).
 *
 * @typeParam S - The supplier-specific product type (Partial<Product>)
 * @typeParam T - The common Product type that all suppliers map to
 *
 * @example
 * ```typescript
 * const supplier = new SupplierS3Chemicals("eosin", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log("Found product:", product.title, product.price);
 * }
 * ```
 * @source
 */
export default class SupplierS3Chemicals
  extends SupplierBase<Partial<Product>, Product>
  implements ISupplier
{
  // Display name of the supplier used for UI and logging
  public readonly supplierName: string = "S3 Chemicals";

  // Base URL for all web requests to S3 Chemicals
  public readonly baseURL: string = "https://shop.es-drei.de";

  // Shipping scope for S3 Chemicals (DE-based, ships across borders)
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  // This is used to determine the currency and other country-specific information.
  public readonly country: CountryCode = "DE";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa", "banktransfer"];

  // German-language titles rarely overlap the English query tokens, so we
  // use WRatio (a best-of-several-scorers heuristic) with a low cutoff to
  // keep cross-language matches from being discarded.
  protected readonly fuzzScorer = WRatio;
  protected readonly minMatchPercentage: number = 25;

  // Cached search results from the last query execution
  protected queryResults: Array<Partial<Product>> = [];

  // Maximum number of HTTP requests allowed per search query.
  // Raised above the usual 50 because each product fans out to one
  // request per variant (typically 3–6) on top of the base detail fetch.
  protected httpRequestHardLimit: number = 150;

  // Counter for HTTP requests made during current query execution
  protected httpRequstCount: number = 0;

  // Number of requests to process in parallel when fetching product details
  protected maxConcurrentRequests: number = 5;

  /**
   * Writes Shopware's `currency=2` cookie into the browser cookie jar before
   * any request runs so the storefront returns USD prices. The `Cookie`
   * request header is on the fetch-forbidden list and cannot be set via
   * `this.headers`; `chrome.cookies.set` is the only reliable path.
   * @returns A promise that resolves when the cookie has been written.
   * @source
   */
  protected async setup(): Promise<void> {
    // `chrome.cookies` is undefined unless the extension has the "cookies"
    // permission *and* the host_permission for this origin. Guard so the
    // query still runs in environments that lack the API (e.g. dev fallback
    // or when a user hasn't accepted the upgraded permission set yet) —
    // prices will just render in the session default currency.
    if (typeof chrome === "undefined" || !chrome.cookies?.set) {
      this.logger.warn("chrome.cookies unavailable; skipping currency cookie set");
      return;
    }
    try {
      await chrome.cookies.set({
        url: this.baseURL,
        name: "currency",
        value: "2",
      });
    } catch (error) {
      this.logger.warn("Failed to set currency cookie; prices may render in session default", {
        error,
      });
    }
  }

  /**
   * Normalizes a Shopware-rendered price string (German locale) into a
   * format that `parsePrice` can consume unambiguously.
   * Shopware serves numbers as `2.449,00 $` (period = thousands,
   * comma = decimal) regardless of the selected currency, so the `$` symbol
   * and the German digit formatting disagree. Strip the footnote `*`, the
   * non-breaking space, the thousands `.`, and swap the decimal `,` to `.`.
   *
   * @param text - Raw price text from the DOM (e.g. `"2.449,00\u00A0$ *"`)
   * @returns Normalized string safe for `parsePrice` (e.g. `"2449.00 $"`)
   * @example
   * ```typescript
   * this.normalizePriceText("12,25\u00A0$ *"); // "12.25 $"
   * this.normalizePriceText("2.449,00\u00A0$"); // "2449.00 $"
   * ```
   * @source
   */
  protected normalizePriceText(text: string): string {
    return text
      .replace(/\u00A0/g, " ")
      .replace(/\*/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();
  }

  /**
   * Queries S3 Chemicals products based on a search string.
   * Makes a GET request to the Shopware `/search` endpoint asking for the
   * largest allowed page size (n=48) and parses the HTML response to extract
   * basic product information from each `.product--box` card.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to an array of ProductBuilder instances or void if search fails
   * @example
   * ```typescript
   * const supplier = new SupplierS3Chemicals("eosin", 10, new AbortController());
   * const results = await supplier.queryProducts("eosin");
   * if (results) {
   *   console.log(`Found ${results.length} products`);
   *   console.log("First product:", results[0].get("title"));
   * }
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const searchRequest = await this.httpGetHtml({
      path: "/search",
      params: {
        sSearch: encodeURIComponent(query),
        p: 1,
        // Shopware's per-page size is restricted to one of {12, 24, 36, 48}.
        n: 48,
      },
    });

    if (!searchRequest) {
      this.logger.error("No search response", { query });
      return;
    }

    this.logger.log("Received search response", { query, searchRequest });

    const fuzzResults = this.fuzzHtmlResponse(query, searchRequest);

    this.logger.info("fuzzResults:", { query, searchRequest, fuzzResults });

    const builders = this.initProductBuilders(fuzzResults.slice(0, limit));
    this.logger.info("builders:", { query, searchRequest, fuzzResults, builders });
    return builders;
  }

  /**
   * Parses HTML response and performs fuzzy filtering on product elements.
   * Creates a DOM from the HTML response, selects `div.product--box.box--basic`
   * cards from the search listing, and applies fuzzy filtering against the
   * card titles returned by {@link titleSelector}.
   *
   * @param query - The search term to filter products by
   * @param response - The HTML response string containing product listings
   * @returns Array of DOM Elements that match the fuzzy search criteria
   * @example
   * ```typescript
   * const html = await this.httpGetHtml({ path: "/search", params: { sSearch: "eosin" } });
   * if (html) {
   *   const matches = this.fuzzHtmlResponse("eosin", html);
   *   console.log(`Found ${matches.length} matching product cards`);
   * }
   * ```
   * @source
   */
  protected fuzzHtmlResponse(query: string, response: string): Element[] {
    const parsedHTML = createDOM(response);
    if (!parsedHTML || parsedHTML === null) {
      throw new Error("No data found when loading HTML");
    }

    const productContainers = parsedHTML.querySelectorAll("div.product--box.box--basic");
    if (!productContainers || productContainers.length === 0) {
      this.logger.log("No products found", { query, response, parsedHTML, productContainers });
      return [];
    }

    return this.fuzzyFilter<Element>(query, Array.from(productContainers));
  }

  /**
   * Initialize product builders from S3 Chemicals HTML search response cards.
   * Transforms each `div.product--box` card into a ProductBuilder instance with
   * title, URL, ordernumber (as ID), listing price, description, and quantity.
   * Cards that are missing a title or URL are skipped silently via `mapDefined`.
   *
   * @param elements - Array of DOM Elements containing product cards
   * @returns Array of ProductBuilder instances initialized with card data
   * @example
   * ```typescript
   * const fuzz = this.fuzzHtmlResponse("eosin", html);
   * const builders = this.initProductBuilders(fuzz);
   * // Each builder contains parsed product data from the listing card
   * for (const builder of builders) {
   *   console.log(builder.get("title"), builder.get("price"));
   * }
   * ```
   * @source
   */
  protected initProductBuilders(elements: Element[]): ProductBuilder<Product>[] {
    this.logger.info("initProductBuilders elements:", { elements });
    return mapDefined(elements, (element: Element) => {
      const builder = new ProductBuilder<Product>(this.baseURL);

      const anchor = element.querySelector("a.product--title");
      const href = anchor?.getAttribute("href");
      const title = anchor?.getAttribute("title")?.trim() || anchor?.textContent?.trim();

      if (!anchor || !href || !title) {
        this.logger.error("No title/href for product", { element });
        return;
      }

      // Search results already return absolute URLs; `new URL` with a base is
      // defensive and a no-op when `href` is absolute.
      const url = new URL(href, this.baseURL);

      // Shopware exposes the ordernumber on the wrapper (e.g. "S100210").
      // A small number of grouped-variant parents may omit it; we fall back
      // to the numeric productID meta in `getProductData` when that happens.
      const ordernumber = element.getAttribute("data-ordernumber") ?? undefined;

      // Shopware renders prices in German locale (`2.449,00 $`) even when
      // the currency is USD — normalize to dot-decimal before `parsePrice`,
      // otherwise price-parser mis-reads the comma-decimal form (e.g.
      // `"12,25 $"` comes out as $0.12).
      const priceText = this.normalizePriceText(
        element.querySelector("div.product--price span.price--default")?.textContent ?? "",
      );
      const price = parsePrice(priceText);
      if (price !== undefined) {
        builder.setPricing(price.price, price.currencyCode, price.currencySymbol);
      }

      const description = element
        .querySelector("div.product--description")
        ?.textContent?.trim()
        .replace(/\s+/g, " ");
      if (description) {
        builder.setDescription(description);
      }

      const qtyText = element
        .querySelector("div.price--unit span.is--nowrap")
        ?.textContent?.trim();
      if (qtyText) {
        const qty = parseQuantity(qtyText);
        if (qty) {
          builder.setQuantity(qty);
        }
      }

      builder.setBasicInfo(title, url.toString(), this.supplierName);
      if (ordernumber) {
        builder.setID(ordernumber);
      }
      return builder;
    });
  }

  /**
   * Reduces a variant's quantity + uom to a single scalar so an array of
   * variants can be sorted ascending by chemical content regardless of
   * unit. Mass units collapse to milligrams and volume units collapse to
   * millilitres — the two families aren't comparable to each other, but
   * S3 variants of one product always share a family, so a single ranking
   * is enough. Unknown/missing units sort last.
   *
   * @param v - Variant to rank
   * @returns Canonical magnitude (mg or mL) or +Infinity if unknown
   * @example
   * ```typescript
   * this.variantSortRank({ quantity: 25, uom: "g" });  // 25000
   * this.variantSortRank({ quantity: 1, uom: "kg" });  // 1000000
   * this.variantSortRank({ quantity: 500, uom: "ml" }); // 500
   * ```
   * @source
   */
  protected variantSortRank(v: Partial<Variant>): number {
    if (v.quantity === undefined) return Number.POSITIVE_INFINITY;
    const uom = v.uom?.toLowerCase() ?? "";
    const multipliers: Record<string, number> = {
      mg: 1,
      g: 1000,
      kg: 1_000_000,
      t: 1_000_000_000,
      ml: 1,
      cl: 10,
      dl: 100,
      l: 1000,
    };
    const multiplier = multipliers[uom];
    if (multiplier === undefined) return Number.POSITIVE_INFINITY;
    return v.quantity * multiplier;
  }

  /**
   * Extracts the variant-selector state from a parsed detail block.
   * Shopware renders variants as a `<select data-ajax-select-variants="true">`
   * where the `name` attribute (e.g. `group[12]`) becomes the GET key that
   * switches the displayed variant. Returns `undefined` when the page has
   * no variant select (single-variant products).
   *
   * @param details - The `.product--details` DOM block from the detail page
   * @returns The variant group data, or `undefined` if no select is present
   * @example
   * ```typescript
   * const dom = createDOM(await this.httpGetHtml(...));
   * const group = this.parseVariantGroup(dom.querySelector("div.product--details")!);
   * // group = { selectName: "group[12]", options: [{ value: "438", label: "50g", selected: true }, ...] }
   * ```
   * @source
   */
  protected parseVariantGroup(details: Element | Document): Maybe<{
    selectName: string;
    options: Array<{ value: string; label: string; selected: boolean }>;
  }> {
    const select = details.querySelector('select[data-ajax-select-variants="true"]');
    const selectName = select?.getAttribute("name");
    if (!select || !selectName) {
      return undefined;
    }
    const options = Array.from(select.querySelectorAll("option")).flatMap((opt) => {
      const value = opt.getAttribute("value");
      if (!value) return [];
      return [
        {
          value,
          label: opt.textContent?.trim() ?? "",
          selected: opt.hasAttribute("selected"),
        },
      ];
    });
    if (options.length === 0) return undefined;
    return { selectName, options };
  }

  /**
   * Builds a variant-specific URL by appending Shopware's variant group
   * GET parameter onto the product's base URL. Used both as the `url`
   * value stored on each `Variant` and as an ergonomic breadcrumb.
   *
   * @param baseUrl - The product's canonical URL (no query string)
   * @param selectName - The `name` attribute of the variant select (e.g. `group[12]`)
   * @param value - The chosen option's `value` attribute (e.g. `438`)
   * @returns The variant URL with the group parameter appended
   * @example
   * ```typescript
   * this.buildVariantUrl(
   *   "https://shop.es-drei.de/farbstoffe-indikatoren/12285/allurarot-ac",
   *   "group[12]",
   *   "438",
   * );
   * // "https://shop.es-drei.de/farbstoffe-indikatoren/12285/allurarot-ac?group%5B12%5D=438"
   * ```
   * @source
   */
  protected buildVariantUrl(baseUrl: string, selectName: string, value: string): string {
    const url = new URL(baseUrl);
    url.searchParams.set(selectName, value);
    return url.toString();
  }

  /**
   * Extracts a single variant's data from a parsed detail block.
   * Reads the schema.org meta tags on the page (price, currency, weight,
   * productID, SKU) plus the visible price text (for the currency symbol)
   * and returns a `Partial<Variant>` suitable for `addVariant`/`setVariants`.
   * `parseVariantGroup` already covers option labels; the `label` arg is
   * stored as the variant's `title` so users can tell sizes apart.
   *
   * @param details - The `.product--details` DOM block for this variant
   * @param url - Variant-specific URL (from {@link buildVariantUrl})
   * @param label - Option label from the select (e.g. `"50g"`)
   * @returns Partial variant data extracted from the DOM
   * @example
   * ```typescript
   * const variant = this.extractVariantData(details, variantUrl, "50g");
   * // { title: "50g", price: 12.25, currencyCode: "USD", currencySymbol: "$",
   * //   quantity: 50, uom: "g", id: "89624", sku: "S1002100.1", url: "..." }
   * ```
   * @source
   */
  protected extractVariantData(
    details: Element | Document,
    url: string,
    label?: string,
  ): Partial<Variant> {
    const variant: Partial<Variant> = { url };
    if (label) {
      variant.title = label;
    }

    const priceContent = details.querySelector('meta[itemprop="price"]')?.getAttribute("content");
    if (priceContent) {
      const normalized = Number(this.normalizePriceText(priceContent));
      if (!Number.isNaN(normalized)) {
        variant.price = normalized;
      }
    }

    const currencyCode = details
      .querySelector('meta[itemprop="priceCurrency"]')
      ?.getAttribute("content");
    if (currencyCode) {
      variant.currencyCode = currencyCode as CurrencyCode;
    }

    const visiblePrice = details.querySelector("span.price--content")?.textContent;
    if (visiblePrice) {
      const parsed = parsePrice(this.normalizePriceText(visiblePrice));
      if (parsed?.currencySymbol) {
        variant.currencySymbol = parsed.currencySymbol;
      }
    }

    // The option label ("25g", "100g", …) is the chemical content size.
    // We deliberately ignore `meta[itemprop="weight"]` because Shopware
    // reports the *shipping* weight there (bottle + packaging), which made
    // every variant collapse to ~1 kg in practice. Fall back to the
    // "Inhalt:" line inside `div.price--unit` for single-variant products
    // that have no option label.
    const qtyFromLabel = label ? parseQuantity(label) : undefined;
    if (qtyFromLabel) {
      variant.quantity = qtyFromLabel.quantity;
      variant.uom = qtyFromLabel.uom;
    } else {
      const unitText = details
        .querySelector("div.price--unit")
        ?.textContent?.replace(/\s+/g, " ")
        .trim();
      if (unitText) {
        const cleaned = unitText.replace(/inhalt\s*:/i, "").split("(")[0].trim();
        const qtyFromUnit = parseQuantity(cleaned);
        if (qtyFromUnit) {
          variant.quantity = qtyFromUnit.quantity;
          variant.uom = qtyFromUnit.uom;
        }
      }
    }

    const productID = details
      .querySelector('meta[itemprop="productID"]')
      ?.getAttribute("content");
    if (productID) {
      variant.id = productID;
    }

    const sku = details.querySelector('span[itemprop="sku"]')?.textContent?.trim();
    if (sku) {
      variant.sku = sku;
    }

    return variant;
  }

  /**
   * Transforms a partial product item into a complete Product object.
   * Fetches the product detail page with `template=ajax`, then iterates
   * every option in the Shopware variant select (appending the
   * `group[N]=value` GET parameter for each) to collect every size the
   * product is sold in. Common fields (description, CAS, availability)
   * come from the initial fetch; the top-level builder price/quantity/ID
   * reflects the smallest variant (lowest quantity, ties broken by price).
   *
   * @param product - ProductBuilder to enrich with detail-page data
   * @returns Promise resolving to the enriched ProductBuilder or void if the fetch fails
   * @example
   * ```typescript
   * const builder = new ProductBuilder<Product>("https://shop.es-drei.de");
   * builder.setBasicInfo("Allurarot AC", "https://shop.es-drei.de/farbstoffe-indikatoren/12285/allurarot-ac", "S3 Chemicals");
   * const enriched = await supplier.getProductData(builder);
   * // enriched.get("price") === 2.99   // smallest (5g) variant
   * // enriched.get("variants")?.length === 5
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      this.logger.debug("Querying data for partialproduct", { builder });
      if (typeof builder === "undefined") {
        this.logger.error("No products to get data for", { builder });
        return;
      }

      const baseUrl = builder.get("url");

      // `template=ajax` returns the same `.product--details` block without
      // the surrounding layout — roughly a 95% payload reduction per request.
      const initialResponse = await this.httpGetHtml({
        path: baseUrl,
        params: { template: "ajax" },
      });

      if (!initialResponse) {
        this.logger.warn("No product response", { builder });
        return;
      }

      const initialDom = createDOM(initialResponse);
      const initialDetails = initialDom.querySelector("div.product--details") ?? initialDom;

      // --- Common (product-wide) data from the initial fetch -------------
      const detailDescription = initialDetails
        .querySelector('div.product--description[itemprop="description"]')
        ?.textContent?.trim()
        .replace(/\s+/g, " ");
      if (detailDescription) {
        builder.setDescription(detailDescription);
      }

      const availabilityHref = initialDetails
        .querySelector('link[itemprop="availability"]')
        ?.getAttribute("href");
      if (availabilityHref) {
        const token = availabilityHref.split("/").pop();
        if (token) {
          builder.setAvailability(token);
        }
      }

      const titleText =
        initialDetails.querySelector('h1.product--title[itemprop="name"]')?.textContent?.trim() ??
        "";
      const cas = firstMap(
        (p) => findCAS(p),
        [titleText, detailDescription ?? "", builder.get("description") ?? ""],
      );
      if (isCAS(cas)) {
        builder.setCAS(cas);
      }

      // --- Variant enumeration -------------------------------------------
      const group = this.parseVariantGroup(initialDetails);
      const selectedOption = group?.options.find((o) => o.selected) ?? group?.options[0];
      const initialVariantUrl =
        group && selectedOption
          ? this.buildVariantUrl(baseUrl, group.selectName, selectedOption.value)
          : baseUrl;
      const variants: Partial<Variant>[] = [
        this.extractVariantData(initialDetails, initialVariantUrl, selectedOption?.label),
      ];

      if (group && group.options.length > 1) {
        const others = group.options.filter((o) => o.value !== selectedOption?.value);
        const fetched = await Promise.all(
          others.map(async (opt) => {
            const html = await this.httpGetHtml({
              path: baseUrl,
              params: { template: "ajax", [group.selectName]: opt.value },
            });
            if (!html) return undefined;
            const dom = createDOM(html);
            const details = dom.querySelector("div.product--details") ?? dom;
            return this.extractVariantData(
              details,
              this.buildVariantUrl(baseUrl, group.selectName, opt.value),
              opt.label,
            );
          }),
        );
        for (const v of fetched) {
          if (v) variants.push(v);
        }
      }

      // --- Sort variants ascending by chemical quantity ------------------
      // `parseQuantity` returns normalized units (1000g → 1kg, 500mg → 0.5g),
      // so a raw numeric sort would put "1 kg" before "25 g". Convert each
      // variant's quantity to a canonical magnitude (milligrams for mass,
      // millilitres for volume) before comparing. Missing values sort last.
      variants.sort((a, b) => {
        const ra = this.variantSortRank(a);
        const rb = this.variantSortRank(b);
        if (ra !== rb) return ra - rb;
        const pa = a.price ?? Number.POSITIVE_INFINITY;
        const pb = b.price ?? Number.POSITIVE_INFINITY;
        return pa - pb;
      });

      // --- Promote the smallest variant to parent-level fields -----------
      const primary = variants[0];
      if (primary) {
        if (primary.price !== undefined) builder.setPrice(primary.price);
        if (primary.currencyCode) builder.setCurrencyCode(primary.currencyCode);
        if (primary.currencySymbol) builder.setCurrencySymbol(primary.currencySymbol);
        if (primary.quantity !== undefined && primary.uom) {
          builder.setQuantity(primary.quantity, primary.uom);
        }
        if (primary.sku !== undefined) builder.setSku(String(primary.sku));
        // Only overwrite the parent ID if the listing card didn't give us
        // the short ordernumber (which is the cleaner identifier).
        if (!builder.get("id") && primary.id !== undefined) {
          builder.setID(primary.id);
        }
      }

      if (variants.length > 1) {
        builder.setVariants(variants);
      }

      this.logger.debug("product", builder);
      return builder;
    });
  }

  /**
   * Extracts the product title from a search card DOM Element.
   * Prefers the `title` attribute on `a.product--title` (guaranteed clean)
   * and falls back to the anchor's `textContent` when missing.
   *
   * @param data - The DOM Element containing the product card
   * @returns The product title, or undefined if the anchor/title is missing
   * @example
   * ```typescript
   * const card = document.querySelector("div.product--box.box--basic");
   * if (card) {
   *   const title = this.titleSelector(card);
   *   console.log("Product title:", title);
   *   // Output: "Allurarot AC"
   * }
   * ```
   * @source
   */
  protected titleSelector(data: Element): Maybe<string> {
    if (!data) {
      this.logger.error("No data for product", { data });
      return undefined;
    }
    const anchor = data.querySelector("a.product--title");
    const title = anchor?.getAttribute("title")?.trim() || anchor?.textContent?.trim();
    if (!title) {
      this.logger.error("No title for product", { data });
      return undefined;
    }
    return title;
  }
}
