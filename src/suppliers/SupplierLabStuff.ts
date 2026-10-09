import { AVAILABILITY, UOM } from '@/constants/common';
import { findCAS } from '@/helpers/cas';
import { parseQuantity, toMetricQuantity } from '@/helpers/quantity';
import { getLocalizedNames } from '@/helpers/wikidata';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { isCAS, isPopulatedObject } from '@/utils/typeGuards/common';
import { SupplierBase } from './SupplierBase';
import { getErrorMessage } from '@/helpers/exceptions';

/**
 * One product parsed from a LabStuff search response: the title from the result markup joined
 * with the price/stock/category data from the inline `pEx['Pnnn']` script.
 * @source
 */
interface LabStuffRow {
  /** ShopFactory product id, e.g. `P5876`. */
  id: string;
  /** Product title, e.g. `Benzanilide, 50 gram`. */
  title: string;
  /** Price including VAT, in EUR. */
  price: number;
  /** Units in stock; undefined when the code field is missing or non-numeric. */
  stock?: number;
  /** Category path as `Top|Sub|`, e.g. `Chemicalien|Chemicalien A-B|`. */
  category: string;
  /** Brand/vendor name, when set. */
  manufacturer?: string;
}

/**
 * One selectable option (size/strength) of a product, from the category page's option list.
 * @source
 */
interface ProductOption {
  /** Option id, e.g. `P5274O1C4`. */
  id: string;
  /** Label shown in the option drop-down, e.g. `10%, 2.5 Liter`. */
  label: string;
  /** Surcharge over the base price, ex-VAT. */
  surcharge: number;
  /** Option SKU. */
  sku?: string;
}

/**
 * The parts of a product's block on a category page that the search response lacks or
 * has stale.
 * @source
 */
interface ProductPage {
  /** Current price including VAT (the page's JSON-LD price), for the base option. */
  price?: number;
  /** Plain-text description/introduction. */
  description?: string;
  /** Plain-text content used to look for a CAS number. */
  text: string;
  /** Product SKU. */
  sku?: string;
  /** Size/strength options; empty for a product with a single size. */
  options: ProductOption[];
}

/**
 * A resolved ShopFactory department reference: the department number and, when the product
 * sits beyond the first page of the department listing, the two-digit page suffix.
 * @source
 */
interface DepartmentRef {
  dept: number;
  page?: string;
}

/**
 * Supplier implementation for LabStuff (labstuff.nl), a Dutch laboratory and hobby-chemistry shop
 * built on ShopFactory.
 *
 * @remarks
 * ShopFactory has no public API, and its pages render prices client-side. Two sources are used:
 * - `contents/phpsearch/search.php` finds the products. A large `limitResultsPerPage` returns
 *   every match in one response, so there is no pagination. Its title is in `h3.ProductTitle`
 *   and an inline `pEx['Pnnn']={prc, code}` script has stock (code index 4), brand (12) and the
 *   category path (15). Only the `Chemicalien` category is kept. Its price is a stale copy,
 *   so it is only a fallback.
 * - The department listing page the product links to (see below) is fetched in the detail
 *   phase for the real price (JSON-LD, VAT-inclusive), the description/CAS, and the option list
 *   (sizes with ex-VAT surcharges), which become variants.
 *
 * A product's link is the department listing page it sits on plus a `#pNNN` anchor. The site's
 * `linkTo()` finds that page through two static lookup files, which are mirrored here:
 * - `/contents/prpgmap/prmap_<floor(id/2000)>.js` maps a product number to `dept` or `dept_page`;
 * - `/contents/prpgmap/pgmap_<floor(dept/2000)>.js` maps a department number to its URL slug.
 *
 * The shop only indexes Dutch names, so the query is also searched under its Dutch name from
 * Wikidata (see {@link getLocalizedNames}), and the raw CAS number is searched too, which matches
 * products whose page text carries a CAS number.
 *
 * @category Suppliers
 * @example
 * ```typescript
 * const supplier = new SupplierLabStuff("hydrochloric acid", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log(product.title, product.price, product.url);
 * }
 * ```
 * @source
 */
export class SupplierLabStuff extends SupplierBase<Partial<Product>, Product> implements ISupplier {
  // Display name of the supplier used for UI and logging
  public static readonly supplierName: string = 'LabStuff';

  // Base URL for all requests to LabStuff
  public static readonly baseURL: string = 'https://www.labstuff.nl';

  // Shipping scope for LabStuff
  public static readonly shipping: ShippingRange = 'international';

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = ['other'];

  // The country code of the supplier.
  public static readonly country: CountryCode = 'NL';

  // Language the shop's product names are written in.
  protected readonly storeLanguage: string = 'nl';

  // Results requested per search; large enough that the shop returns every match in one page.
  protected readonly searchResultsLimit: number = 500;

  // Most search requests (Dutch names, CAS, English name) run for one query.
  protected readonly maxSearchTerms: number = 3;

  // Top-level category that holds the chemicals; every other category is ignored.
  protected readonly chemicalCategory: string = 'Chemicalien';

  // Department numbers of the chemicals listing (A-B, C-D, E-J, K-M, N-R, S-Z); preferred when a
  // product is listed in several departments.
  protected readonly chemicalDepartments: readonly number[] = [215, 101, 117, 102, 122, 162];

  // VAT multiplier (21%) for converting the ex-VAT option surcharges to the VAT-inclusive prices.
  protected readonly vatFactor: number = 1.21;

  // Category listing pages already fetched (or being fetched) by URL; a failed fetch is undefined.
  protected readonly categoryPages: Map<string, Promise<string | undefined>> = new Map();

  // Parsed prmap/pgmap lookup files by file name; a failed fetch is stored as undefined.
  protected readonly pageMaps: Map<string, Promise<Record<string, unknown> | undefined>> =
    new Map();

  /**
   * Derives the unique product key from a parsed LabStuff row: its ShopFactory product id.
   * @param data - The parsed search row
   * @returns The product id, e.g. `P5876`
   * @example
   * ```typescript
   * this.getUniqueProductKey(row); // "P5876"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: LabStuffRow): string {
    return data.id;
  }

  /**
   * Returns a parsed row's title, the text the fuzzy filter scores against.
   * @param data - The parsed search row
   * @returns The product title
   * @example
   * ```typescript
   * this.titleSelector(row); // "Benzanilide, 50 gram"
   * ```
   * @source
   */
  protected titleSelector(data: LabStuffRow): string {
    return data.title;
  }

  /**
   * Builds the ordered list of terms to search the shop for. The shop matches Dutch names (and
   * any CAS number printed on a product page), so a query yields its Dutch names from Wikidata
   * first, then the raw CAS number if the query is one, then the English name. The Dutch names
   * are also registered as match candidates so Dutch titles score against them.
   * @param query - The search term being run
   * @returns Distinct terms, capped at `labstuff.maxSearchTerms`
   * @example
   * ```typescript
   * await this.buildSearchTerms("7647-01-0");
   * // Returns: ["zoutzuur", "7647-01-0", "hydrochloric acid"]
   * ```
   * @source
   */
  protected async buildSearchTerms(query: string): Promise<string[]> {
    const raw = query.trim();
    const english = query === this.query ? this.effectiveQuery.trim() : raw;

    let dutch = (await getLocalizedNames(isCAS(raw) ? raw : english, this.storeLanguage)) ?? [];
    if (dutch.length === 0 && isCAS(raw) && english !== raw) {
      dutch = (await getLocalizedNames(english, this.storeLanguage)) ?? [];
    }
    if (query === this.query) {
      this.setExtraQueryCandidates(dutch);
    }

    const terms = [...dutch];
    if (isCAS(raw) || raw === english) {
      terms.push(raw);
    }
    terms.push(english);

    const seen = new Set<string>();
    return terms
      .filter((term) => {
        const key = term.toLowerCase();
        if (term === '' || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, this.maxSearchTerms);
  }

  /**
   * Queries LabStuff for a search string. Runs one search request per term from
   * {@link buildSearchTerms}, merges the rows by product id, drops everything outside the
   * chemical category, fuzzy-filters the rest, and resolves each product's link.
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to return
   * @returns Product builders, or undefined when no search request succeeded
   * @example
   * ```typescript
   * const supplier = new SupplierLabStuff("zoutzuur", 5, new AbortController());
   * const builders = await supplier.queryProducts("zoutzuur", 5);
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    this.logger.log('Starting product search', { query, limit });

    const rows = new Map<string, LabStuffRow>();
    let anyResponse = false;
    for (const term of await this.buildSearchTerms(query)) {
      const html = await this.httpGetHtml({
        path: '/contents/phpsearch/search.php',
        params: {
          searchphrase: term,
          start_page: 1,
          searchFormSortBy: 'R-A',
          searchFormRootUse: 'A',
          lang: this.storeLanguage,
          filterproc: 'filtersearch',
          fmt: 'html',
          searchFormDisplayStyle: 'L',
          design: 'sfx-372_1',
          limitResultsPerPage: this.searchResultsLimit,
          searchtermEnabled: 0,
          pagereset: 1,
        },
      });
      if (!html) {
        continue;
      }
      anyResponse = true;
      for (const row of this.parseSearchRows(html)) {
        if (this.isChemicalCategory(row.category) && !rows.has(row.id)) {
          rows.set(row.id, row);
        }
      }
    }

    if (!anyResponse) {
      this.logger.error('No search response', { query });
      return;
    }

    const matches = this.fuzzyFilterAst(Array.from(rows.values()));
    return this.initProductBuilders(matches.slice(0, limit));
  }

  /**
   * Whether a row's category path is in LabStuff's chemicals tree.
   * @param category - Category path, e.g. `Chemicalien|Chemicalien A-B|`
   * @returns True when the top-level category is the configured chemical category
   * @example
   * ```typescript
   * this.isChemicalCategory("Chemicalien|Chemicalien A-B|"); // true
   * this.isChemicalCategory("Flessen, Potten|"); // false
   * ```
   * @source
   */
  protected isChemicalCategory(category: string): boolean {
    return category.split('|')[0].trim() === this.chemicalCategory;
  }

  /**
   * Parses a search response into rows by joining each product's title (from the markup) with
   * its price, stock and category (from the inline `pEx` script, read by regex, never executed).
   * Products missing either half are skipped.
   * @param html - The `search.php` response body
   * @returns The parsed rows, in page order
   * @example
   * ```typescript
   * this.parseSearchRows(html);
   * // Returns: [{ id: "P5876", title: "Benzanilide, 50 gram", price: 28.86, stock: 100,
   * //             category: "Chemicalien|Chemicalien A-B|" }]
   * ```
   * @source
   */
  protected parseSearchRows(html: string): LabStuffRow[] {
    const priceData = new Map<string, { price: number; code: string[] }>();
    for (const match of html.matchAll(/pEx\['(P\d+)'\]=\{prc:\s*([\d.]+),\s*code:'([^']*)'/g)) {
      priceData.set(match[1], { price: Number(match[2]), code: match[3].split('~') });
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows: LabStuffRow[] = [];
    for (const element of doc.querySelectorAll('div.Product[id^="Product-P"]')) {
      const id = element.id.replace('Product-', '');
      const title = element.querySelector('.ProductTitle')?.textContent?.trim();
      const data = priceData.get(id);
      if (!title || !data || !Number.isFinite(data.price)) {
        continue;
      }
      const stock = Number(data.code[4]);
      rows.push({
        id,
        title,
        price: data.price,
        stock: data.code[4] === undefined || Number.isNaN(stock) ? undefined : stock,
        category: data.code[15] ?? '',
        manufacturer: data.code[12] || undefined,
      });
    }
    return rows;
  }

  /**
   * Turns parsed rows into product builders, resolving each product's link.
   * @param rows - Rows that passed the category and fuzzy filters
   * @returns One builder per row
   * @example
   * ```typescript
   * const builders = await this.initProductBuilders(rows);
   * ```
   * @source
   */
  protected async initProductBuilders(rows: LabStuffRow[]): Promise<ProductBuilder<Product>[]> {
    return Promise.all(
      rows.map(async (row) => {
        const url = await this.getProductUrl(row.id, row.title);
        const builder = new ProductBuilder<Product>(this.baseURL)
          .setBasicInfo(row.title, url, this.supplierName)
          .setMatchPercentage(this.matchScoreOf(row))
          .setID(row.id)
          .setCacheKey(this.getUniqueProductKey(row))
          .setPricing(row.price, 'EUR', '€')
          .setAvailability(
            row.stock !== undefined && row.stock <= 0
              ? AVAILABILITY.OUT_OF_STOCK
              : AVAILABILITY.IN_STOCK,
          )
          .setManufacturer(row.manufacturer);

        const quantity = parseQuantity(row.title);
        if (quantity) {
          const metric = toMetricQuantity(quantity);
          builder.setQuantity(metric.quantity, metric.uom);
        }
        return builder;
      }),
    );
  }

  /**
   * Enriches a product from its category page. The search response's price can lag the real
   * one and has no sizes, while the category page carries the current price (JSON-LD), the
   * description and the option list. Sizes become variants; the first option is the
   * primary quantity. If the page can't be fetched, the search-phase data is kept.
   * @param product - The product builder from the search phase
   * @returns The enriched builder, or undefined when the user has excluded the product
   * @example
   * ```typescript
   * const builder = await this.getProductData(product);
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    if (this.isExcluded(product)) {
      return undefined;
    }
    return this.getProductDataWithCache(product, async (builder) => {
      const id = String(builder.get('id') ?? '');
      const url = String(builder.get('url') ?? '');
      const pagePath = url.split('#')[0];
      if (id === '' || !url.includes('#')) {
        return this.ensureQuantity(builder);
      }

      const html = await this.getCategoryPage(pagePath);
      const page = html ? this.parseProductPage(html, id) : undefined;
      if (page) {
        this.applyProductPage(builder, page);
      }
      return this.ensureQuantity(builder);
    });
  }

  /**
   * Fetches a category listing page once per supplier instance, so every product on the same
   * page shares one request.
   * @param path - The page URL without its `#anchor`
   * @returns The page HTML, or undefined when the request failed
   * @example
   * ```typescript
   * await this.getCategoryPage("https://www.labstuff.nl/contents/nl/d162_02.html");
   * ```
   * @source
   */
  protected getCategoryPage(path: string): Promise<string | undefined> {
    const existing = this.categoryPages.get(path);
    if (existing) {
      return existing;
    }
    const pending = (async () => {
      try {
        return (await this.httpGetHtml({ path })) ?? undefined;
      } catch (error) {
        this.logger.warn(`Category page fetch failed: ${getErrorMessage(error)}`, { path, error });
        return undefined;
      }
    })();
    this.categoryPages.set(path, pending);
    return pending;
  }

  /**
   * Extracts one product's block from a category page: the JSON-LD price (VAT-inclusive),
   * description, SKU and the size/strength option list.
   * @param html - The category page HTML
   * @param id - ShopFactory product id, e.g. `P5274`
   * @returns The parsed page data, or undefined when the product isn't on the page
   * @example
   * ```typescript
   * this.parseProductPage(html, "P5274");
   * // Returns: { price: 22.45, sku: "4328.1", options: [{ id: "P5274O1C4", label: "5%, 1 Liter", surcharge: 0 }, ...], ... }
   * ```
   * @source
   */
  protected parseProductPage(html: string, id: string): ProductPage | undefined {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const block = doc.getElementById(`Product-${id}`);
    if (!block) {
      return undefined;
    }

    let price: number | undefined;
    let sku: string | undefined;
    try {
      const ld: unknown = JSON.parse(
        block.querySelector('script[type="application/ld+json"]')?.textContent ?? '',
      );
      const offers = Array.isArray(ld) && isPopulatedObject(ld[0]) ? ld[0].offers : undefined;
      if (isPopulatedObject(offers) && Number.isFinite(Number(offers.price))) {
        price = Number(offers.price);
      }
      if (Array.isArray(ld) && isPopulatedObject(ld[0]) && typeof ld[0].sku === 'string') {
        sku = ld[0].sku;
      }
    } catch (error) {
      this.logger.warn(`Product JSON-LD parse failed: ${getErrorMessage(error)}`, { id, error });
    }

    const optionScript = block.querySelector(`#ProductOptions-${id} script`)?.textContent ?? '';
    const optionPattern = new RegExp(
      `\\['${id}O\\d+','((?:[^'\\\\]|\\\\.)*)','(${id}O\\d+C\\d+)','([\\d.]+)','[\\d.]*','((?:[^'\\\\]|\\\\.)*)'`,
      'g',
    );
    const options = Array.from(optionScript.matchAll(optionPattern), (match) => ({
      id: match[2],
      label: match[1].replace(/\\(.)/g, '$1'),
      surcharge: Number(match[3]),
      sku: match[4] || undefined,
    }));

    const intro = block.querySelector(`#ProductIntroduction-${id}`)?.textContent ?? '';
    return {
      price,
      sku,
      options,
      description: intro.replace(/\s+/g, ' ').trim() || undefined,
      text: block.textContent ?? '',
    };
  }

  /**
   * Applies category-page data to a builder: the current price, description, SKU and CAS number,
   * plus one variant per size option. The first option is the primary size and price.
   * @param builder - The builder to update
   * @param page - The parsed category-page data
   * @example
   * ```typescript
   * this.applyProductPage(builder, page);
   * ```
   * @source
   */
  protected applyProductPage(builder: ProductBuilder<Product>, page: ProductPage): void {
    builder.setDescription(page.description).setSku(page.sku).setCAS(findCAS(page.text));

    // Option surcharges are ex-VAT while the page price includes VAT.
    const vat = this.vatFactor;
    const priceFor = (option?: ProductOption): number | undefined =>
      page.price === undefined
        ? undefined
        : Math.round((page.price + (option?.surcharge ?? 0) * vat) * 100) / 100;

    const [first, ...rest] = page.options;
    const basePrice = priceFor(first);
    if (basePrice !== undefined) {
      builder.setPricing(basePrice, 'EUR', '€');
    }
    if (!first) {
      return;
    }

    const firstQuantity = parseQuantity(first.label);
    if (firstQuantity) {
      const metric = toMetricQuantity(firstQuantity);
      builder.setQuantity(metric.quantity, metric.uom);
    }
    for (const option of rest) {
      const parsed = parseQuantity(option.label);
      const quantity = parsed ? toMetricQuantity(parsed) : undefined;
      builder.addVariant({
        id: option.id,
        title: option.label,
        sku: option.sku,
        price: priceFor(option),
        currencyCode: 'EUR',
        currencySymbol: '€',
        status: builder.get('availability'),
        ...(quantity ?? { quantity: 1, uom: UOM.EA }),
      });
    }
  }

  /**
   * Gives a product with no parseable size (e.g. "Silicagel") a quantity of one each, since a
   * product without a quantity can't be listed.
   * @param builder - The builder to check
   * @returns The same builder
   * @example
   * ```typescript
   * this.ensureQuantity(builder); // sets quantity 1, uom "ea" when none was found
   * ```
   * @source
   */
  protected ensureQuantity(builder: ProductBuilder<Product>): ProductBuilder<Product> {
    if (builder.get('quantity') === undefined) {
      builder.setQuantity(1, UOM.EA);
    }
    return builder;
  }

  /**
   * Fetches and parses one of the shop's `prpgmap` lookup files, once per supplier instance.
   * @param file - File name, e.g. `prmap_2.js`
   * @returns The parsed lookup, or undefined when the file is missing or unparseable
   * @example
   * ```typescript
   * const prmap = await this.getPageMap("prmap_2.js");
   * prmap?.["5876"]; // "215_03"
   * ```
   * @source
   */
  protected getPageMap(file: string): Promise<Record<string, unknown> | undefined> {
    const existing = this.pageMaps.get(file);
    if (existing) {
      return existing;
    }
    const pending = (async () => {
      try {
        const response = await this.httpGet({ path: `/contents/prpgmap/${file}` });
        return response ? this.parsePageMap(await response.text()) : undefined;
      } catch (error) {
        this.logger.warn(`Page map fetch failed: ${getErrorMessage(error)}`, { file, error });
        return undefined;
      }
    })();
    this.pageMaps.set(file, pending);
    return pending;
  }

  /**
   * Parses a `prpgmap` file, a JS object literal with bare numeric keys, as JSON. Never evaluates it.
   * @param text - The file contents, e.g. `{4001:122,4014:"122_01",4032:[153,"118_01"]}`
   * @returns The parsed object, or undefined when it isn't valid
   * @example
   * ```typescript
   * this.parsePageMap('{4001:122,4014:"122_01"}');
   * // Returns: { "4001": 122, "4014": "122_01" }
   * ```
   * @source
   */
  protected parsePageMap(text: string): Record<string, unknown> | undefined {
    try {
      const parsed: unknown = JSON.parse(text.trim().replace(/([{,])\s*(-?\d+)\s*:/g, '$1"$2":'));
      return isPopulatedObject(parsed) ? parsed : undefined;
    } catch (error) {
      this.logger.warn(`Page map parse failed: ${getErrorMessage(error)}`, { error });
      return undefined;
    }
  }

  /**
   * Picks the department a product should link to. A `prmap` entry is a number, a `dept_page`
   * string, or an array of those when the product is listed in several departments; the
   * shop's own `linkTo()` takes the first, but a chemical department is preferred here.
   * @param value - The raw `prmap` entry
   * @returns The chosen department, or undefined when the entry has no usable department
   * @example
   * ```typescript
   * this.pickDepartment("215_03"); // { dept: 215, page: "03" }
   * this.pickDepartment([153, "215_01"]); // { dept: 215, page: "01" }
   * this.pickDepartment("-36_02"); // undefined
   * ```
   * @source
   */
  protected pickDepartment(value: unknown): DepartmentRef | undefined {
    const refs: DepartmentRef[] = [];
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (typeof entry !== 'number' && typeof entry !== 'string') {
        continue;
      }
      const [deptPart, page] = String(entry).split('_');
      const dept = Number(deptPart);
      if (Number.isInteger(dept) && dept > 0) {
        refs.push({ dept, page });
      }
    }
    return refs.find((ref) => this.chemicalDepartments.includes(ref.dept)) ?? refs[0];
  }

  /**
   * Builds the link a shopper would reach by clicking the product on the site: its department
   * listing page with a `#pNNN` anchor. Falls back to a site search for the title when the
   * lookup files can't place the product.
   * @param id - ShopFactory product id, e.g. `P5876`
   * @param title - Product title, used for the fallback search link
   * @returns An absolute URL
   * @example
   * ```typescript
   * await this.getProductUrl("P5876", "Benzanilide, 50 gram");
   * // "https://www.labstuff.nl/contents/nl/d215_Chemicalien-A-B_03.html#p5876"
   * ```
   * @source
   */
  protected async getProductUrl(id: string, title: string): Promise<string> {
    const fallback = `${this.baseURL}/contents/nl/search.php?searchphrase=${encodeURIComponent(title)}`;
    const num = Number(id.slice(1));
    if (!Number.isInteger(num)) {
      return fallback;
    }

    const prmap = await this.getPageMap(`prmap_${Math.floor(num / 2000)}.js`);
    const ref = this.pickDepartment(prmap?.[String(num)]);
    if (!ref) {
      return fallback;
    }

    const pgmap = await this.getPageMap(`pgmap_${Math.floor(ref.dept / 2000)}.js`);
    const slug = pgmap?.[String(ref.dept)];
    if (typeof slug !== 'string' || (slug !== '' && !slug.startsWith('_'))) {
      return fallback;
    }

    const page = ref.page ? `_${ref.page}` : '';
    return `${this.baseURL}/contents/nl/d${ref.dept}${slug}${page}.html#${id.toLowerCase()}`;
  }
}
