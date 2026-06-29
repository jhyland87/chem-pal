import { HttpError } from "@/helpers/exceptions";
import { sleep } from "@/helpers/utils";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { isHtmlResponse } from "@/utils/typeGuards/common";
import { SupplierBaseMagento2 } from "./SupplierBaseMagento2";

/** Outcome of a single product-page fetch attempt. */
type PageFetchResult =
  | { status: "ok"; html?: string }
  // `httpStatus` carries the HTTP status when the failure was an HttpError (e.g. 429, 404);
  // undefined for non-HTTP failures (network error, non-HTML response).
  | { status: "error"; httpStatus?: number };

/**
 * SupplierAladdinSci class that extends SupplierBaseMagento2 and implements AsyncIterable<Product>.
 *
 * @remarks
 * AladdinSci is a Magento 2 storefront that exposes the public unauthenticated
 * GraphQL endpoint at `/graphql`. The `Store: us_en` header (default) selects
 * the US storefront. The GraphQL search response only carries the product
 * picture for the new chemical-identifier fields, so {@link getProductData}
 * fetches each product's HTML page and scrapes the remaining data (SMILES,
 * IUPAC name, InChIKey, INCHI, PubChem CID, molecular weight, SDS, spec sheet).
 *
 * @category Suppliers
 * @source
 */
export class SupplierAladdinSci extends SupplierBaseMagento2 implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "AladdinSci";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.aladdinsci.com";

  // Shipping scope for AladdinSci
  public readonly shipping: ShippingRange = "worldwide";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  /** Base unit (n) for the escalating rate-limit backoff: pause = n, then 2n, 3n, … */
  private readonly backoffBaseDelayMs: number = 1000;

  /** Max attempts for a single product page before giving up (the product is still listed). */
  private readonly maxPageFetchAttempts: number = 5;

  /** True while one task is probing the server after a 429; all other page fetches wait. */
  private backoffActive: boolean = false;

  /**
   * Number of 429 backoff pauses taken so far this search; multiplies {@link backoffBaseDelayMs}
   * so consecutive 429s wait progressively longer (n, 2n, 3n, …). Resets per search since a fresh
   * supplier instance is created for each one.
   */
  private backoffLevel: number = 0;

  /** Gate awaited before each page fetch; a pending promise while a backoff probe runs. */
  private backoffGate: Promise<void> = Promise.resolve();

  /** Resolver that lifts {@link backoffGate}; defined only while the gate is closed. */
  private liftBackoffGate?: () => void;

  /**
   * Enriches a product by fetching its HTML product page (the permalink) and scraping the
   * fields that aren't available from the GraphQL search response. Wrapped in the shared
   * caching layer so each product page is fetched at most once per cache TTL.
   *
   * @param product - The product builder to enrich
   * @returns Promise resolving to the enriched product builder or void
   * @example
   * ```typescript
   * const enriched = await this.getProductData(builder);
   * if (enriched) {
   *   console.log((await enriched.build())?.smiles);
   * }
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      const permalink = builder.get("permalink") ?? builder.get("url");
      if (typeof permalink !== "string") {
        return builder;
      }

      // Fetch the product page with shared 429 backoff. Any failure (rate-limit retries
      // exhausted, network error, etc.) yields undefined, so the product is still listed —
      // just without the scraped data. The builder validates sufficiency at build time.
      const html = await this.fetchProductPage(permalink);
      if (!html) {
        return builder;
      }

      const doc = new DOMParser().parseFromString(html, "text/html");

      builder
        .setSmiles(this.cellText(doc, "Isomeric SMILES"))
        .setIupacName(this.cellText(doc, "IUPAC Name"))
        .setInChIKey(this.cellText(doc, "InChIKey"))
        .setInChI(this.cellText(doc, "INCHI"))
        .setPubchemId(this.cellText(doc, "PubChem CID"))
        .setMoleweight(this.molecularWeight(doc))
        .setSDSUrl(this.safetyGridLink(doc, "SDS"))
        .setSpecSheetUrl(this.safetyGridLink(doc, "Specification Sheet"));

      return builder;
    });
  }

  /**
   * Fetches a product page's HTML, applying shared rate-limit (429) backoff across all
   * concurrent product-page requests for this supplier. On a 429 the first task to see it
   * becomes the "prober" (see {@link probeAfterRateLimit}): it pauses every other page fetch,
   * waits, then retries a single request — resuming the rest only once a request succeeds.
   * Other tasks that hit a 429 meanwhile simply wait for the probe to clear. Any failure
   * (retries exhausted or a non-429 error) resolves to undefined so the product is still listed;
   * the failing status is recorded for {@link shouldCacheProductData}.
   *
   * @param url - The absolute product page URL to fetch
   * @returns The page HTML, or undefined when the page could not be retrieved
   * @example
   * ```typescript
   * const html = await this.fetchProductPage("https://www.aladdinsci.com/us_en/x.html");
   * ```
   * @source
   */
  private async fetchProductPage(url: string): Promise<string | undefined> {
    for (let attempt = 0; attempt < this.maxPageFetchAttempts; attempt++) {
      // Bail immediately if the search was aborted (e.g. maxAllowableSearchTime elapsed).
      if (this.controller.signal.aborted) {
        return undefined;
      }
      // Wait while another task is probing the server after a 429.
      await this.backoffGate;

      const result = await this.attemptPageFetch(url);
      if (result.status === "ok") {
        this.failedFetchStatuses.delete(url);
        return result.html;
      }

      this.recordFetchFailure(url, result.httpStatus);

      // Only a 429 triggers the shared backoff; any other failure ends this product's fetch.
      if (result.httpStatus !== 429) {
        return undefined;
      }

      // Rate limited. If a probe is already running, loop and wait on the gate; otherwise
      // become the prober (which pauses everyone else, waits, and retries one at a time).
      if (this.backoffActive) {
        continue;
      }
      return await this.probeAfterRateLimit(url);
    }

    return undefined;
  }

  /**
   * Single-flight backoff probe. Pauses all other product-page fetches, then repeatedly waits an
   * escalating interval ({@link backoffBaseDelayMs} × the running {@link backoffLevel}, i.e.
   * n, 2n, 3n, …) and retries one request until it succeeds, hits a non-429 error, or exhausts
   * {@link maxPageFetchAttempts}. The gate is always lifted on exit so paused tasks resume.
   *
   * @param url - The absolute product page URL to retry
   * @returns The page HTML on success, or undefined when the probe gives up
   * @example
   * ```typescript
   * const html = await this.probeAfterRateLimit("https://www.aladdinsci.com/us_en/x.html");
   * ```
   * @source
   */
  private async probeAfterRateLimit(url: string): Promise<string | undefined> {
    this.backoffActive = true;
    this.closeBackoffGate();
    try {
      for (let attempt = 0; attempt < this.maxPageFetchAttempts; attempt++) {
        if (this.controller.signal.aborted) {
          return undefined;
        }
        // Escalate the pause on each consecutive 429: n, then 2n, then 3n, …
        this.backoffLevel++;
        await sleep(this.backoffBaseDelayMs * this.backoffLevel);

        const result = await this.attemptPageFetch(url);
        if (result.status === "ok") {
          this.failedFetchStatuses.delete(url);
          return result.html;
        }

        this.recordFetchFailure(url, result.httpStatus);
        if (result.httpStatus !== 429) {
          return undefined;
        }
        // Still rate limited: wait another (longer) interval and probe again.
      }
      return undefined;
    } finally {
      this.backoffActive = false;
      this.openBackoffGate();
    }
  }

  /**
   * Performs a single product-page GET, classifying the outcome so the backoff loop can react.
   * On failure, the HTTP status (when the error was an HttpError) is included so the caller can
   * branch on 429 and record it for cache decisions.
   *
   * @param url - The absolute product page URL to fetch
   * @returns The classified fetch result
   * @example
   * ```typescript
   * const result = await this.attemptPageFetch(url); // { status: "ok", html: "<!doctype..." }
   * ```
   * @source
   */
  private async attemptPageFetch(url: string): Promise<PageFetchResult> {
    try {
      // rethrowErrors surfaces the HttpError (e.g. 429) instead of swallowing it.
      const response = await this.httpGet({ path: url, rethrowErrors: true });
      if (!response || !isHtmlResponse(response)) {
        return { status: "error" };
      }
      return { status: "ok", html: await response.text() };
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        return { status: "error", httpStatus: error.status };
      }
      return { status: "error" };
    }
  }

  /**
   * Closes the backoff gate so subsequent page fetches wait until it is lifted. Idempotent.
   * @returns void
   * @source
   */
  private closeBackoffGate(): void {
    if (this.liftBackoffGate) {
      return;
    }
    this.backoffGate = new Promise<void>((resolve) => {
      this.liftBackoffGate = resolve;
    });
  }

  /**
   * Lifts the backoff gate, resuming any paused page fetches. Idempotent.
   * @returns void
   * @source
   */
  private openBackoffGate(): void {
    if (!this.liftBackoffGate) {
      return;
    }
    this.liftBackoffGate();
    this.liftBackoffGate = undefined;
    this.backoffGate = Promise.resolve();
  }

  /**
   * Reads the trimmed text of a product-detail table cell, keyed by its `data-th` attribute.
   *
   * @param doc - The parsed product-page document
   * @param label - The `data-th` value identifying the cell (e.g. "IUPAC Name")
   * @returns The trimmed cell text, or undefined when the cell is missing or empty
   * @example
   * ```typescript
   * this.cellText(doc, "IUPAC Name"); // "dipotassium;oxalate"
   * ```
   * @source
   */
  private cellText(doc: Document, label: string): string | undefined {
    const text = doc.querySelector(`td[data-th="${label}"]`)?.textContent?.trim();
    return text && text.length > 0 ? text : undefined;
  }

  /**
   * Extracts the molecular weight from the product-detail table. The cell may include a unit
   * (e.g. "254.32 g/mol"), so only the leading numeric portion is returned for `setMoleweight`.
   *
   * @param doc - The parsed product-page document
   * @returns The numeric molecular weight as a string, or undefined when unavailable
   * @example
   * ```typescript
   * this.molecularWeight(doc); // "254.32"
   * ```
   * @source
   */
  private molecularWeight(doc: Document): string | undefined {
    const raw = this.cellText(doc, "Molecular Weight");
    return raw?.match(/\d+(?:\.\d+)?/)?.[0];
  }

  /**
   * Finds the download link inside the `.safety-grid` whose item heading contains the given text.
   * Placeholder anchors (e.g. `href="#"`) are ignored so only real document URLs are returned.
   *
   * @param doc - The parsed product-page document
   * @param heading - Text to match within a safety item's `<h4>` (e.g. "SDS", "Specification Sheet")
   * @returns The matching document URL, or undefined when no real link is found
   * @example
   * ```typescript
   * this.safetyGridLink(doc, "SDS"); // "https://.../P693472-SCI_....pdf"
   * ```
   * @source
   */
  private safetyGridLink(doc: Document, heading: string): string | undefined {
    const grid = doc.querySelector(".safety-grid");
    if (!grid) {
      return undefined;
    }

    for (const item of grid.querySelectorAll(".safety-item")) {
      if (item.querySelector("h4")?.textContent?.includes(heading)) {
        const href = item.querySelector("a")?.getAttribute("href")?.trim();
        return href && !href.startsWith("#") ? href : undefined;
      }
    }

    return undefined;
  }
}
