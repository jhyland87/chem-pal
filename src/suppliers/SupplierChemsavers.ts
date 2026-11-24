import { CACHE } from '@/constants/common';
import { HttpStatus } from '@/constants/httpStatus';
import { HttpError, getErrorMessage } from '@/helpers/exceptions';
import { parseQuantity } from '@/helpers/quantity';
import { parseChemicalSpecs, parseGrade, parsePurity } from '@/helpers/science';
import type { ProductLookup, ProductRef } from '@/helpers/productRef';
import { mapDefined } from '@/helpers/utils';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { translateAstToTypesenseFilter } from '@/utils/search-query/translators/translateAstToTypesenseFilter';
import { cstorage } from '@/utils/storage';
import { assertValidSearchResponse } from '@/utils/typeGuards/chemsavers';
import chunk from 'lodash/chunk';
import { SupplierBase } from './SupplierBase';

/**
 * Module used to retrieve products sold on the Chemsavers website.
 *
 * @remarks
 *
 * Chemsavers does have an exposed GraphQL API which can be used to retrieve product data, but
 * an even easier option is to use the Typesense search API which has all of their products
 * listed and is easily searchable.
 * @category Suppliers
 * @source
 */
export class SupplierChemsavers
  extends SupplierBase<ChemsaversProductObject, Product>
  implements ISupplier
{
  // Name of supplier (for display purposes)
  public static readonly supplierName: string = 'Chemsavers';

  // Base URL for HTTP(s) requests
  public static readonly baseURL: string = 'https://www.chemsavers.com';

  // Shipping scope for Chemsavers
  public static readonly shipping: ShippingRange = 'international';

  // The country code of the supplier.
  public static readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = ['amazononly'];

  // Specific products can be refetched by id, so they can be watched for price drops.
  public static readonly supportsPriceAlerts: boolean = true;

  public readonly amazonStoreURL: string = 'https://www.amazon.com/s?rh=p_89%3AChemsavers';

  // The API URL for the Typesense search API.
  protected static readonly apiURL: string = '0ul35zwtpkx14ifhp-1.a1.typesense.net';

  // Override the type of queryResults to use our specific type
  protected queryResults: Array<ChemsaversProductObject> = [];

  // Used to keep track of how many requests have been made to the supplier.
  protected httpRequstCount: number = 0;

  // Default Typesense API key. Used unless a rehydrated key is found in storage
  // (see loadStoredApiKey); replaced and persisted by rehydrateApiKey on a 401.
  protected apiKey: string = 'iPltuzpMbSZEuxT0fjPI0Ct9R1UBETTd';

  // Typesense's filter_by supports &&/||/! so advanced queries are translated
  // server-side instead of using the keyword-only fallback.
  protected readonly supportsNativeAdvancedSearch: boolean = true;

  // The Typesense search response carries every field (including variants), so
  // getProductData is a passthrough — there's no per-product detail fetch to
  // cache. Products are still keyed for exclusions via getUniqueProductKey.
  protected readonly skipProductDetailCache: boolean = true;

  protected static readonly supportsCAS: boolean = true;
  // protected static readonly supportsFormula: boolean = true;
  // protected static readonly supportsSMILES: boolean = true;

  // Products per refresh batch. A grouped product costs its head plus its sizes in one request.
  protected refreshBatchSize: number = 20;

  // Typesense's cap on `per_page`, so the most ids one by-id request can return.
  protected readonly maxIdsPerRequest: number = 250;

  /**
   * Derives the unique product key from a Chemsavers product object: its `id`
   * (the same value passed to `.setID`), stable across query and detail.
   * @param data - The raw Chemsavers product object
   * @returns The product's id
   * @example
   * ```typescript
   * this.getUniqueProductKey(result); // "12345"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: ChemsaversProductObject): string {
    return String(data.id);
  }

  // HTTP headers used as a basis for all queries.
  protected headers: HeadersInit = {
    accept: ['application/json', 'text/plain', '*/*'].join(','),
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'content-type': 'text/plain',
    pragma: 'no-cache',
    priority: 'u=1, i',
  };

  /**
   * Rehydrates the API key for the Typesense search API.
   * @returns Promise resolving to void
   * @source
   * ```typescript
   * await this.rehydrateApiKey();
   * ```
   */
  protected async rehydrateApiKey() {
    this.logger.debug('Rehydrating api key');
    // const fetchParams = {
    //   headers: {
    //     accept: "*/*",
    //     "accept-language": "en-US,en;q=0.8",
    //     "cache-control": "no-cache",
    //     pragma: "no-cache",
    //     priority: "u=1",
    //     "sec-ch-ua": '"Brave";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    //     "sec-ch-ua-mobile": "?0",
    //     "sec-ch-ua-platform": '"macOS"',
    //     "sec-fetch-dest": "script",
    //     "sec-fetch-mode": "no-cors",
    //     "sec-fetch-site": "cross-site",
    //     "sec-fetch-storage-access": "none",
    //     "sec-gpc": "1",
    //   },
    //   referrer: "https://chemsavers.com/",
    //   body: null,
    //   method: "GET",
    //   mode: "cors",
    //   credentials: "include",
    // };

    // Run the cross-origin scrape from the background service worker. Fetching the
    // storefront document from this (side-panel) context trips the extension page's
    // `script-src 'self'` CSP and CORS; the worker has no document/CSP context and
    // returns the response as plain text for the regex below.
    const getHomePageReq = await this.backgroundFetch('https://chemsavers.com/', {
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.8',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
      method: 'GET',
      credentials: 'include',
    });

    this.logger.debug('Fetched home page for API key extraction', { getHomePageReq });

    const getHomePage = await getHomePageReq.text();
    if (!getHomePage) {
      this.logger.warn(`Failed to get content from ${this.baseURL}`);
      return;
    }

    const scriptSrcPattern = new RegExp(
      '<script\\s.*src="(?<src>.*).*"\\sonload="onThemeBundleMain\\(\\)"><\\/script>',
    );

    const scriptSrcMatch = scriptSrcPattern.exec(getHomePage);

    if (!scriptSrcMatch?.groups?.src) {
      this.logger.warn(`Failed to find script src in ${getHomePage}`);
      return;
    }

    const getJsContentReq = await this.backgroundFetch(scriptSrcMatch.groups.src, {
      headers: {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.8',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
      referrer: 'https://chemsavers.com/',
      method: 'GET',
      credentials: 'include',
    });

    const getJsContent = await getJsContentReq?.text();

    if (!getJsContent) {
      this.logger.warn(`Failed to get content from ${scriptSrcMatch.groups.src}`);
      return;
    }

    const apiKeyPattern = new RegExp('{server:{apiKey:"(?<apiKey>[a-zA-Z0-9]+)",');
    const apiKeyMatch = apiKeyPattern.exec(getJsContent);

    if (!apiKeyMatch?.groups?.apiKey) {
      this.logger.warn(`Failed to find api key js bundle`, {
        getJsContent,
        apiKeyMatch,
        apiKeyPattern,
      });
      return;
    }

    if (this.apiKey === apiKeyMatch.groups.apiKey) {
      this.logger.debug('API key is already rehydrated', { apiKey: this.apiKey });
      return;
    }

    this.apiKey = apiKeyMatch.groups.apiKey;
    // Persist the working key so future searches/sessions skip the scrape.
    await this.storeApiKey(this.apiKey);
  }

  /**
   * Executes a product search query and returns matching products
   * @param query - Search term to look for
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to array of product objects or void if search fails
   * @example
   * ```typescript
   * const products = await this.queryProducts("acid");
   * if (products) {
   *   products.forEach(product => {
   *     console.log(product.title, product.price);
   *   });
   * }
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const body = this.makeRequestBody(query);
    const searchRequest = await this.searchWithKeyRefresh(body, true);
    if (searchRequest === undefined) return;

    try {
      this.logger.debug('Received search response', { searchRequest });

      assertValidSearchResponse(searchRequest);

      const products = searchRequest.results[0].hits
        .flat()
        .map((hit) => hit.document)
        .filter((product) => this.isInStock(product));

      this.logger.debug('Mapped search hits to products', { products });

      const fuzzResults = this.fuzzyFilterAst<ChemsaversProductObject>(products);

      this.logger.debug('Applied fuzzy filter to products', {
        query,
        searchRequest,
        products,
        fuzzResults,
      });
      const grouped = this.groupVariants<ChemsaversProductObject>(fuzzResults);
      // Initialize product builders from filtered results
      return this.initProductBuilders(grouped.slice(0, limit));
    } catch (error) {
      this.logger.error(`Error querying products: ${getErrorMessage(error)}`, { error });
      return;
    }
  }

  /**
   * Refetches products by id in one Typesense request per 250 ids. A grouped product is rebuilt
   * from the ref's own head and sizes rather than regrouped, so a fuzzy regroup can't pick another
   * head.
   * @param refs - The products to refetch
   * @returns The builders found; a head that is gone or out of stock is left out, a missing size
   * is just dropped, and a head that no longer parses is `failed`
   * @throws Error when a request fails or returns an invalid response
   * @example
   * ```typescript
   * const { builders } = await this.queryProductsById(refs);
   * ```
   * @source
   */
  protected override async queryProductsById(
    refs: readonly ProductRef[],
  ): Promise<ProductLookup<Product>> {
    const ids = new Set(refs.flatMap((ref) => this.refIds(ref)));
    const documents = new Map<string, ChemsaversProductObject>();
    for (const batch of chunk([...ids], this.maxIdsPerRequest)) {
      const response = await this.searchWithKeyRefresh(this.makeIdsRequestBody(batch), false);
      assertValidSearchResponse(response);
      for (const hit of response.results[0].hits.flat()) {
        documents.set(String(hit.document.id), hit.document);
      }
    }

    const heads: ChemsaversProductObject[] = [];
    for (const ref of refs) {
      const head = documents.get(ref.cacheKey);
      if (!head || !this.isInStock(head)) continue;
      const sizes = mapDefined(ref.variants, ({ id }) => documents.get(String(id)));
      heads.push({ ...head, variants: sizes.filter((size) => this.isInStock(size)) });
    }

    const builders = this.initProductBuilders(heads);
    const found = new Set(builders.map((builder) => builder.get('cacheKey')));
    const failed = new Set(
      heads.map((head) => this.getUniqueProductKey(head)).filter((key) => !found.has(key)),
    );
    return { builders, failed };
  }

  /**
   * Lists the ids to request for a product: its head and every size it had when it was saved.
   * @param ref - The product reference
   * @returns The head's id followed by its sizes' ids
   * @example
   * ```typescript
   * this.refIds({ cacheKey: '49171', variants: [{ id: '49170' }] }); // ['49171', '49170']
   * ```
   * @source
   */
  private refIds(ref: ProductRef): string[] {
    return [ref.cacheKey, ...mapDefined(ref.variants, ({ id }) => id)].map(String);
  }

  /**
   * Whether a product can be bought: in stock, or untracked (BigCommerce reports
   * inventory_tracking "none" with inventoryLevel 0, but those are always purchasable).
   * @param product - A product or size from the search response
   * @returns `true` when it can be bought
   * @example
   * ```typescript
   * this.isInStock({ inventory_tracking: 'none', inventoryLevel: 0 }); // true
   * ```
   * @source
   */
  private isInStock(product: ChemsaversProductVariant): boolean {
    return product.inventory_tracking === 'none' || product.inventoryLevel > 0;
  }

  /**
   * Runs a Typesense search with the stored API key, rehydrating the key once on a 401. A second
   * 401, or any failure of the retry, propagates.
   * @param body - The Typesense multi-search request body
   * @param swallowErrors - Log and return `undefined` for a non-401 first failure instead of throwing
   * @returns The raw (unvalidated) response, or `undefined` when swallowed
   * @example
   * ```typescript
   * const raw = await this.searchWithKeyRefresh(this.makeRequestBody('acid'), true);
   * ```
   * @source
   */
  private async searchWithKeyRefresh(body: object, swallowErrors: boolean): Promise<unknown> {
    // Prefer a previously rehydrated key from storage; fall back to the hardcoded default.
    await this.loadStoredApiKey();
    try {
      // The key is only rehydrated when the server rejects it, avoiding the scrape on every search.
      return await this.searchTypesense(body);
    } catch (error) {
      if (!this.isUnauthorized(error)) {
        if (!swallowErrors) throw error;
        this.logger.error(`Error querying products: ${getErrorMessage(error)}`, { error });
        return undefined;
      }
      this.logger.warn('Search returned 401; rehydrating API key and retrying');
      await this.clearStoredApiKey();
      await this.rehydrateApiKey();
      return this.searchTypesense(body);
    }
  }

  /**
   * Performs a single Typesense `/multi_search` request with the current API key.
   * @param body - The Typesense multi-search request body from {@link makeRequestBody}.
   * @returns Promise resolving to the raw (unvalidated) search response.
   * @throws HttpError with `status` 401 when the API key is rejected.
   * @example
   * ```typescript
   * const raw = await this.searchTypesense(this.makeRequestBody("acid"));
   * ```
   * @source
   */
  private async searchTypesense(body: object): Promise<unknown> {
    return this.httpPostJson({
      path: `/multi_search`,
      host: this.apiURL,
      params: {
        'x-typesense-api-key': this.apiKey,
      },
      body,
    });
  }

  /**
   * Whether an error is an HTTP `401 Unauthorized` — the signal that the Typesense API
   * key is stale and should be rehydrated.
   * @param error - The value thrown by {@link searchTypesense}.
   * @returns `true` when the error is an {@link HttpError} with `status` 401.
   * @example
   * ```typescript
   * this.isUnauthorized(new HttpError(401, "Unauthorized")); // => true
   * this.isUnauthorized(new HttpError(500, "Server Error")); // => false
   * ```
   * @source
   */
  private isUnauthorized(error: unknown): boolean {
    return error instanceof HttpError && error.status === HttpStatus.UNAUTHORIZED;
  }

  /**
   * Loads a previously rehydrated API key from storage and adopts it, overriding the
   * hardcoded default. No-op when nothing is stored, so the default key is used.
   * @returns Promise resolving once the key (if any) has been adopted.
   * @example
   * ```typescript
   * await this.loadStoredApiKey(); // this.apiKey now reflects the stored key if present
   * ```
   * @source
   */
  private async loadStoredApiKey(): Promise<void> {
    try {
      const stored = await cstorage.local.get([CACHE.CHEMSAVERS_API_KEY]);
      const key: unknown = stored[CACHE.CHEMSAVERS_API_KEY];
      if (typeof key === 'string' && key.length > 0) {
        this.apiKey = key;
      }
    } catch (error) {
      this.logger.warn(`Failed to read stored API key: ${getErrorMessage(error)}`, { error });
    }
  }

  /**
   * Persists a working API key to storage so future searches and sessions can reuse it
   * without re-scraping the storefront.
   * @param key - The validated API key to store.
   * @returns Promise resolving once the key has been written.
   * @example
   * ```typescript
   * await this.storeApiKey("abc123");
   * ```
   * @source
   */
  private async storeApiKey(key: string): Promise<void> {
    try {
      await cstorage.local.set({ [CACHE.CHEMSAVERS_API_KEY]: key });
    } catch (error) {
      this.logger.warn(`Failed to persist API key: ${getErrorMessage(error)}`, { error });
    }
  }

  /**
   * Removes the stored API key after it has been rejected, so the next session falls
   * back to the hardcoded default rather than reusing a dead key.
   * @returns Promise resolving once the key has been removed.
   * @example
   * ```typescript
   * await this.clearStoredApiKey();
   * ```
   * @source
   */
  private async clearStoredApiKey(): Promise<void> {
    try {
      await cstorage.local.remove(CACHE.CHEMSAVERS_API_KEY);
    } catch (error) {
      this.logger.warn(`Failed to remove stored API key: ${getErrorMessage(error)}`, { error });
    }
  }

  /**
   * Initialize product builders from Chemsavers search response data.
   * Transforms product listings into ProductBuilder instances, handling:
   * - Basic product information (title, URL, supplier)
   * - Product descriptions and specifications
   * - Product IDs and SKUs
   * - Pricing information with currency details
   * - CAS number extraction from product text
   * - Quantity parsing from product names and descriptions
   * - Grade/purity level extraction
   * - Product categories and classifications
   *
   * @param data - Array of product listings from search results
   * @returns Array of ProductBuilder instances initialized with product data
   * @example
   * ```typescript
   * const results = await this.queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this.initProductBuilders(results);
   *   // Each builder contains parsed product data
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price, product.grade);
   *   }
   * }
   * ```
   * @source
   */
  protected initProductBuilders(data: ChemsaversProductObject[]): ProductBuilder<Product>[] {
    return mapDefined(data, (result) => {
      const builder = new ProductBuilder<Product>(this.baseURL);

      const quantity = parseQuantity(result.name);
      if (quantity === undefined) return;

      // Purity sits in the title (e.g. "...99.999% - 50 G"); the formula is labelled in
      // the description ("... | Formula: Na2O2 | ..."). Both setters guard internally.
      const specs = parseChemicalSpecs(result.description);
      const image = result.images?.find((img) => img.isThumbnail) ?? result.images?.[0];

      builder
        .setBasicInfo(result.name, result.url, this.supplierName)
        .setDescription(result.description)
        .setMatchPercentage(result.matchPercentage)
        .setID(result.id)
        .setCacheKey(this.getUniqueProductKey(result))
        .setSku(result.sku)
        .setPricing(this.currentPrice(result), 'USD', '$')
        .setQuantity(quantity.quantity, quantity.uom)
        .setCAS(result.CAS)
        .setPurity(parsePurity(result.name))
        .setGrade(parseGrade(result.name))
        .setFormula(specs.formula)
        .setImage(image?.urlStandard)
        .setThumbnail(image?.urlThumbnail);

      if (result.variants) {
        builder.setVariants(
          mapDefined(result.variants, (variant: ChemsaversProductVariant) => {
            const quantity = parseQuantity(variant.name);
            if (quantity === undefined) return;
            return {
              id: variant.id,
              sku: variant.sku,
              title: variant.name,
              price: this.currentPrice(variant),
              url: variant.url,
              ...quantity,
            };
          }),
        );
      }

      return builder;
    });
  }

  /**
   * Reads what a customer pays today: the sale price when one is set (Chemsavers reports `0` when
   * there is none), otherwise the list price.
   * @param item - A product or variant from the search response
   * @returns The current price in USD
   * @example
   * ```typescript
   * this.currentPrice({ price: 50, salePrice: 40 }); // 40
   * this.currentPrice({ price: 50, salePrice: 0 }); // 50
   * ```
   * @source
   */
  private currentPrice(item: { price: number; salePrice?: number }): number {
    return item.salePrice !== undefined && item.salePrice > 0 ? item.salePrice : item.price;
  }

  /**
   * Creates the request body for the Typesense search API.
   *
   * Constructs a search request object that:
   * - Searches across name, CAS, and SKU fields
   * - Highlights matches in these fields
   * - Returns paginated results based on the specified limit
   * - Uses the 'products' collection
   *
   * @param query - The search term to look for in the product database
   * @param limit - Maximum number of results to return (defaults to this.limit)
   * @returns An object containing the search configuration for the Typesense API
   * @source
   */
  protected makeRequestBody(query: string, limit: number = 100): object {
    const parsed = this.getAst();
    // For an advanced query, let Typesense's filter_by do the boolean matching
    // over `name` and return everything else via the `*` wildcard query.
    const search = parsed.isAdvanced
      ? { q: '*', filter_by: translateAstToTypesenseFilter(parsed.ast) }
      : { q: query };

    return {
      searches: [
        {
          query_by: 'name, CAS, sku',
          highlight_full_fields: 'name, CAS, sku',
          collection: 'products',
          ...search,
          page: 0,
          per_page: limit,
        },
      ],
    };
  }

  /**
   * Creates the request body that fetches products by id, with no text query.
   * @param ids - Product ids, at most {@link maxIdsPerRequest}
   * @returns The Typesense multi-search request body
   * @example
   * ```typescript
   * this.makeIdsRequestBody(['121408', '121409']); // filter_by: 'id:[`121408`,`121409`]'
   * ```
   * @source
   */
  protected makeIdsRequestBody(ids: readonly string[]): object {
    return {
      searches: [
        {
          collection: 'products',
          q: '*',
          filter_by: `id:[${ids.map((id) => `\`${id}\``).join(',')}]`,
          page: 0,
          per_page: ids.length,
        },
      ],
    };
  }

  /**
   * Transforms a Laboratorium Discounter product into the common Product type
   * Extracts quantity information from various product fields and normalizes the data
   * @param product - Product object from Laboratorium Discounter
   * @returns Promise resolving to a partial Product object or void if invalid
   * @example
   * ```typescript
   * const products = await this.queryProducts("acid");
   * if (products) {
   *   const product = await this.getProductData(products[0]);
   *   if (product) {
   *     console.log(product.title, product.price, product.quantity, product.uom);
   *   }
   * }
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    // Since Chemsavers includes all product data in search results,
    // we can just return the product builder directly
    return this.getProductDataWithCache(product, async (builder) => builder);
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns - The title of the product
   * @source
   */
  protected titleSelector(data: ChemsaversProductObject): string {
    return data.name;
  }
}
