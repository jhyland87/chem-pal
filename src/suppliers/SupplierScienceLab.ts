import { CURRENCY_SYMBOL_MAP } from '@/constants/currency';
import { FUZZ_SCORERS, type FuzzScorerFn } from '@/constants/fuzzScorers';
import { parseQuantity } from '@/helpers/quantity';
import { createDOM } from '@/helpers/request';
import { SchemaOrgData, type SchemaNode } from '@/helpers/schema-org';
import { findFormulaInText, formatFormula, parseGrade } from '@/helpers/science';
import { mapDefined } from '@/helpers/utils';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { isHttpResponse } from '@/utils/typeGuards/common';
import { isScienceLabAttributeResponse } from '@/utils/typeGuards/sciencelab';
import { SupplierBase } from './SupplierBase';

// --- Slug → name recovery -------------------------------------------------
// ScienceLab has no usable search API, so the catalog is pulled from the XML
// sitemap where each product is only a URL. These module-scope helpers turn a
// product URL's slug back into something close to the store's real title for the
// ranking pass; the real title is recovered later from the product page.

/** Matches a single volume-ratio token, e.g. the `v` in `v-v`. */
const RATIO = /^[vw]$/;
/** Matches a run of digits. */
const DIGITS = /^\d+$/;
/** Matches a three-digit group that opens a thousands separator, e.g. `000ppm`. */
const LEADS_3_DIGITS = /^\d{3}(\D|$)/;
/** Matches a mass/volume unit that pairs with `/L`, e.g. `g`, `mg`, `kg`. */
const VOLUME_UNIT = /^(m?[gl]|k?g|lb|oz)$/;
/** Words that mark a preceding bare number as a percent concentration. */
const CONCENTRATION_CONTEXT = new Set([
  'aqueous',
  'solution',
  'solutions',
  'indicator',
  'reagent',
  'in',
  'alcoholic',
  'alcohol',
  'methanol',
  'ethanol',
  'ipa',
  'certified',
  'standardized',
  'stabilized',
  'tech',
  'technical',
  'lab',
  'laboratory',
  'food',
  'usp',
]);
/** Stereo/position prefixes that keep their hyphen (`p-xylene`, `tert-butyl`). */
const CHEM_PREFIX =
  /^(n|o|m|p|d|l|t|r|s|e|z|tert|sec|iso|cis|trans|alpha|beta|gamma|ortho|meta|para)$/;

/**
 * Pulls the single-segment product slug out of a ScienceLab URL.
 *
 * Product pages live at the site root (`https://sciencelab.com/<slug>/`);
 * anything nested (a category or CMS page) is rejected so the sitemap's
 * non-product entries are skipped.
 *
 * @param url - A URL from the sitemap (absolute).
 * @returns The decoded slug, or `null` when the URL isn't a root-level product.
 * @example
 * ```typescript
 * slugFromUrl('https://sciencelab.com/isopropyl-alcohol-70-v-v/'); // "isopropyl-alcohol-70-v-v"
 * slugFromUrl('https://sciencelab.com/brands/acme/'); // null
 * ```
 * @category Suppliers
 * @group Parsers
 * @source
 */
export function slugFromUrl(url: string): string | null {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const slug = path.replace(/^\/+|\/+$/g, '');
  return slug && !slug.includes('/') ? decodeURIComponent(slug) : null;
}

/**
 * Turns a product slug back into something close to the store's product title.
 *
 * Slugs flatten punctuation to hyphens, so this reverses the common cases:
 *   - `v-v` / `w-w` / `w-v` → `(v/v)`, and marks the number before it as a percent
 *   - concentration context → percent: `10-aqueous-solution` → `10% aqueous solution`
 *   - leading digit runs → locants: `1-2-dichloroethane` → `1,2-dichloroethane`
 *   - three-digit groups → thousands: `1-000ppm` → `1,000ppm`
 *   - ascending pairs → ranges: `20-30-mesh` → `20-30 mesh`
 *   - other digit pairs → decimals: `0-100-normal` → `0.100 normal`
 *   - `1g-l` / `10-g-l` → `1g/L` / `10 g/L`
 *   - `p-xylene` → keeps the stereo/position prefix hyphen
 *
 * Measured at ~74% exact match (case- and comma-insensitive) against real
 * product titles; the remainder is unrecoverable from a slug (commas, editorial
 * parentheticals, degree signs, `#`, `=`, `+`). The real title is recovered from
 * the product page later, so this only needs to be good enough to rank matches.
 *
 * @param slug - A product slug, e.g. `sodium-metasilicate-anhydrous`.
 * @returns The humanized product name.
 * @example
 * ```typescript
 * humanizeSlug('isopropyl-alcohol-70-v-v-aqueous-solution');
 * // "isopropyl alcohol 70% (v/v) aqueous solution"
 * ```
 * @category Suppliers
 * @group Parsers
 * @source
 */
export function humanizeSlug(slug: string): string {
  const parts = slug.split('-').filter(Boolean);
  const out: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const cur = parts[i];
    const next = parts[i + 1];
    const prev = out[out.length - 1];

    // "1-2-dichloroethane" -> "1,2-dichloroethane": leading digits are locants.
    if (
      i === 0 &&
      DIGITS.test(cur) &&
      next &&
      DIGITS.test(next) &&
      parts[i + 2] &&
      !DIGITS.test(parts[i + 2])
    ) {
      out.push(`${cur},${next}-${parts[i + 2]}`);
      i += 2;
      continue;
    }

    // "p-xylene", "tert-butyl": stereo/position prefixes keep their hyphen.
    if (i === 0 && next && CHEM_PREFIX.test(cur)) {
      out.push(`${cur}-${next}`);
      i++;
      continue;
    }

    // "v-v" -> "(v/v)"; a bare number in front of it is a percentage.
    if (next && RATIO.test(cur) && RATIO.test(next)) {
      if (prev && /\d$/.test(prev)) out[out.length - 1] = `${prev}%`;
      out.push(`(${cur}/${next})`);
      i++;
      continue;
    }

    // "1g-l" / "10-g-l" -> "1g/L" / "10 g/L"
    if (next === 'l' && VOLUME_UNIT.test(cur.replace(/^\d+/, ''))) {
      out.push(`${cur}/L`);
      i++;
      continue;
    }

    if (next && DIGITS.test(cur)) {
      // Leading zero is always a decimal: "0-0855" -> "0.0855"
      if (cur.startsWith('0') && DIGITS.test(next)) {
        out.push(`${cur}.${next}`);
        i++;
        continue;
      }
      // Three digits following is a thousands group: "1-000ppm" -> "1,000ppm"
      if (LEADS_3_DIGITS.test(next)) {
        out.push(`${cur},${next}`);
        i++;
        continue;
      }
      // Ascending multi-digit pair is a range: "20-30-mesh" -> "20-30 mesh"
      if (DIGITS.test(next) && cur.length >= 2 && next.length >= 2 && Number(next) > Number(cur)) {
        out.push(`${cur}-${next}`);
        i++;
        continue;
      }
      // Otherwise a decimal: "6-0-normal" -> "6.0 normal"
      if (DIGITS.test(next)) {
        out.push(`${cur}.${next}`);
        i++;
        continue;
      }
    }

    out.push(cur);
  }

  for (let i = 0; i < out.length - 1; i++) {
    // "10 aqueous solution" -> "10% aqueous solution"; also catches decimals.
    if (/^\d+([.,]\d+)?$/.test(out[i]) && CONCENTRATION_CONTEXT.has(out[i + 1])) {
      out[i] = `${out[i]}%`;
    }
    // Conductivity standards: "1,500 s solution" -> "1,500 µS solution"
    if (out[i + 1] === 's' && /^\d+,\d{3}$/.test(out[i])) out[i + 1] = 'µS';
  }

  return out.join(' ');
}

// --- Concentration from title ---------------------------------------------
// ScienceLab titles state a solution's concentration in one of several forms: a
// percentage (often with a v/v, w/v, or w/w method marker), a molarity
// ("0.7 Molar"), a normality ("0.100 Normal"), a mass concentration ("800 ppm",
// "10 g/L"), or a bare stabilizer marker ("(w/BHT)").

/** Matches a v/v, w/v, w/w, or w/BHT concentration method marker. */
const CONCENTRATION_METHOD = /\(?\s*([vw])\s*\/\s*([vw]|bht)\s*\)?/i;

/**
 * Normalizes a matched concentration method marker to a canonical
 * parenthesized, lower-cased form (`BHT` is kept upper-case).
 * @param raw - The raw matched marker text (e.g. `w/v`, `( V / V )`), if any.
 * @returns The normalized marker (e.g. `(v/v)`, `(w/BHT)`), or undefined.
 * @example
 * ```typescript
 * normalizeMethod('W/V'); // "(w/v)"
 * ```
 * @source
 */
function normalizeMethod(raw: string | undefined): string | undefined {
  const match = raw?.match(CONCENTRATION_METHOD);
  if (!match) {
    return undefined;
  }
  const denominator = match[2].toLowerCase() === 'bht' ? 'BHT' : match[2].toLowerCase();
  return `(${match[1].toLowerCase()}/${denominator})`;
}

/**
 * Extracts a solution concentration from a ScienceLab product title.
 *
 * Handles the forms the catalog uses, in order of precedence: molarity
 * (`0.7 Molar`) and normality (`0.100 Normal`) — the earliest-stated of the two
 * wins when both appear — then mass concentration (`800 ppm`), then a percentage
 * (`70% (v/v)`, `20% w/v`, `90+%`, `>95%`), then `g/L`, then a bare stabilizer
 * marker (`(w/BHT)`). Molarity/normality/ppm deliberately outrank a percentage,
 * because a percentage stated alongside them describes the solvent or matrix
 * (`1000 ppm … in 3% HNO₃`, `0.1 Normal in 90% Isopropanol`), not the product. A
 * v/v, w/v, or w/w method marker is appended to a percentage or ppm value.
 *
 * @param title - The product title.
 * @returns The concentration string, or undefined when the title states none.
 * @example
 * ```typescript
 * parseConcentration('Isopropyl Alcohol 70% (v/v) Aqueous Solution'); // "70% (v/v)"
 * parseConcentration('Nitric Acid 6.0 Normal Aqueous Solution'); // "6.0 Normal"
 * parseConcentration('Bromide Standard (w/w) 800 PPM as Br'); // "800 ppm (w/w)"
 * parseConcentration('Sodium Chloride, ACS Grade'); // undefined
 * ```
 * @category Suppliers
 * @group Parsers
 * @source
 */
export function parseConcentration(title: string): string | undefined {
  if (typeof title !== 'string' || title.length === 0) {
    return undefined;
  }
  const text = title.replace(/&gt;/gi, '>').replace(/&lt;/gi, '<').replace(/&ge;/gi, '≥');
  const method = normalizeMethod(text.match(CONCENTRATION_METHOD)?.[0]);
  const withMethod = (core: string) => (method ? `${core} ${method}` : core);

  // Molarity / normality outrank a percentage (a co-occurring percent is the
  // solvent). Between the two, the earliest-stated wins.
  const molar = text.match(/(\d+(?:\.\d+)?)\s*Molar\b/i);
  const normal = text.match(/(\d+(?:\.\d+)?)\s*Normal\b/i);
  if (molar && (!normal || (molar.index ?? 0) <= (normal.index ?? 0))) {
    return `${molar[1]} Molar`;
  }
  if (normal) {
    return `${normal[1]} Normal`;
  }

  const ppm = text.match(/(\d[\d,]*(?:\.\d+)?)\s*ppm\b/i);
  if (ppm) {
    return withMethod(`${ppm[1]} ppm`);
  }

  // Comparator (`>`/`≥`), number, optional range/`+`, then `%`.
  const percent = text.match(/([<>≥≤]\s*)?\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*\+?\s*%\+?/);
  if (percent) {
    return withMethod(percent[0].replace(/\s+/g, ''));
  }

  const gramsPerLiter = text.match(/(\d+(?:\.\d+)?)\s*g\/L\b/i);
  if (gramsPerLiter) {
    return withMethod(`${gramsPerLiter[1]} g/L`);
  }

  // A stabilizer marker with no numeric concentration, e.g. "(w/BHT)".
  return method;
}

/**
 * A single ScienceLab catalog entry recovered from the XML sitemap: the product
 * URL, its slug, and a best-effort humanized name used for fuzzy matching. The
 * real product title is fetched later from the product page.
 */
interface ScienceLabItem {
  /** Full product URL, e.g. `https://sciencelab.com/sodium-hexametaphosphate-anhydrous/`. */
  url: string;
  /** Root-level URL slug, the stable per-product key. */
  slug: string;
  /** Humanized product name (from {@link humanizeSlug}). */
  name: string;
  /** Fuzzy match score (0-100), attached by {@link SupplierBase.fuzzyFilterAst}. */
  matchPercentage?: number;
}

/**
 * Supplier implementation for ScienceLab, a US chemical supplier running on
 * BigCommerce (sciencelab.com). BigCommerce has no matching platform base, so
 * this extends {@link SupplierBase} directly.
 *
 * The on-site search returns only 12 products per page, so instead the whole
 * catalog is pulled from the XML sitemap (one request), product names are
 * recovered from the URL slugs, and matches are ranked locally. The top-`limit`
 * product pages are then scraped for the real title, price, CAS, formula, and
 * per-size variant pricing (each size priced via the BigCommerce
 * product-attributes AJAX endpoint).
 *
 * @typeParam S - The supplier-specific search item ({@link ScienceLabItem})
 * @typeParam T - The common Product type that all suppliers map to
 * @example
 * ```typescript
 * const supplier = new SupplierScienceLab("sodium hexametaphosphate", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log("Found product:", product.title, product.price);
 * }
 * ```
 * @category Suppliers
 * @source
 */
export class SupplierScienceLab extends SupplierBase<ScienceLabItem, Product> implements ISupplier {
  // Display name of the supplier used for UI and logging
  public readonly supplierName: string = 'ScienceLab';

  // Base URL for all requests (non-www, matching the sitemap and og:url)
  public readonly baseURL: string = 'https://sciencelab.com';

  // Shipping scope for ScienceLab (US domestic chemical supplier)
  public readonly shipping: ShippingRange = 'domestic';

  // The country code of the supplier.
  // This is used to determine the currency and other country-specific information.
  public readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  // Maximum number of HTTP requests allowed per search query. Up to `limit`
  // products, each a page fetch plus a variant-price POST per size, add up — so
  // this is sized for the raised default limit (15) with several sizes each.
  protected httpRequestHardLimit: number = 150;

  // Number of product-detail fetches to run in parallel.
  protected maxConcurrentRequests: number = 5;

  // token_set_ratio scores 100 when the query's words are all present in the
  // (verbose, qualifier-laden) title, and drops unrelated products that merely
  // share a common word like "sodium" well below the cutoff — far better
  // separation on the full catalog than the default WRatio (which floats every
  // "sodium …" title to ~86). Paired with a raised cutoff to keep results tight.
  protected readonly fuzzScorer: FuzzScorerFn = FUZZ_SCORERS.token_set_ratio;

  // Fuzzing the whole 1,681-product catalog surfaces loose matches at the
  // default 65; 80 keeps only genuinely close titles (true matches score ~90+).
  protected readonly minMatchPercentage: number = 80;

  // The whole catalog is fuzzed client-side against the parsed query (AST and
  // all), so a boolean/advanced query is fully handled in one pass — there's no
  // keyword-fallback decomposition to do.
  protected readonly supportsNativeAdvancedSearch: boolean = true;

  // Ceiling on sitemap pages to walk before giving up (page 1 holds the whole
  // catalog today, but BigCommerce paginates, so the loop is bounded).
  private readonly maxSitemapPages: number = 20;

  /**
   * Floors the results limit at 15. ScienceLab is a single-store catalog search
   * (one sitemap fetch), so surfacing more results than the global default (5)
   * is cheap and useful; an explicit larger caller limit is still honored.
   * @param query - The search query.
   * @param limit - The requested results limit (raised to at least 15).
   * @param controller - Optional abort controller for the search.
   * @example
   * ```typescript
   * new SupplierScienceLab('acetone').limit; // 15
   * ```
   * @source
   */
  public constructor(query: string, limit?: number, controller?: AbortController) {
    super(query, Math.max(limit ?? 0, 15), controller);
  }

  /**
   * Derives the stable unique key for a ScienceLab search item: its URL slug,
   * which survives the query→detail transition and is unique per product.
   * @param data - The raw {@link ScienceLabItem}
   * @returns The product slug
   * @example
   * ```typescript
   * this.getUniqueProductKey(item); // "sodium-hexametaphosphate-anhydrous"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: ScienceLabItem): string {
    return data.slug;
  }

  /**
   * Extracts the humanized product name from a ScienceLab search item. Used by
   * the base fuzzy filter to score each item against the query.
   * @param data - The raw {@link ScienceLabItem}
   * @returns The humanized product name, or undefined when absent
   * @example
   * ```typescript
   * this.titleSelector(item); // "sodium hexametaphosphate anhydrous"
   * ```
   * @source
   */
  protected titleSelector(data: ScienceLabItem): Maybe<string> {
    return data?.name;
  }

  /**
   * Queries ScienceLab products. Fetches the full catalog from the XML sitemap,
   * fuzzy-filters the humanized names against the query, and returns basic
   * builders for the top `limit` matches (priced later in `getProductData`).
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to return
   * @returns Basic product builders for the top matches, or void on failure
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
    this.logger.log('queryProducts:', { query, limit });

    const catalog = await this.fetchCatalog();
    if (catalog.length === 0) {
      this.logger.error('Empty ScienceLab catalog', { query });
      return;
    }

    // Score every catalog entry directly and rank by score. The base
    // `fuzzyFilter`/`extract` path can't be used here: on a list this large its
    // fuzzball `extract` call misassigns scores to the wrong items (e.g. an
    // unrelated title reported at 95). `fuzzyScoreAst` scores one title at a
    // time against the parsed query — honoring the query AST, the user's scorer
    // override, and the match cutoff (returning null to drop) — so it stays
    // correct at scale.
    const matches: ScienceLabItem[] = [];
    for (const item of catalog) {
      const score = this.fuzzyScoreAst(item.name);
      if (score === null) {
        continue;
      }
      item.matchPercentage = score;
      matches.push(item);
    }
    matches.sort((a, b) => (b.matchPercentage ?? 0) - (a.matchPercentage ?? 0));
    // Scored per item via `fuzzyScoreAst`, so the base `fuzzyFilter` scorer
    // comparison table never fires — log the ranked head instead for visibility.
    this.logger.debug('queryProducts ranked:', {
      query,
      matched: matches.length,
      top: matches.slice(0, 10).map((m) => ({ score: m.matchPercentage, name: m.name })),
    });

    return this.initProductBuilders(matches.slice(0, limit));
  }

  /**
   * Fetches the whole ScienceLab catalog from the product XML sitemap. Walks the
   * paginated sitemap until a page adds no new products (covering both an empty
   * page and a page that repeats the previous one), deduping by slug.
   * @returns Every catalog item, with a humanized name
   * @example
   * ```typescript
   * const catalog = await this.fetchCatalog();
   * console.log(catalog[0]); // { url, slug, name }
   * ```
   * @source
   */
  private async fetchCatalog(): Promise<ScienceLabItem[]> {
    const items: ScienceLabItem[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= this.maxSitemapPages; page++) {
      const xml = await this.fetchSitemapPage(page);
      if (!xml) {
        break;
      }

      const before = items.length;
      for (const url of this.extractLocs(xml)) {
        const slug = slugFromUrl(url);
        if (!slug || seen.has(slug)) {
          continue;
        }
        seen.add(slug);
        items.push({ url, slug, name: humanizeSlug(slug) });
      }

      // No new products on this page — end of catalog (or a repeated page).
      if (items.length === before) {
        break;
      }
    }

    return items;
  }

  /**
   * Fetches one page of the product sitemap as raw XML. Uses `httpGet` rather
   * than `httpGetHtml` because the sitemap is served as XML, which the HTML
   * content-type guard may reject.
   * @param page - The 1-based sitemap page number
   * @returns The page XML, or undefined when the request fails
   * @example
   * ```typescript
   * const xml = await this.fetchSitemapPage(1);
   * ```
   * @source
   */
  private async fetchSitemapPage(page: number): Promise<Maybe<string>> {
    const response = await this.httpGet({
      path: '/xmlsitemap.php',
      params: { type: 'products', page },
    });
    if (!isHttpResponse(response) || !response.ok) {
      return undefined;
    }
    return await response.text();
  }

  /**
   * Extracts every `<loc>` URL from a sitemap XML string.
   * @param xml - The sitemap XML
   * @returns The URLs, trimmed
   * @example
   * ```typescript
   * this.extractLocs("<loc>https://sciencelab.com/acetone/</loc>"); // ["https://sciencelab.com/acetone/"]
   * ```
   * @source
   */
  private extractLocs(xml: string): string[] {
    const matches = xml.match(/<loc>\s*([^<]+?)\s*<\/loc>/g) ?? [];
    return matches.map((loc) => loc.replace(/<\/?loc>/g, '').trim());
  }

  /**
   * Builds basic product builders (title, URL, cache key, match score) from
   * ranked catalog items. Pricing and specs are filled later by `getProductData`.
   * @param items - The ranked {@link ScienceLabItem} matches
   * @returns One builder per item
   * @example
   * ```typescript
   * const builders = this.initProductBuilders(matches);
   * ```
   * @source
   */
  protected initProductBuilders(items: ScienceLabItem[]): ProductBuilder<Product>[] {
    return mapDefined(items, (item) =>
      new ProductBuilder<Product>(this.baseURL)
        .setBasicInfo(item.name, item.url, this.supplierName)
        .setCacheKey(this.getUniqueProductKey(item))
        .setMatchPercentage(item.matchPercentage),
    );
  }

  /**
   * Fetches and parses a ScienceLab product page: the ld+json Product block
   * (real title, sku, image, price, availability), the spec table (CAS,
   * molecular formula, molecular weight, special-considerations restriction), the
   * grade and concentration (from the title), and each size variant (priced via
   * the product-attributes endpoint).
   * @param product - The basic product builder from `queryProducts`
   * @returns The enriched builder, or void when the page can't be fetched
   * @example
   * ```typescript
   * const full = await supplier.getProductData(builder);
   * console.log(full?.dump().cas, full?.dump().variants?.length);
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      if (typeof builder === 'undefined') {
        this.logger.error('No products to get data for', { builder });
        return;
      }

      const html = await this.httpGetHtml({ path: builder.get('url') });
      if (!html) {
        this.logger.warn('No product response', { builder });
        return;
      }

      const dom = createDOM(html);

      // schema.org Product ld+json: real title, sku, image, price, availability.
      const schema = SchemaOrgData.fromDocument(dom);
      const productNode = schema.first('Product');
      const offer = schema.all('Offer')[0];

      const description = this.decodeDescription(productNode?.description);
      if (productNode) {
        // The real store title replaces the humanized slug guess.
        builder.setTitle(productNode.name);
        builder.setSku(productNode.sku);
        builder.setID(productNode.mpn);
        builder.setImage(
          Array.isArray(productNode.image) ? productNode.image[0] : productNode.image,
        );
        if (description) {
          builder.setDescription(description);
        }
      }

      this.applyPricing(builder, offer, dom);

      const availability =
        offer && typeof offer.availability === 'string'
          ? offer.availability
          : this.metaContent(dom, 'og:availability');
      if (availability) {
        builder.setAvailability(availability);
      }

      this.applyInfoFields(builder, dom, description);
      const title = String(builder.get('title') ?? '');
      builder.setGrade(parseGrade(title));
      builder.setConcentration(parseConcentration(title));

      // BigCommerce product id (needed for variant pricing) lives only in og:id.
      const productId = this.metaContent(dom, 'og:id');
      if (productId) {
        const variants = await this.parseVariants(dom, productId);
        if (variants.length > 0) {
          builder.setVariants(variants);
          this.anchorBaseVariant(builder, variants[0]);
        }
      }

      return builder;
    });
  }

  /**
   * Sets the base product price and currency from the ld+json offer (its
   * `minPrice` — the smallest size), falling back to the `product:price:amount`
   * meta tag.
   * @param builder - The product builder to price
   * @param offer - The ld+json Offer node, if present
   * @param dom - The parsed product page
   * @source
   */
  private applyPricing(
    builder: ProductBuilder<Product>,
    offer: SchemaNode | undefined,
    dom: Document,
  ): void {
    const price = this.readOfferPrice(offer) ?? this.readMetaPrice(dom);
    if (price === undefined) {
      return;
    }
    const currencyCode =
      offer && typeof offer.priceCurrency === 'string' ? offer.priceCurrency : 'USD';
    builder.setPrice(price);
    builder.setCurrencyCode(currencyCode);
    builder.setCurrencySymbol(CURRENCY_SYMBOL_MAP[currencyCode]);
  }

  /**
   * Reads the lowest numeric price from a ld+json Offer node, trying `minPrice`,
   * `price`, then `lowPrice` (values may be numbers or numeric strings).
   * @param offer - The ld+json Offer node, if present
   * @returns The price, or undefined when none is parseable
   * @example
   * ```typescript
   * this.readOfferPrice({ minPrice: "108" }); // 108
   * ```
   * @source
   */
  private readOfferPrice(offer: SchemaNode | undefined): number | undefined {
    if (!offer) {
      return undefined;
    }
    for (const key of ['minPrice', 'price', 'lowPrice']) {
      const value = offer[key];
      const num =
        typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
      if (Number.isFinite(num)) {
        return num;
      }
    }
    return undefined;
  }

  /**
   * Reads the `product:price:amount` meta tag as a fallback base price.
   * @param dom - The parsed product page
   * @returns The price, or undefined when absent/unparseable
   * @example
   * ```typescript
   * this.readMetaPrice(dom); // 108
   * ```
   * @source
   */
  private readMetaPrice(dom: Document): number | undefined {
    const raw = this.metaContent(dom, 'product:price:amount', 'property');
    if (raw === undefined) {
      return undefined;
    }
    const num = Number(raw);
    return Number.isFinite(num) ? num : undefined;
  }

  /**
   * Applies the product-page spec table to the builder: CAS number, molecular
   * formula, molecular weight, and "Special Considerations" (kept as an
   * informational restriction note).
   *
   * The spec table is the only trustworthy source for CAS and formula. When the
   * molecular-formula row is absent, the ld+json *description* is a safe fallback
   * — `findFormulaInText` yields the formula for a single compound and nothing
   * for a solution. There is deliberately no CAS fallback: a solution's
   * description leads with its solvent (water, acetic acid), so scraping a CAS
   * from it would mislabel the product with the solvent's number.
   *
   * "Special Considerations" is a generic hazmat/handling notice ScienceLab
   * shows on most products ("higher shipping charges … may apply", "Customer
   * Service will contact you"). It is captured as a `note` only — never
   * `restrictedDelivery`/`buyerRestricted`, which `canUserBuy` treats as
   * un-buyable and would hide every product.
   * @param builder - The product builder to enrich
   * @param dom - The parsed product page
   * @param description - The decoded ld+json description, if any
   * @source
   */
  private applyInfoFields(
    builder: ProductBuilder<Product>,
    dom: Document,
    description: string | undefined,
  ): void {
    let formulaSet = false;

    for (const row of Array.from(dom.querySelectorAll('dl.productView-info .line-item-details'))) {
      const name = row.querySelector('.productView-info-name')?.textContent?.trim().toLowerCase();
      const value = row.querySelector('.productView-info-value')?.textContent?.trim();
      if (!name || !value) {
        continue;
      }
      if (name.includes('cas')) {
        builder.setCAS(value);
      } else if (name.includes('molecular formula')) {
        // Format digit runs into subscripts (Na6O18P6 -> Na₆O₁₈P₆).
        builder.setFormula(formatFormula(value));
        formulaSet = true;
      } else if (name.includes('molecular weight')) {
        builder.setMoleweight(value);
      } else if (name.includes('special considerations')) {
        builder.setPurchaseRestriction({ note: value });
      }
    }

    if (!formulaSet && description) {
      const fallback = findFormulaInText(description);
      if (fallback) {
        builder.setFormula(formatFormula(fallback));
      }
    }
  }

  /**
   * Anchors the base product's quantity to its smallest size variant, so the
   * product carries a real quantity/uom. The base price is normally the
   * smallest size's price already (the ld+json `minPrice`), so the variant price
   * is used only as a last resort when no base price could be read.
   * @param builder - The product builder
   * @param variant - The smallest (first) size variant
   * @source
   */
  private anchorBaseVariant(builder: ProductBuilder<Product>, variant: Partial<Variant>): void {
    if (typeof variant.quantity === 'number' && variant.uom !== undefined) {
      builder.setQuantity(variant.quantity, variant.uom);
    }
    if (builder.get('price') === undefined && typeof variant.price === 'number') {
      builder.setPrice(variant.price);
    }
  }

  /**
   * Collects the size-option choices from a product page. ScienceLab renders
   * these in two styles, and a product uses one or the other:
   * - Rectangle/swatch: one `input.form-radio` per size, id
   *   `attribute_rectangle__{attributeId}_{valueId}`, label in the paired
   *   `<label for>`'s `.form-option-variant`.
   * - Dropdown: a `<select name="attribute[{attributeId}]">` with one
   *   `<option value="{valueId}">` per size (the empty "Choose Options"
   *   placeholder is skipped).
   * @param dom - The parsed product page
   * @returns One `{ attributeId, valueId, label }` per size option
   * @example
   * ```typescript
   * this.collectVariantOptions(dom);
   * // [{ attributeId: "1675", valueId: "4125", label: "500g" }, ...]
   * ```
   * @source
   */
  private collectVariantOptions(
    dom: Document,
  ): { attributeId: string; valueId: string; label: string }[] {
    const container = dom.querySelector('div.productView-options');
    if (!container) {
      return [];
    }
    const options: { attributeId: string; valueId: string; label: string }[] = [];

    for (const radio of Array.from(container.querySelectorAll('input.form-radio'))) {
      const id = radio.getAttribute('id') ?? '';
      const idMatch = id.match(/__(\d+)_(\d+)$/);
      const attributeId =
        idMatch?.[1] ?? radio.getAttribute('name')?.match(/attribute\[(\d+)\]/)?.[1];
      const valueId = idMatch?.[2] ?? radio.getAttribute('value')?.trim();
      const label = id
        ? dom.querySelector(`label[for="${id}"] .form-option-variant`)?.textContent?.trim()
        : undefined;
      if (attributeId && valueId && label) {
        options.push({ attributeId, valueId, label });
      }
    }

    for (const select of Array.from(container.querySelectorAll('select'))) {
      const attributeId = select.getAttribute('name')?.match(/attribute\[(\d+)\]/)?.[1];
      if (!attributeId) {
        continue;
      }
      for (const option of Array.from(select.querySelectorAll('option'))) {
        const valueId = option.getAttribute('value')?.trim();
        const label = option.textContent?.trim();
        if (valueId && label) {
          options.push({ attributeId, valueId, label });
        }
      }
    }

    return options;
  }

  /**
   * Parses a product's size variants (radio or dropdown, via
   * {@link collectVariantOptions}) and prices each through the BigCommerce
   * product-attributes endpoint.
   * @param dom - The parsed product page
   * @param productId - The BigCommerce product id (from the og:id meta)
   * @returns The parsed variants (in the page's ascending-size order)
   * @example
   * ```typescript
   * const variants = await this.parseVariants(dom, "1675");
   * // [{ id: "4125", title: "500g", quantity: 500, uom: "g", price: 108 }, ...]
   * ```
   * @source
   */
  private async parseVariants(dom: Document, productId: string): Promise<Partial<Variant>[]> {
    const options = this.collectVariantOptions(dom);
    if (options.length === 0) {
      return [];
    }

    return Promise.all(
      options.map(async ({ attributeId, valueId, label }): Promise<Partial<Variant>> => {
        const qty = parseQuantity(label);
        const price = await this.fetchVariantPrice(productId, attributeId, valueId);
        return {
          id: valueId,
          title: label,
          quantity: qty?.quantity,
          uom: qty?.uom,
          price,
        };
      }),
    );
  }

  /**
   * Prices one size variant via the BigCommerce product-attributes AJAX endpoint
   * (`POST remote/v1/product-attributes/{productId}`), reading the selected
   * combination's `data.price.without_tax.value`.
   * @param productId - The BigCommerce product id
   * @param attributeId - The variant attribute group id
   * @param valueId - The attribute value id for the size to price
   * @returns The variant price, or undefined when the request fails
   * @example
   * ```typescript
   * await this.fetchVariantPrice("1675", "1675", "4126"); // 342
   * ```
   * @source
   */
  private async fetchVariantPrice(
    productId: string,
    attributeId: string,
    valueId: string,
  ): Promise<number | undefined> {
    const body = new URLSearchParams();
    body.set('action', 'add');
    body.set(`attribute[${attributeId}]`, valueId);
    body.set('product_id', productId);
    body.append('qty[]', '1');

    try {
      const response = await this.httpPostJson({
        path: `/remote/v1/product-attributes/${productId}`,
        body: body.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'stencil-utils',
        },
      });

      if (!isScienceLabAttributeResponse(response)) {
        this.logger.warn('Invalid variant response', { productId, attributeId, valueId });
        return undefined;
      }

      const value = response.data?.price?.without_tax?.value;
      return typeof value === 'number' ? value : undefined;
    } catch (error) {
      this.logger.warn('Variant price fetch failed', { productId, attributeId, valueId, error });
      return undefined;
    }
  }

  /**
   * Reads a meta tag's `content` by its `property` (default) or `name`
   * attribute.
   * @param dom - The parsed product page
   * @param key - The meta property/name value, e.g. "og:id"
   * @param attr - Which attribute holds `key` ("property" or "name")
   * @returns The trimmed content, or undefined when the tag is absent/empty
   * @example
   * ```typescript
   * this.metaContent(dom, "og:id"); // "1675"
   * ```
   * @source
   */
  private metaContent(
    dom: Document,
    key: string,
    attr: 'property' | 'name' = 'property',
  ): string | undefined {
    const content = dom.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content')?.trim();
    return content ? content : undefined;
  }

  /**
   * Decodes the ld+json Product description, which ScienceLab percent-encodes.
   * @param raw - The raw description value from the ld+json node
   * @returns The decoded description, or undefined when not a string
   * @example
   * ```typescript
   * this.decodeDescription("Sodium%20Hexametaphosphate"); // "Sodium Hexametaphosphate"
   * ```
   * @source
   */
  private decodeDescription(raw: unknown): string | undefined {
    if (typeof raw !== 'string' || raw.length === 0) {
      return undefined;
    }
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
}
