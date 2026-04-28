import { findCAS } from "@/helpers/cas";
import { parseQuantity } from "@/helpers/quantity";
import { mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import SupplierBase from "./SupplierBase";
/**
 * Supplier implementation for LiMac Science, a Latvian chemical supplier.
 * LiMac delegates product search to FreeFind (a 3rd-party site search engine),
 * so the supplier issues its query against `search.freefind.com` and then
 * fetches each product page on `www.limac.lv` to extract pricing, variants,
 * and CAS information from the embedded `mozCatItem*` JavaScript objects.
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
export default class SupplierLiMac
  extends SupplierBase<Partial<Product>, Product>
  implements ISupplier
{
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
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "other", "banktransfer"];

  // Cached search results from the last query execution
  protected queryResults: Array<Partial<Product>> = [];

  // Maximum number of HTTP requests allowed per search query
  protected httpRequestHardLimit: number = 50;

  // Counter for HTTP requests made during current query execution
  protected httpRequstCount: number = 0;

  // Number of requests to process in parallel when fetching product details
  protected maxConcurrentRequests: number = 5;

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

    const searchResponse = await this.httpGetHtml({
      host: this.apiURL,
      path: "/find.html",
      params: {
        si: "52187908",
        pid: "r",
        n: "0",
        // eslint-disable-next-line @typescript-eslint/naming-convention
        _charset_: "UTF-8",
        bcd: "÷",
        query: encodeURIComponent(query),
      },
    });

    if (!searchResponse) {
      this.logger.error("No search response", { query, limit });
      return;
    }

    this.logger.debug("searchResponse:", { searchResponse });

    const fuzzResults = this.fuzzHtmlResponse(query, searchResponse);
    this.logger.debug("fuzzResults:", { fuzzResults });

    return this.initProductBuilders(fuzzResults.slice(0, limit));
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
  protected fuzzHtmlResponse(query: string, response: string): Element[] {
    const parser = new DOMParser();
    const parsedHTML = parser.parseFromString(response, "text/html");
    const links = parsedHTML.querySelectorAll("font.search-results > a");

    if (links.length === 0) {
      this.logger.log("No products found", { query });
      return [];
    }

    return Array.from(links);
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
        this.logger.error("No ID for product", { element, url: url.toString() });
        return;
      }

      const title = element.textContent?.trim() || "";

      return new ProductBuilder<Product>(this.baseURL)
        .setBasicInfo(title, url.toString(), this.supplierName)
        .setID(id);
    });
  }

  /**
   * Fetches a LiMac product page and extracts the embedded
   * `mozCatItemMozApi` JavaScript object, which holds the product name, CAS
   * number (in its `sku` field), currency, and the full variants list. The
   * first variant is used as the canonical product; the rest are appended
   * via `addVariant`.
   *
   * @param product - Partial product to enrich with detail-page data
   * @returns Promise resolving to the enriched ProductBuilder or void
   * @example
   * ```typescript
   * const builder = await supplier.getProductData(partialBuilder);
   * if (builder) {
   *   const product = await builder.build();
   *   console.log(product.title, product.cas, product.variants?.length);
   * }
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      if (typeof builder === "undefined") {
        this.logger.error("No products to get data for");
        return;
      }

      const productResponse = await this.httpGetHtml({
        path: builder.get("url") as string,
      });

      if (!productResponse) {
        this.logger.warn("No product response", { builder });
        return;
      }

      const mozApi = this.extractMozCatItemMozApi(productResponse);
      if (!mozApi) {
        this.logger.warn("No mozCatItemMozApi found", { url: builder.get("url") });
        return;
      }

      builder.setData({ title: mozApi.name });

      const cas = findCAS(mozApi.sku ?? "");
      if (cas) builder.setCAS(cas);

      const variants = Array.isArray(mozApi.variants) ? mozApi.variants : [];
      const main = variants[0];

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
          currencyCode: mozApi.currency as CurrencyCode,
          currencySymbol: "€",
          quantity: variantQty?.quantity,
          uom: variantQty?.uom,
          sku: variant.sku || undefined,
        });
      }

      return builder;
    });
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
   * Locates `var mozCatItemMozApi = { … };` inside a LiMac product page and
   * parses it into an object. The page emits a JS literal (unquoted keys,
   * trailing commas) rather than valid JSON, so the literal is normalised
   * via regex (quote keys, strip trailing commas) before `JSON.parse`. This
   * avoids `eval`/`new Function` so the supplier remains compatible with
   * extension CSP.
   *
   * @param html - The full product page HTML
   * @returns The parsed `mozCatItemMozApi` object, or undefined if missing/malformed
   * @example
   * ```typescript
   * const html = await this.httpGetHtml({ path: "/catalog/.../item/373337/" });
   * const api = this.extractMozCatItemMozApi(html ?? "");
   * console.log(api?.name, api?.sku, api?.variants?.length);
   * ```
   * @source
   */
  private extractMozCatItemMozApi(html: string): MozCatItemMozApi | undefined {
    const literal = this.extractJsObjectLiteral(html, "mozCatItemMozApi");
    if (!literal) return undefined;

    try {
      const normalised = literal
        .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*|\d+)\s*:/g, '$1"$2":')
        .replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(normalised) as MozCatItemMozApi;
    } catch (error) {
      this.logger.error("Failed to parse mozCatItemMozApi literal", { error, literal });
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
  // eslint-disable-next-line @typescript-eslint/naming-convention
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
  // eslint-disable-next-line @typescript-eslint/naming-convention
  price_undiscounted: number;
  sku: string;
  stock: number | null;
  weight: number | null;
}
