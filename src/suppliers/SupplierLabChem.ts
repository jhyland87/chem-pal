import { AVAILABILITY, CACHE, UOM } from "@/constants/common";
import { CURRENCY_SYMBOL_MAP } from "@/constants/currency";
import { findCAS } from "@/helpers/cas";
import { parseQuantity } from "@/helpers/quantity";
import { findFormulaInText, findMolarMass } from "@/helpers/science";
import { firstMap, htmlToAscii, mapDefined } from "@/helpers/utils";
import type {
  EpagesProductPage,
  EpagesSearchProduct,
  EpagesSearchResponse,
  EpagesVariationItem,
} from "@/types/labchem";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { scoreAstMatch } from "@/utils/search-query/evaluateAst";
import { cstorage } from "@/utils/storage";
import { isQuantityObject } from "@/utils/typeGuards/common";
import {
  isEpagesProductPage,
  isEpagesSearchResponse,
  isEpagesVariationsResponse,
} from "@/utils/typeGuards/labchem";
import { type JsonValue } from "type-fest";
import { SupplierBase } from "./SupplierBase";

/** ePages catalog-search endpoint (relative to `baseURL`). */
const SEARCH_PATH = "/api/v2/search";
/** Storefront locale sent with every search request. */
const LOCALE = "de_DE";
/** Products requested per catalog page (ePages caps this at 100). */
const RESULTS_PER_PAGE = 100;
/** Safety cap on catalog pages fetched (~1000 products). */
const MAX_CATALOG_PAGES = 10;
/** How long a cached catalog snapshot stays fresh (24h). */
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
/** Max products carried into the (expensive) per-product detail phase. */
const MAX_CANDIDATES = 10;
/** Max variations enumerated per product. */
const MAX_VARIANTS = 4;

/** A parsed quantity (value + unit) as returned by {@link parseQuantity}. */
interface ParsedQuantity {
  quantity: number;
  uom: string;
}

/** Persisted catalog snapshot: the full product list plus its capture time. */
interface CatalogCacheEntry {
  cachedAt: number;
  products: EpagesSearchProduct[];
}

/**
 * Narrows an unknown cached value to a {@link CatalogCacheEntry}.
 * @param value - The value read back from storage
 * @returns True when `value` has a numeric `cachedAt` and a `products` array
 * @source
 */
function isCatalogCacheEntry(value: unknown): value is CatalogCacheEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CatalogCacheEntry).cachedAt === "number" &&
    Array.isArray((value as CatalogCacheEntry).products)
  );
}

/**
 * Supplier module for LabChem (`labchem.de`), a German chemical retailer on the
 * ePages platform.
 *
 * @remarks
 * ePages spreads product data across several endpoints and its per-term search
 * relevance is unreliable, so instead of translating queries into native searches
 * this module fetches the **entire catalog once** (an empty-query, paginated
 * `POST /api/v2/search`), caches it for 24h, and filters it locally with
 * {@link fuzzyFilterAst} — giving deterministic, complete matching for the full
 * AND/OR/NOT predicate. Live price and stock are never taken from the catalog;
 * each candidate's variations list and per-variation product pages are fetched in
 * the detail phase (`getProductData`).
 *
 * @category Suppliers
 * @example
 * ```typescript
 * const supplier = new SupplierLabChem("aceton", 5, new AbortController());
 * for await (const product of supplier.execute()) {
 *   console.log(product.title, product.price, product.currencyCode);
 * }
 * ```
 * @source
 */
export class SupplierLabChem
  extends SupplierBase<EpagesSearchProduct, Product>
  implements ISupplier
{
  /** Name of supplier (for display purposes). */
  public readonly supplierName: string = "LabChem";

  /** Base URL for HTTP(s) requests. */
  public readonly baseURL: string = "https://www.labchem.de";

  /** Shipping scope for LabChem. */
  public readonly shipping: ShippingRange = "international";

  /** The country code of the supplier. */
  public readonly country: CountryCode = "DE";

  /** The payment methods accepted by the supplier. */
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  /** ePages shop id, used as the `shop` search parameter and in REST paths. */
  protected readonly shopId: string = "87762263";

  /** REST base for product/variation resources (trailing slash intentional). */
  protected readonly apiUrl: string = "https://www.labchem.de/rs/shops/87762263/";

  // We hold the whole catalog and apply the full boolean predicate locally via
  // fuzzyFilterAst, so the base performs a single queryProducts call (no
  // keyword-fallback union).
  protected readonly supportsNativeAdvancedSearch: boolean = true;

  // Budget: <=6 catalog pages once per 24h + up to 10 products x (1 variations +
  // <=4 variation pages) ~= 56.
  protected httpRequestHardLimit: number = 80;

  /**
   * Selects the title used for fuzzy matching from a raw catalog product.
   * @param data - The raw catalog product
   * @returns The product's title (falling back to its short name)
   * @example
   * ```typescript
   * this.titleSelector({ title: "Aceton reinst - LabChem", name: "Aceton reinst" }); // "Aceton reinst - LabChem"
   * ```
   * @source
   */
  protected titleSelector(data: EpagesSearchProduct): string {
    return data.title ?? data.name;
  }

  /**
   * Derives the stable product key from a catalog product: its `productId` (which,
   * for a variation master, is also the id used to build the variations/detail URLs).
   * @param data - The raw catalog product
   * @returns The product's UUID
   * @example
   * ```typescript
   * this.getUniqueProductKey({ productId: "5DDD5B1C-..." }); // "5DDD5B1C-..."
   * ```
   * @source
   */
  protected getUniqueProductKey(data: EpagesSearchProduct): string {
    return data.productId;
  }

  /**
   * Resolves the search for the current query. Loads the full catalog (cached 24h),
   * drops hidden products, and keeps those whose title satisfies the parsed query — the
   * gate is a case-insensitive substring predicate (honoring AND/OR/NOT), so a partial
   * term like "acet" matches "Aceton" but nothing unrelated. Survivors are then ranked by
   * fuzzy relevance (the supplier's `fuzzScorer`, `ratio` by default) so the closest
   * titles come first, and capped at `MAX_CANDIDATES`. `scoreAstMatch` supplies both:
   * its leaf gate is substring-based regardless of scorer, while its returned score is the
   * scorer's similarity. The `query` argument is unused; the parsed AST is read from
   * {@link getAst}.
   * @param query - The raw search term (unused; the parsed AST is used instead)
   * @param limit - Maximum number of candidates to return
   * @returns Product builders for the ranked matches, or void when the catalog is empty
   * @example
   * ```typescript
   * const builders = await this.queryProducts("acet", 5); // Aceton, Acetamid, …, Ethylacetat
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    this.logger.debug("queryProducts", { query, limit });
    const catalog = (await this.loadCatalog()).filter((product) => product.isVisible !== false);
    if (catalog.length === 0) {
      this.logger.warn("LabChem: catalog is empty");
      return;
    }

    // Substring gate + fuzzy ranking in one pass: scoreAstMatch keeps a title only when
    // the boolean predicate holds by case-insensitive substring (fuzzyWords: false, so no
    // noise), and returns the scorer's similarity so the survivors can be ranked.
    const ast = this.getAst().ast;
    const scorer = this.fuzzScorerOverride ?? this.fuzzScorer;
    const ranked = mapDefined(catalog, (product) => {
      const score = scoreAstMatch(this.titleSelector(product), ast, {
        scorer,
        threshold: 0,
        fuzzyWords: false,
      });
      return score === null ? undefined : { product, score };
    });
    ranked.sort((a, b) => b.score - a.score);

    const candidates = ranked
      .slice(0, Math.min(limit, MAX_CANDIDATES))
      .map((entry) => entry.product);
    return this.initProductBuilders(candidates);
  }

  /**
   * Loads the full product catalog, preferring a fresh 24h cache entry. On a cache
   * miss it fetches page 1 (to learn the total count), then fetches the remaining
   * pages concurrently, persists the combined list, and returns it. A failed page is
   * skipped rather than failing the whole search.
   * @returns The catalog products (possibly empty if page 1 fails)
   * @example
   * ```typescript
   * const products = await this.loadCatalog(); // [{ productId, name, ... }, ...]
   * ```
   * @source
   */
  private async loadCatalog(): Promise<EpagesSearchProduct[]> {
    const cached = await this.readCachedCatalog();
    if (cached) {
      this.logger.debug("LabChem: catalog cache hit", { count: cached.length });
      return cached;
    }

    const firstPage = await this.fetchCatalogPage(1);
    if (!firstPage) {
      return [];
    }

    const pageCount = Math.min(
      Math.ceil(firstPage.totalNumberOfProducts / RESULTS_PER_PAGE),
      MAX_CATALOG_PAGES,
    );
    const products = [...firstPage.products];

    if (pageCount > 1) {
      // Page 1 is the only serial dependency (it tells us how many pages exist);
      // fetch the rest concurrently.
      const rest = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_value, index) => this.fetchCatalogPage(index + 2)),
      );
      for (const page of rest) {
        if (page) {
          products.push(...page.products);
        }
      }
    }

    await this.writeCachedCatalog(products);
    return products;
  }

  /**
   * Fetches a single catalog page via the empty-query search. Tolerates a failed or
   * malformed response by returning undefined so pagination can skip it.
   * @param page - The 1-based page number
   * @returns The validated search response, or undefined on failure
   * @source
   */
  private async fetchCatalogPage(page: number): Promise<EpagesSearchResponse | undefined> {
    try {
      const response = await this.httpPostJson({
        path: SEARCH_PATH,
        params: {
          shop: this.shopId,
          resultsPerPage: String(RESULTS_PER_PAGE),
          page: String(page),
          locale: LOCALE,
        },
        body: { filters: [], query: "", sort: "relevance" },
        headers: { "Content-Type": "application/json" },
      });
      if (!isEpagesSearchResponse(response)) {
        this.logger.warn("LabChem: invalid catalog page response", { page, response });
        return undefined;
      }
      return response;
    } catch (error: unknown) {
      this.logger.warn("LabChem: catalog page request failed", { page, error });
      return undefined;
    }
  }

  /**
   * Reads a fresh (within `CATALOG_TTL_MS`) catalog snapshot from local storage.
   * @returns The cached products, or undefined when absent or expired
   * @source
   */
  private async readCachedCatalog(): Promise<EpagesSearchProduct[] | undefined> {
    try {
      const stored = await cstorage.local.get([CACHE.LABCHEM_CATALOG]);
      const entry = stored?.[CACHE.LABCHEM_CATALOG];
      if (isCatalogCacheEntry(entry) && Date.now() - entry.cachedAt < CATALOG_TTL_MS) {
        return entry.products;
      }
    } catch (error: unknown) {
      this.logger.warn("LabChem: failed to read catalog cache", { error });
    }
    return undefined;
  }

  /**
   * Persists the catalog snapshot to local storage, stamped with the current time.
   * @param products - The catalog products to cache
   * @returns A promise that resolves once the write completes
   * @source
   */
  private async writeCachedCatalog(products: EpagesSearchProduct[]): Promise<void> {
    try {
      const entry: CatalogCacheEntry = { cachedAt: Date.now(), products };
      await cstorage.local.set({ [CACHE.LABCHEM_CATALOG]: entry });
    } catch (error: unknown) {
      this.logger.warn("LabChem: failed to write catalog cache", { error });
    }
  }

  /**
   * Builds a {@link ProductBuilder} per catalog hit, seeding the fields available
   * from the search response — title, URL, SKU, id/cache key, and the chemical
   * identifiers parsed out of the HTML description (CAS, formula, molar mass). Price,
   * quantity and images are resolved later in {@link getProductData}.
   * @param products - The ranked catalog candidates
   * @returns The seeded product builders
   * @source
   */
  private initProductBuilders(products: EpagesSearchProduct[]): ProductBuilder<Product>[] {
    return mapDefined(products, (product) => {
      const url = product.slug
        ? `${this.baseURL}/${product.slug}`
        : product.links.find((link) => link.rel === "self")?.href;
      if (!url) {
        return;
      }

      const description = product.description ?? "";
      const builder = new ProductBuilder<Product>(this.baseURL);
      builder
        .setBasicInfo(product.title ?? product.name, url, this.supplierName)
        .setSku(product.sku)
        .setID(product.productId)
        .setCacheKey(this.getUniqueProductKey(product))
        .setDescription(htmlToAscii(description))
        .setCAS(findCAS(description));

      const formula = this.extractFormula(description);
      if (formula) {
        builder.setFormula(formula);
      }
      const moleweight = findMolarMass(description);
      if (moleweight !== undefined) {
        builder.setMoleweight(moleweight);
      }

      return builder;
    });
  }

  /**
   * Extracts the chemical formula from LabChem's German `<ul><li>` spec list. Prefers
   * the "Summenformel" row (the molecular/Hill formula), falling back to any other
   * "…Formel…" row (e.g. "Chem. Formel") whose value validates as a formula. Each
   * candidate is verified with {@link findFormulaInText} in a single pass.
   * @param html - The product's HTML description
   * @returns The validated formula (with any sub/superscripts normalized), or undefined
   * @example
   * ```typescript
   * this.extractFormula("<ul><li>Summenformel n. Hill: C3H6O</li></ul>"); // "C3H6O"
   * ```
   * @source
   */
  private extractFormula(html: string): string | undefined {
    const rows = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((match) =>
      htmlToAscii(match[1]),
    );

    let fallback: string | undefined;
    for (const row of rows) {
      const idx = row.indexOf(":");
      if (idx === -1) {
        continue;
      }
      const key = row.slice(0, idx);
      if (!/formel/i.test(key)) {
        continue;
      }
      const formula = findFormulaInText(row.slice(idx + 1).trim());
      if (!formula) {
        continue;
      }
      // "Summenformel" (the molecular/Hill formula) wins; anything else is a fallback.
      if (/sum/i.test(key)) {
        return formula;
      }
      fallback ??= formula;
    }

    return fallback;
  }

  /**
   * Enriches a candidate with live detail data. Fetches the master's variations
   * list, then each purchasable variation's product page (in parallel, capped at
   * `MAX_VARIANTS`), and applies the authoritative price/quantity/permalink and
   * images from the cheapest variation, with the remaining sizes added as variants.
   * @param product - The product builder to enrich
   * @returns The enriched builder (or void if it was excluded/uncacheable)
   * @example
   * ```typescript
   * const enriched = await this.getProductData(builder);
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      const masterId = String(builder.get("id") ?? "");
      if (!masterId) {
        return builder;
      }

      const variationItems = await this.fetchVariationItems(masterId);
      if (variationItems.length === 0) {
        this.logger.warn("LabChem: no purchasable variations", { masterId });
        return builder;
      }

      const pages = (
        await Promise.all(variationItems.map((item) => this.fetchProductPage(item.link.href)))
      ).filter((page): page is EpagesProductPage => page !== undefined && page.forSale === true);

      if (pages.length === 0) {
        this.logger.warn("LabChem: no for-sale variation pages", { masterId });
        return builder;
      }

      // The variations list is size-ascending, so pages[0] is the cheapest — use it
      // as the headline row (and its image set); the rest become variants.
      pages.forEach((page, index) => {
        const amount = page.priceInfo?.price?.amount;
        const currency = page.priceInfo?.price?.currency ?? "EUR";
        const quantity = this.variantQuantity(page);
        const title = page.productVariationSelection?.[0]?.displayValue ?? page.title;

        if (index === 0) {
          if (typeof amount === "number") {
            builder.setPricing(amount, currency, CURRENCY_SYMBOL_MAP[currency] ?? currency);
          }
          if (quantity) {
            builder.setQuantity(quantity.quantity, quantity.uom);
          } else {
            builder.setQuantity(1, UOM.EA);
          }
          if (page.sfUrl) {
            builder.setPermalink(page.sfUrl);
          }
          builder.addImages(this.productImages(page));
          return;
        }

        builder.addVariant({
          id: page.productId,
          title,
          sku: page.productNumber,
          price: amount,
          status: AVAILABILITY.IN_STOCK,
          ...(quantity ?? { quantity: 1, uom: UOM.EA }),
        });
      });

      return builder;
    });
  }

  /**
   * Fetches and filters a master's variations list: keeps only entries linked as a
   * `variation` that aren't flagged `purchasable: false`, capped at `MAX_VARIANTS`.
   * @param masterId - The variation-master product id
   * @returns The purchasable variation items (possibly empty)
   * @source
   */
  private async fetchVariationItems(masterId: string): Promise<EpagesVariationItem[]> {
    const response = await this.fetchJson(`${this.apiUrl}products/${masterId}/variations`);
    if (!isEpagesVariationsResponse(response)) {
      return [];
    }
    return response.items
      .filter(
        (item) =>
          item.link?.rel === "variation" && item.additionalAttributes?.purchasable !== false,
      )
      .slice(0, MAX_VARIANTS);
  }

  /**
   * Fetches and validates a single variation product page.
   * @param href - The absolute product-page URL from the variation link
   * @returns The validated product page, or undefined on failure
   * @source
   */
  private async fetchProductPage(href: string): Promise<EpagesProductPage | undefined> {
    const response = await this.fetchJson(href);
    return isEpagesProductPage(response) ? response : undefined;
  }

  /**
   * GET a JSON resource, tolerating network/HTTP failures by returning undefined so a
   * single bad request doesn't abort the whole enrichment.
   * @param url - The absolute resource URL
   * @returns The parsed JSON value, or undefined on failure
   * @source
   */
  private async fetchJson(url: string): Promise<Maybe<JsonValue>> {
    try {
      return await this.httpGetJson({ path: url });
    } catch (error: unknown) {
      this.logger.warn("LabChem: GET failed", { url, error });
      return undefined;
    }
  }

  /**
   * Derives a variation's quantity from its selected size attribute (e.g. "2,5 l"),
   * falling back to the product number and title.
   * @param page - The variation product page
   * @returns The parsed quantity, or undefined when none can be parsed
   * @source
   */
  private variantQuantity(page: EpagesProductPage): ParsedQuantity | undefined {
    const selections = page.productVariationSelection ?? [];
    const candidates = [
      ...selections.map((selection) => selection.displayValue),
      ...selections.map((selection) => selection.value),
      page.productNumber ?? "",
      page.title ?? "",
    ];
    const quantity = firstMap(parseQuantity, candidates);
    return isQuantityObject(quantity) ? quantity : undefined;
  }

  /**
   * Maps a variation page's images to the full-size + thumbnail entries the product
   * expects, using the ePages size classifiers (Medium for the full image, Thumbnail
   * for the thumbnail), with sensible fallbacks.
   * @param page - The variation product page
   * @returns The image entries (empty when the page has no images)
   * @source
   */
  private productImages(page: EpagesProductPage): ProductImage[] {
    const images = page.images ?? [];
    const byClassifier = (classifier: string): string | undefined =>
      images.find((image) => image.classifier === classifier)?.url;

    const full = byClassifier("Medium") ?? byClassifier("Large") ?? images[0]?.url;
    const thumbnail = byClassifier("Thumbnail") ?? byClassifier("Small");

    const result: ProductImage[] = [];
    if (full) {
      result.push({ href: full, type: "image" });
    }
    if (thumbnail) {
      result.push({ href: thumbnail, type: "thumbnail" });
    }
    return result;
  }
}
