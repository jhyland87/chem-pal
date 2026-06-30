import { findCAS } from "@/helpers/cas";
import { parseQuantity } from "@/helpers/quantity";
import { createDOM } from "@/helpers/request";
import { parsePurity } from "@/helpers/science";
import { mapDefined } from "@/helpers/utils";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { translateAstToFreefind } from "@/utils/search-query/translators/translateAstToFreefind";
import { isCurrencyCode } from "@/utils/typeGuards/common";
import { extract } from "fuzzball";
import { SupplierBase } from "./SupplierBase";

/**
 * Supplier implementation for LiMac Science, a chemical supplier based in
 * Ķekava, Latvia that ships worldwide.
 * LiMac delegates product search to FreeFind (a 3rd-party site search engine),
 * so the supplier issues its query against `search.freefind.com` and then
 * fetches each product page on `www.limac.lv` to extract pricing, variants,
 * and CAS information from the embedded `mozCatItem*` JavaScript objects.
 *
 * LiMac also supports a "refined search" feature which allows for searching
 * for more than one phrase at a time, while using logic.
 * eg:  `(sulfuric acid) OR (boric acid)`
 *      `(sulfuric) OR (boric) acid`
 *      `(sodium borohydride) AND (95%)`
 *
 *
 *
 * @see https://search.freefind.com/searchtipspop.html
 *
 * @typeParam S - The supplier-specific product type (Partial<Product>)
 * @typeParam T - The common Product type that all suppliers map to
 * @example
 * ```typescript
 * const supplier = new SupplierLiMac("sulfamic acid", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log("Found product:", product.title, product.price);
 * }
 * ```
 * @source
 */
export class SupplierLiMac extends SupplierBase<Partial<Product>, Product> implements ISupplier {
  // Display name of the supplier used for UI and logging
  public readonly supplierName: string = "LiMac";

  // Base URL for product detail pages on LiMac's storefront
  public readonly baseURL: string = "https://www.limac.lv";

  // FreeFind hostname used for the product search step. Declaring it as
  // `apiURL` automatically extends `requiredHosts` so the extension
  // requests the necessary host permission.
  public readonly apiURL: string = "search.freefind.com";

  // Shipping scope for LiMac
  public readonly shipping: ShippingRange = "worldwide";

  // The country code of the supplier.
  public readonly country: CountryCode = "LV";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "other", "ach"];

  // Cached search results from the last query execution
  protected queryResults: Array<Partial<Product>> = [];

  // Maximum number of HTTP requests allowed per search query
  protected httpRequestHardLimit: number = 50;

  // Counter for HTTP requests made during current query execution
  protected httpRequstCount: number = 0;

  // Number of requests to process in parallel when fetching product details
  protected maxConcurrentRequests: number = 5;

  // The site ID for the FreeFind search engine.
  protected readonly siteId: number = 52187908;

  // FreeFind natively supports refined (boolean) search, so advanced queries are
  // handed off as FreeFind syntax instead of using the keyword-only fallback.
  protected readonly supportsNativeAdvancedSearch: boolean = true;

  /**
   * No setup is required for LiMac; the FreeFind search endpoint is stateless
   * and the product pages don't depend on any session cookies.
   * @returns A promise that resolves immediately.
   * @source
   */
  protected async setup(): Promise<void> {}

  /**
   * Queries LiMac products by issuing a GET request against the FreeFind
   * search engine that LiMac is integrated with. Each result links back to
   * a product page on `www.limac.lv` which is followed up later in
   * {@link getProductData}.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to an array of ProductBuilders or void if search fails
   * @example
   * ```typescript
   * const supplier = new SupplierLiMac("acid", 10, new AbortController());
   * const results = await supplier.queryProducts("acid");
   * if (results) {
   *   console.log(`Found ${results.length} products`);
   * }
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    this.logger.log("queryProducts:", { query, limit });

    // For an advanced query, hand FreeFind its own refined-search syntax.
    const parsed = this.getAst();
    const searchTerm = parsed.isAdvanced ? translateAstToFreefind(parsed.ast) : query;

    const searchResponse = await this.httpGetHtml({
      host: this.apiURL,
      path: "/find.html",
      params: {
        si: this.siteId,
        pid: "r",
        n: "0",
        _charset_: "UTF-8",
        bcd: "÷",
        query: encodeURIComponent(searchTerm).replaceAll("%20", "+"),
      },
    });

    if (!searchResponse) {
      this.logger.error("No search response", { query, limit });
      return;
    }

    this.logger.debug("searchResponse:", { searchResponse });

    // Hand the result anchors to initProductBuilders (rather than building the
    // ProductBuilders inline) so each one gets its title, supplier, and ID set
    // via setBasicInfo — the same flow every other supplier follows.
    const productElements = this.getSearchResultElements(searchResponse);
    this.logger.debug("productElements:", { count: productElements.length });

    return this.initProductBuilders(productElements).slice(0, limit);
  }

  /**
   * Parses a FreeFind search results page into the result anchor elements, in
   * FreeFind's ranking order. Returns an empty array when the page reports no
   * results or the result-count header can't be parsed.
   *
   * @param response - The HTML response from FreeFind
   * @returns The result anchor Elements (consumed by {@link initProductBuilders})
   * @example
   * ```typescript
   * const html = await this.httpGetHtml({ host: this.apiURL, path: "/find.html" });
   * const elements = this.getSearchResultElements(html ?? "");
   * const builders = this.initProductBuilders(elements);
   * ```
   * @source
   */
  private getSearchResultElements(response: string): Element[] {
    const parsedHTML = createDOM(response);
    const noResultsCheck = parsedHTML.querySelector(
      ".search-header-table .search-count > .search-no-results",
    );
    if (noResultsCheck) {
      this.logger.log("No products found", { response, noResultsCheck });
      return [];
    }

    const resultCount = parsedHTML.querySelector(
      ".search-header-table td.search-count > font.search-count",
    )?.textContent;
    if (!resultCount) {
      this.logger.log("No products found", { response, resultCount });
      return [];
    }

    const resultCountMatch = resultCount.match(
      /Found (?<result_count>[0-9]+) items, now showing (?<from>[0-9]+) - (?<to>[0-9]+)/m,
    );
    if (!resultCountMatch) {
      this.logger.log("No products found", { response, resultCountMatch });
      return [];
    }

    const totalResults = Number(resultCountMatch.groups?.result_count ?? "0");
    const startResult = Number(resultCountMatch.groups?.from ?? "0");
    const endResult = Number(resultCountMatch.groups?.to ?? "0");

    this.logger.log("Found results", { response, totalResults, startResult, endResult });

    return Array.from(parsedHTML.querySelectorAll("font.search-results > a"));
  }

  /**
   * Parses a FreeFind search results page and returns the result anchors
   * in the order FreeFind ranked them. FreeFind only exposes a category
   * breadcrumb as link text (e.g. "Acids - Acids - Catalog - LiMac Science"),
   * which is too coarse to fuzzy-match against a specific compound name like
   * "sulfamic" — partial_ratio against breadcrumbs would drop all results
   * for any non-category query. Since FreeFind already filters and ranks
   * relevance server-side, the supplier preserves that ordering and lets
   * {@link queryProducts} slice to the requested limit.
   *
   * @param query - The search term (used only for diagnostic logging)
   * @param response - The HTML response from FreeFind
   * @returns Array of anchor Elements in FreeFind's ranking order
   * @example
   * ```typescript
   * const html = await this.httpGetHtml({ host: this.apiURL, path: "/find.html" });
   * const matches = this.fuzzHtmlResponse("acid", html ?? "");
   * for (const a of matches) {
   *   console.log(a.getAttribute("href"));
   * }
   * ```
   * @source
   */
  protected fuzzHtmlResponse(
    query: string,
    response: string,
    minMatchPercentage: number = this.minMatchPercentage,
  ): Element[] {
    const parsedHTML = createDOM(response);
    const noResultsCheck = parsedHTML.querySelector(
      ".search-header-table .search-count > .search-no-results",
    );
    if (noResultsCheck) {
      this.logger.log("No products found", { query });
      return [];
    }

    const resultCount = parsedHTML.querySelector(
      ".search-header-table td.search-count > font.search-count",
    )?.textContent;
    if (!resultCount) {
      this.logger.log("No products found", { query });
      return [];
    }

    const resultCountMatch = resultCount.match(
      /Found (?<result_count>[0-9]+) items, now showing (?<from>[0-9]+) - (?<to>[0-9]+)/m,
    );
    if (!resultCountMatch) {
      this.logger.log("No products found", { query });
      return [];
    }

    const totalResults = Number(resultCountMatch.groups?.result_count ?? "0");
    const startResult = Number(resultCountMatch.groups?.from ?? "0");
    const endResult = Number(resultCountMatch.groups?.to ?? "0");

    this.logger.log("Found results", { query, totalResults, startResult, endResult });

    const links = parsedHTML.querySelectorAll("font.search-results > a");

    const activeScorer = this.fuzzScorerOverride ?? this.fuzzScorer;

    const fuzzResults = extract(query, links, {
      scorer: activeScorer,
      processor: this.titleSelector,
      cutoff: minMatchPercentage,
      sortBySimilarity: true,
    }).reduce<FuzzyMatchResult<Element>[]>((acc, [obj, score, idx]) => {
      if (!obj.id || typeof idx !== "number") {
        this.logger.error("No ID for product", { element: obj });
        return acc;
      }

      if (score < minMatchPercentage) {
        this.logger.debug("fuzzyFilter: score below minimum match percentage, excluding product", {
          product: obj,
          score,
          idx,
          minMatchPercentage: minMatchPercentage,
        });
        return acc;
      }

      acc[idx] = Object.assign(obj, { _fuzz: { score, idx }, matchPercentage: score });
      return acc;
    }, []);

    this.logger.debug("fuzzHtmlResponse results:", {
      supplierName: this.supplierName,
      query,
      minMatchPercentage,
      activeScorer,
      fuzzResults,
    });

    // Get rid of any empty items that didn't match closely enough
    return fuzzResults.filter((item) => !!item);
  }

  /**
   * Initialize ProductBuilders from the FreeFind result anchors. FreeFind
   * doesn't return prices, so only the URL, supplier, ID, and a placeholder
   * title (the breadcrumb) are set here. Price, CAS, quantity, and variants
   * are populated later in {@link getProductData} from the product page.
   *
   * @param elements - Anchor Elements pointing to LiMac product pages
   * @returns Array of ProductBuilders with basic info populated
   * @example
   * ```typescript
   * const elements = this.fuzzHtmlResponse("acid", html);
   * const builders = this.initProductBuilders(elements);
   * ```
   * @source
   */
  protected initProductBuilders(elements: Element[]): ProductBuilder<Product>[] {
    return mapDefined(elements, (element: Element) => {
      const href = element.getAttribute("href");
      if (!href) {
        this.logger.error("No URL for product", { element });
        return;
      }

      const url = new URL(href, this.baseURL);
      // LiMac product URL shape: /catalog/params/category/{cat}/item/{id}/
      const id = url.pathname.match(/\/item\/(\d+)\//)?.[1];
      if (!id) {
        this.logger.error("No ID for product", { element, url: String(url) });
        return;
      }

      const title = element.textContent?.trim() || "";

      return new ProductBuilder<Product>(this.baseURL)
        .setBasicInfo(title, String(url), this.supplierName)
        .setSupplierCountry(this.country)
        .setID(id);
    });
  }

  /**
   * Fetches a LiMac product page and enriches the builder from several
   * sources on the page:
   * - the embedded `mozCatItemMozApi` JS object (name, CAS in its `sku`
   *   field, currency, price, and the full variants list — the first variant
   *   becomes the canonical product, the rest are appended via `addVariant`),
   * - the `og:image` meta tag (and `mozCatItemPictures` for the thumbnail),
   * - the product title (purity, e.g. "min 95%"),
   * - the `#basic` properties table (molecular formula, molecular weight, and
   *   a CAS fallback).
   *
   * @param product - Partial product to enrich with detail-page data
   * @returns Promise resolving to the enriched ProductBuilder or void
   * @example
   * ```typescript
   * const builder = await supplier.getProductData(partialBuilder);
   * if (builder) {
   *   const product = await builder.build();
   *   console.log(product.title, product.cas, product.formula, product.purity);
   * }
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    const result = await this.getProductDataWithCache(product, async (builder) => {
      if (typeof builder === "undefined") {
        this.logger.error("No products to get data for");
        return;
      }

      const productResponse = await this.httpGetHtml({
        // `get` returns a union over all Product fields; `url` is set in
        // initProductBuilders and is always a string here.
        path: builder.get("url") as string,
      });

      if (!productResponse) {
        this.logger.warn("No product response", { builder });
        return;
      }

      const mozApi = this.parseJsObject<MozCatItemMozApi>(productResponse, "mozCatItemMozApi");
      if (!mozApi) {
        this.logger.warn("No mozCatItemMozApi found", { url: builder.get("url") });
        return;
      }

      const dom = createDOM(productResponse);

      builder
        .setData({ title: mozApi.name })
        .setSupplierCountry(this.country)
        .setCAS(findCAS(mozApi.sku ?? ""));

      const variants = Array.isArray(mozApi.variants) ? mozApi.variants : [];
      const main = variants[0];

      // `currency` comes from page-parsed runtime data; validate before typing it.
      const currencyCode = isCurrencyCode(mozApi.currency) ? mozApi.currency : undefined;

      if (main) {
        const mainQty = parseQuantity(main.options?.[0]?.title ?? "");
        if (mainQty) builder.setQuantity(mainQty);
        builder.setPricing(main.price, mozApi.currency, "€");
      }

      for (const variant of variants.slice(1)) {
        const optionTitle = variant.options?.[0]?.title ?? "";
        const variantQty = parseQuantity(optionTitle);
        builder.addVariant({
          id: variant.id,
          title: optionTitle || undefined,
          price: variant.price,
          currencyCode,
          currencySymbol: "€",
          quantity: variantQty?.quantity,
          uom: variantQty?.uom,
          sku: variant.sku || undefined,
        });
      }

      // Purity is baked into the product name, e.g. "Sodium borohydride, min 95%".
      builder.setPurity(parsePurity(mozApi.name));

      this.applyProductImage(builder, dom, productResponse, mozApi.name);
      this.applyBasicProperties(builder, dom);

      return builder;
    });

    // Secondary fuzz filter. The FreeFind search ranks by coarse category
    // breadcrumbs, so loosely-relevant products slip through. Now that the
    // product page has given us the real product name, fuzz-match it against
    // the query and drop anything below the cutoff. This runs outside the
    // cache wrapper (which keys on URL, not query) so the filter applies to
    // the current query for both freshly fetched and cached products.
    if (!result) return;

    const name = result.get("title");
    if (typeof name === "string") {
      const score = this.fuzzyScoreAst(name);
      if (score === null) {
        this.logger.debug("Dropping product below fuzz threshold", {
          name,
          query: this.query,
          cutoff: this.minMatchPercentage,
        });
        return;
      }
      result.setMatchPercentage(score);
    }

    return result;
  }

  /**
   * Sets the product image and thumbnail. Prefers the `og:image` meta tag (a
   * clean absolute URL) for the main image, and the first `mozCatItemPictures`
   * entry's CDN thumbnail for the thumbnail. When `og:image` is absent, falls
   * back to the full-size `mozCatItemPictures` image.
   *
   * @param builder - The ProductBuilder to apply the image data to
   * @param dom - The parsed product page Document
   * @param html - The raw product page HTML (for the embedded picture JS object)
   * @param altText - Alt text for the image (the product name)
   * @returns Nothing; mutates the builder in place
   * @example
   * ```typescript
   * this.applyProductImage(builder, dom, html, "Sodium borohydride, min 95%");
   * // builder.get("imageURL") -> "https://www.limac.lv/files/.../NaBH4-....png"
   * ```
   * @source
   */
  private applyProductImage(
    builder: ProductBuilder<Product>,
    dom: Document,
    html: string,
    altText: string,
  ): void {
    const ogImage = this.getMetaTags(dom)["og:image"];
    const pictures = this.parseJsObject<MozCatItemPictures>(html, "mozCatItemPictures");
    const picture = pictures?.item?.[0];

    if (ogImage) {
      builder.setImage(ogImage, altText);
    } else if (picture && pictures) {
      builder.setImage(`${pictures.cdn}${picture.size_set.m}`, altText);
    }

    builder.setThumbnail(picture?.thumb);
  }

  /**
   * Reads the `#basic` properties table on a LiMac product page and applies
   * the molecular formula, molecular weight, and CAS number (as a fallback
   * when the `mozCatItemMozApi` SKU didn't yield one) to the builder.
   *
   * @param builder - The ProductBuilder to apply the properties to
   * @param dom - The parsed product page Document
   * @returns Nothing; mutates the builder in place
   * @example
   * ```typescript
   * this.applyBasicProperties(builder, dom);
   * // builder.get("formula") -> "NaBH4", builder.get("moleweight") -> 37.83
   * ```
   * @source
   */
  private applyBasicProperties(builder: ProductBuilder<Product>, dom: Document): void {
    const props = this.parseDetailTable(dom, "#basic");

    builder.setFormula(props["Molecular Formula"]);
    builder.setMoleweight(props["Molecular Weight"]?.match(/[\d.]+/)?.[0]);

    // CAS is normally taken from mozCatItemMozApi.sku; only fall back to the
    // table when that didn't produce one.
    if (!builder.get("cas")) {
      builder.setCAS(findCAS(props["CAS No."] ?? ""));
    }
  }

  /**
   * Reduces all `<meta>` tags on the page into a record keyed by each tag's
   * `property` attribute (e.g. `og:image`, `og:title`). LiMac emits Open
   * Graph tags using `property=` rather than `name=`.
   *
   * @param dom - The parsed product page Document
   * @returns A record of meta `property` → `content`
   * @example
   * ```typescript
   * const meta = this.getMetaTags(dom);
   * console.log(meta["og:image"]); // "https://www.limac.lv/files/.../NaBH4-....png"
   * ```
   * @source
   */
  private getMetaTags(dom: Document): Record<string, string> {
    return Array.from(dom.getElementsByTagName("meta")).reduce<Record<string, string>>(
      (acc, meta) => {
        const property = meta.getAttribute("property");
        if (typeof property === "string") {
          acc[property] = meta.getAttribute("content") ?? "";
        }
        return acc;
      },
      {},
    );
  }

  /**
   * Parses a two-column properties table (label `<th>` → value `<td>`) into a
   * record. LiMac product pages render `#basic` and `#properties` tables in
   * this shape.
   *
   * @param dom - The parsed product page Document
   * @param selector - CSS selector for the table's container element
   * @returns A record of trimmed row label → trimmed row value
   * @example
   * ```typescript
   * const props = this.parseDetailTable(dom, "#basic");
   * console.log(props["Molecular Weight"]); // "37.83"
   * ```
   * @source
   */
  private parseDetailTable(dom: Document, selector: string): Record<string, string> {
    const container = dom.querySelector(selector);
    if (!container) return {};

    return Array.from(container.querySelectorAll("tr")).reduce<Record<string, string>>(
      (acc, row) => {
        const label = row.querySelector("th")?.textContent?.trim().replace(/\s+/g, " ");
        const value = row.querySelector("td")?.textContent?.trim().replace(/\s+/g, " ");
        if (label && value) acc[label] = value;
        return acc;
      },
      {},
    );
  }

  /**
   * Extracts the title from a FreeFind result anchor (the link text — a
   * category breadcrumb). Required by the abstract base class for diagnostic
   * tooling like the dev-mode fuzz scorer comparison table; this supplier
   * does not call `fuzzyFilter` itself (see {@link fuzzHtmlResponse}).
   *
   * @param data - The DOM Element (anchor) containing the result
   * @returns The link text trimmed, or undefined if missing
   * @example
   * ```typescript
   * const anchor = document.querySelector("font.search-results > a");
   * if (anchor) console.log(this.titleSelector(anchor));
   * ```
   * @source
   */
  protected titleSelector(data: Element): Maybe<string> {
    const title = data.textContent?.trim();
    if (!title) {
      this.logger.error("No title for product", { data });
      return undefined;
    }
    return title;
  }

  /**
   * Locates `var {name} = { … };` inside a LiMac product page and parses it
   * into an object. The page emits JS literals (unquoted keys, trailing
   * commas) rather than valid JSON, so the literal is normalised via regex
   * (quote keys, strip trailing commas) before `JSON.parse`. This avoids
   * `eval`/`new Function` so the supplier remains compatible with extension
   * CSP. Used for both `mozCatItemMozApi` and `mozCatItemPictures`.
   *
   * @typeParam R - The expected shape of the parsed object
   * @param html - The full product page HTML
   * @param name - The JS variable name to locate (e.g., "mozCatItemMozApi")
   * @returns The parsed object, or undefined if missing/malformed
   * @example
   * ```typescript
   * const html = await this.httpGetHtml({ path: "/catalog/.../item/373337/" });
   * const api = this.parseJsObject<MozCatItemMozApi>(html ?? "", "mozCatItemMozApi");
   * console.log(api?.name, api?.sku, api?.variants?.length);
   * ```
   * @source
   */
  private parseJsObject<R>(html: string, name: string): R | undefined {
    const literal = this.extractJsObjectLiteral(html, name);
    if (!literal) return undefined;

    try {
      const normalised = literal
        .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*|\d+)\s*:/g, '$1"$2":')
        .replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(normalised);
    } catch (error) {
      this.logger.error(`Failed to parse ${name} literal`, { error, literal });
      return undefined;
    }
  }

  /**
   * Walks the HTML to extract the JS object literal assigned to a named
   * `var`. Handles strings (so braces inside quoted values aren't counted)
   * and string escape sequences. Returns the substring from the opening `{`
   * to the matching `}`, inclusive.
   *
   * @param html - The full HTML document
   * @param name - The JS variable name to locate (e.g., "mozCatItemMozApi")
   * @returns The object literal as a string, or undefined if not found
   * @example
   * ```typescript
   * const literal = this.extractJsObjectLiteral(html, "mozCatItemMozApi");
   * // "{ id: \"373337\", name: \"…\", variants: [ … ] }"
   * ```
   * @source
   */
  private extractJsObjectLiteral(html: string, name: string): string | undefined {
    const marker = `var ${name}`;
    const markerIdx = html.indexOf(marker);
    if (markerIdx === -1) return undefined;

    const openIdx = html.indexOf("{", markerIdx);
    if (openIdx === -1) return undefined;

    let depth = 0;
    let inString = false;
    let stringChar = "";

    for (let i = openIdx; i < html.length; i++) {
      const ch = html[i];

      if (inString) {
        if (ch === "\\") {
          i++;
          continue;
        }
        if (ch === stringChar) inString = false;
        continue;
      }

      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        continue;
      }

      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return html.slice(openIdx, i + 1);
      }
    }

    return undefined;
  }
}

/**
 * Shape of the `mozCatItemMozApi` JS object embedded in LiMac product pages.
 * Only the fields actually consumed by {@link SupplierLiMac.getProductData}
 * are typed; the page may include additional properties.
 */
interface MozCatItemMozApi {
  id: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  price: number;
  price_undiscounted: number;
  currency: string;
  weight: number | null;
  stock: number | null;
  variants: MozCatItemMozApiVariant[];
}

interface MozCatItemMozApiVariant {
  id: string;
  options: { title: string }[];
  price: number;
  price_undiscounted: number;
  sku: string;
  stock: number | null;
  weight: number | null;
}

/**
 * Shape of the `mozCatItemPictures` JS object embedded in LiMac product pages.
 * Only the fields consumed by {@link SupplierLiMac.getProductData} are typed.
 * `thumb` is an absolute CDN URL; `size_set` paths are relative to `cdn`.
 */
interface MozCatItemPictures {
  cdn: string;
  item: {
    thumb: string;
    size_set: { st: string; m: string };
  }[];
}
