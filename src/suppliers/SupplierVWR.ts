import { AVAILABILITY } from '@/constants/common';
import { parseQuantity } from '@/helpers/quantity';
import { ProductBuilder } from '@/utils/ProductBuilder';
import {
  isVWRAssetReferencesResponse,
  isVWROrdertableResponse,
  isVWRSearchResponse,
  isVWRSpecificationResponse,
  isVWRStockResponse,
  isVWRSubstanceResponse,
  isVWRTokenResponse,
} from '@/utils/typeGuards/vwr';
import { SupplierBase } from './SupplierBase';

/**
 * SupplierVWR - supplier implementation for VWR (Avantor Sciences).
 *
 * @remarks
 * VWR exposes an OCC (SAP Commerce) JSON API behind an OAuth `client_credentials` flow. A search
 * is a two-phase operation: {@link queryProducts} authenticates, runs the product search, and
 * fuzzy-ranks the raw results down to the top-N matches; {@link getProductData} then enriches only
 * those survivors with the ordertable (variants/pricing/SDS), asset references (SDS + COA),
 * chemical substance (CAS/formula/molecular weight), and a single batched stock-availability call.
 * The product image comes from the search response, so no images call is made.
 *
 * @category Suppliers
 * @source
 */
export class SupplierVWR extends SupplierBase<VWRSearchProduct, Product> implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = 'VWR';

  // Base URL for HTTP(s) requests (storefront; used for product links + referrer).
  // Must be www.vwr.com — it's the storefront referrer and the host granted in the manifest.
  public readonly baseURL: string = 'https://www.vwr.com';

  // Bare host for the OCC API (base builds `https://${apiURL}/*` for requiredHosts)
  public readonly apiURL: string = 'occapi.avantorsciences.com';

  // Shipping scope
  public readonly shipping: ShippingRange = 'worldwide';

  // The country code of the supplier.
  public readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  // OAuth client id for the anonymous client_credentials grant.
  private readonly clientId: string = 'VVjdGUHAb3ETZLEVTWtFy3BmhFhXSdBB';

  // Cached bearer token and its absolute expiry (epoch ms).
  private accessToken?: string;
  private accessTokenExpiresAt?: number;

  // Refresh the token this many ms before it actually expires.
  private readonly tokenSafetyMarginMs: number = 30_000;

  // Stop paginating after this many consecutive batches yield nothing post-filter.
  private readonly maxEmptySearchBatches: number = 2;

  // Raise the base per-search HTTP ceiling to accommodate paginated search + per-product detail calls.
  protected readonly httpRequestHardLimit: number = 100;

  // OCC API paths. All except the token endpoint carry the `/occ/v2/us.vwr.com` prefix;
  // `assetReferences` is base-product specific so it's built on demand.
  private readonly paths = {
    token: '/authorizationserver/oauth/token',
    search: '/occ/v2/us.vwr.com/products/search',
    ordertable: '/occ/v2/us.vwr.com/api/product/ordertable',
    substance: '/occ/v2/us.vwr.com/api/product/chemical/substance',
    specification: '/occ/v2/us.vwr.com/api/product/chemical/specification',
    stock: '/occ/v2/us.vwr.com/api/product/getAnonymousStockAvailability',
    canonicalUrl: '/occ/v2/us.vwr.com/canonicalurl',
    assetReferences: (baseProduct: string): string =>
      `/occ/v2/us.vwr.com/products/${baseProduct}/assetreferences`,
  } as const;

  /**
   * Derives the unique product key from a VWR search product: its `code` (the
   * same value passed to `.setID`), stable across the query→detail transition.
   * @param data - The raw VWR search product
   * @returns The product's code
   * @example
   * ```typescript
   * this.getUniqueProductKey(item); // "MFCD00003462"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: VWRSearchProduct): string {
    return String(data.code);
  }

  /**
   * Ensures a valid bearer token is present, fetching a fresh one when it is unset or within the
   * safety margin of expiry. On success the token is cached with its expiry and merged into
   * `this.headers` as an `Authorization` header used by every subsequent request.
   * @returns Promise that resolves once a usable token is in `this.headers`
   * @example
   * ```typescript
   * await this.ensureAccessToken(); // this.headers.Authorization === "bearer <token>"
   * ```
   * @source
   */
  private async ensureAccessToken(): Promise<void> {
    const now = Date.now();
    if (
      this.accessToken &&
      this.accessTokenExpiresAt &&
      now < this.accessTokenExpiresAt - this.tokenSafetyMarginMs
    ) {
      return;
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: '',
      grant_type: 'client_credentials',
    }).toString();

    const response = await this.httpPost({
      path: this.paths.token,
      host: this.apiURL,
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    const tokenData = response ? await response.json() : undefined;
    if (!isVWRTokenResponse(tokenData)) {
      this.logger.error('Invalid VWR token response', { tokenData });
      throw new TypeError('SupplierVWR| Failed to obtain access token');
    }

    this.accessToken = tokenData.access_token;
    this.accessTokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
    this.headers = {
      ...this.headers,
      Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
    };
  }

  /**
   * Lazy per-instance setup hook. Runs once before the first query and obtains the initial token.
   * @returns Promise that resolves once setup is complete
   * @source
   */
  protected async setup(): Promise<void> {
    await this.ensureAccessToken();
  }

  /**
   * Searches VWR for the given query and walks pages until it has `limit` matches. The API caps
   * `pageSize` at 10, so pages are fetched {@link maxConcurrentRequests} at a time in parallel;
   * each page is filtered (discontinued / restricted), fuzzy + AST filtered, and its survivors
   * accumulated. Once a batch completes, another batch is dispatched only if we still need more.
   * Pagination stops once `limit` is reached, the last page is consumed, or
   * {@link maxEmptySearchBatches} consecutive batches produce no survivors (so we don't crawl every
   * page of a broad query).
   * @param query - The search term
   * @param limit - Maximum number of ranked products to return (defaults to the instance limit)
   * @returns Promise resolving to ranked ProductBuilder instances, or void when nothing matched
   * @example
   * ```typescript
   * const builders = await this.queryProducts("sulfuric acid", 20);
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const builders: ProductBuilder<Product>[] = [];
    const batchSize = Math.max(1, this.maxConcurrentRequests);
    // Unknown until the first response reports it; Infinity means "no cap yet".
    let totalPages = Number.POSITIVE_INFINITY;
    let nextPage = 0;
    let emptyStreak = 0;

    while (builders.length < limit) {
      const count = Math.min(batchSize, totalPages - nextPage);
      if (count <= 0) {
        break;
      }
      const pageIndexes = Array.from({ length: count }, (_, i) => nextPage + i);
      nextPage += count;

      const responses = await Promise.all(pageIndexes.map((page) => this.searchPage(query, page)));

      let batchSurvivors = 0;
      for (const response of responses) {
        if (!response) {
          continue;
        }
        if (typeof response.pagination?.totalPages === 'number') {
          totalPages = response.pagination.totalPages;
        }
        // Drop discontinued and restricted (e.g. license-required) products.
        const products = response.products.filter(
          (product) => product.discontinued !== true && product.restricted !== true,
        );
        // fuzzyFilterAst applies both the fuzzy score and the liqe/AST boolean predicate.
        const survivors = this.fuzzyFilterAst<VWRSearchProduct>(products);
        if (survivors.length > 0) {
          builders.push(...this.initProductBuilders(survivors));
          batchSurvivors += survivors.length;
        }
      }

      if (batchSurvivors === 0) {
        emptyStreak += 1;
        if (emptyStreak >= this.maxEmptySearchBatches) {
          this.logger.debug('VWR search: stopping after consecutive empty batches', {
            query,
            nextPage,
            emptyStreak,
          });
          break;
        }
      } else {
        emptyStreak = 0;
      }
    }

    if (builders.length === 0) {
      this.logger.warn('VWR search returned no usable products', { query });
      return;
    }

    return builders.slice(0, limit);
  }

  /**
   * Fetches and validates a single page of VWR search results.
   * @param query - The search term
   * @param page - Zero-based page index (sent as `currentPage`)
   * @returns Promise resolving to the validated search response, or void on failure
   * @source
   */
  private async searchPage(query: string, page: number): Promise<VWRSearchResponse | void> {
    const response = await this.httpPostJson({
      path: this.paths.search,
      host: this.apiURL,
      body: '{}',
      headers: { 'content-type': 'application/json' },
      params: {
        fields: 'FULL',
        // Search via formula: chemical_formula_adv=Na2SO3
        // Search via CAS: cas_number=7757-83-7
        // Search via Keyword: keyword=sodium
        query: `chemical_name=${query}`,
        pageSize: 10,
        currentPage: page,
        lang: 'en_US',
        curr: 'USD',
        newStorefront: true,
      },
    });

    if (!isVWRSearchResponse(response)) {
      this.logger.error('Invalid VWR search response', { response, page });
      return;
    }
    return response;
  }

  /**
   * Builds initial ProductBuilder instances from raw VWR search products. Sets title, price, ids,
   * description and image from the search item, and a synthesized product URL that encodes the
   * `baseProduct` id (used later by {@link getProductData} to fetch detail data).
   * @param results - Raw VWR search products (already ranked/sliced)
   * @returns Array of initialized ProductBuilder instances
   * @example
   * ```typescript
   * const builders = this.initProductBuilders(rankedSearchProducts);
   * ```
   * @source
   */
  protected initProductBuilders(results: VWRSearchProduct[]): ProductBuilder<Product>[] {
    return results.map((item) => {
      const builder = new ProductBuilder<Product>(this.baseURL);
      const title = item.displayName ?? item.name ?? '';
      const price = item.uomSpecificPrices?.[0];

      builder
        .setBasicInfo(title, this.productUrl(item), this.supplierName)
        .setData(this.productDefaults)
        .setID(item.code)
        .setCacheKey(this.getUniqueProductKey(item))
        .setSku(item.vwrCatalogNumber ?? item.code)
        .setDescription(item.description);

      if (price) {
        builder.setPricing(price.value, price.currencyIso ?? 'USD', '$');
      }

      const image = item.images?.find((img) => img.imageType === 'PRIMARY') ?? item.images?.[0];
      if (image) {
        builder.setImage(image.url, title).setThumbnail(image.url);
      }

      return builder;
    });
  }

  /**
   * Selects the title used for fuzzy matching from a raw VWR search product.
   * @param data - Raw VWR search product
   * @returns The product's display title
   * @source
   */
  protected titleSelector(data: VWRSearchProduct): string {
    return data.displayName ?? data.name ?? '';
  }

  /**
   * Enriches a ranked product with detail data. Fetches the ordertable, asset references, chemical
   * substance, chemical specification and canonical URL in parallel, plus one batched
   * stock-availability call, and applies quantity/uom, pricing, CAS/formula/molecular weight,
   * purity, the canonical product link, SDS + COA links, availability and variants.
   * @param product - The ProductBuilder to enrich
   * @returns Promise resolving to the enriched builder, or void on failure
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
      const baseProduct = this.baseProductFromUrl(builder.get('url'));
      if (!baseProduct) {
        this.logger.warn('VWR getProductData| could not derive baseProduct', {
          url: builder.get('url'),
        });
        return builder;
      }

      const commonParams = {
        lang: 'en_US',
        curr: 'USD',
        newStorefront: true,
      };

      const [ordertable, assets, substance, specification, canonicalUrl] = await Promise.all([
        this.httpGetJson({
          path: this.paths.ordertable,
          host: this.apiURL,
          params: { ...commonParams, productId: baseProduct, impressions: '', user: 'anonymous' },
        }),
        this.httpGetJson({
          path: this.paths.assetReferences(baseProduct),
          host: this.apiURL,
          params: { ...commonParams, fields: 'DEFAULT' },
        }),
        this.httpGetJson({
          path: this.paths.substance,
          host: this.apiURL,
          params: { ...commonParams, productId: baseProduct, user: 'anonymous' },
        }),
        this.httpGetJson({
          path: this.paths.specification,
          host: this.apiURL,
          params: { ...commonParams, productId: baseProduct, user: 'anonymous' },
        }),
        this.fetchCanonicalUrl(baseProduct),
      ]);

      if (canonicalUrl) {
        builder.setURL(canonicalUrl).setPermalink(canonicalUrl);
      }
      this.applySubstance(builder, substance);
      this.applySpecification(builder, specification);
      await this.applyOrdertable(builder, ordertable);
      this.applyAssetReferences(builder, ordertable, assets);

      return builder;
    });
  }

  /**
   * Applies chemical substance attributes (CAS, formula, molecular weight) to the builder.
   * @param builder - The ProductBuilder to enrich
   * @param substance - The raw substance response (validated internally)
   * @returns void
   * @source
   */
  private applySubstance(builder: ProductBuilder<Product>, substance: unknown): void {
    if (!isVWRSubstanceResponse(substance)) {
      return;
    }
    const attr = (name: string): string | undefined =>
      substance.substanceAttributes.find((a) => a.code === name || a.name === name)?.value;

    // MW_value may carry a unit suffix (e.g. "79.06 g/mol"); take just the leading number.
    const moleweight = attr('MW_value')?.match(/\d+(?:\.\d+)?/)?.[0];
    builder.setCAS(attr('c_cas')).setFormula(attr('c_formula')).setMoleweight(moleweight);
  }

  /**
   * Applies the product purity from the chemical specification response. Uses the `Purity` row's
   * result (e.g. `"> 98 %"`); `setPurity` extracts the percentage token.
   * @param builder - The ProductBuilder to enrich
   * @param specification - The raw specification response (validated internally)
   * @returns void
   * @source
   */
  private applySpecification(builder: ProductBuilder<Product>, specification: unknown): void {
    if (!isVWRSpecificationResponse(specification)) {
      return;
    }
    const purity = specification.find((entry) => entry.name.toLowerCase() === 'purity')?.result;
    builder.setPurity(purity);
  }

  /**
   * Fetches the canonical (SEO-friendly) product URL, a plain-text absolute href returned by the
   * `canonicalurl` endpoint. Returns undefined when the request fails or the body isn't a URL.
   * @param baseProduct - The base product id
   * @returns Promise resolving to the absolute product URL, or undefined
   * @source
   */
  private async fetchCanonicalUrl(baseProduct: string): Promise<string | undefined> {
    try {
      const response = await this.httpGet({
        path: this.paths.canonicalUrl,
        host: this.apiURL,
        params: {
          pageType: 'product',
          id: baseProduct,
          lang: 'en_US',
          curr: 'USD',
          newStorefront: true,
        },
      });
      if (!response) {
        return undefined;
      }
      const url = (await response.text()).trim();
      return url.startsWith('http') ? url : undefined;
    } catch (error: unknown) {
      this.logger.warn('VWR canonical URL fetch failed', { baseProduct, error });
      return undefined;
    }
  }

  /**
   * Applies ordertable detail (quantity/uom, refined price, availability, variants) to the builder.
   * Picks the row matching the builder's id, falling back to the first row, and fires one batched
   * stock-availability call for all variant catalog numbers.
   * @param builder - The ProductBuilder to enrich
   * @param ordertable - The raw ordertable response (validated internally)
   * @returns Promise that resolves once enrichment is applied
   * @source
   */
  private async applyOrdertable(
    builder: ProductBuilder<Product>,
    ordertable: unknown,
  ): Promise<void> {
    if (!isVWROrdertableResponse(ordertable)) {
      return;
    }
    const rows = ordertable.productRows;
    if (rows.length === 0) {
      return;
    }

    const code = String(builder.get('id') ?? '');
    const matched = rows.find((row) => row.code === code) ?? rows[0];

    const quantity = parseQuantity(this.rowSize(matched) ?? '');
    if (quantity) {
      builder.setQuantity(quantity);
    }

    const price = matched.prices?.[0];
    if (price) {
      builder.setPricing(price.listPrice, price.currencyCode ?? 'USD', '$');
    }

    const stockMap = await this.fetchStock(
      rows.map((row) => row.catalogNumber).filter((num): num is string => Boolean(num)),
    );

    const matchedStock = stockMap.get(matched.catalogNumber);
    if (matchedStock) {
      builder.setAvailability(matchedStock.stockStatus === 'inStock');
      builder.setStatusTxt(matchedStock.availabilityMessage);
    }

    builder.addVariants(
      rows.map((row) => {
        const variantQuantity = parseQuantity(this.rowSize(row) ?? '');
        const stock = stockMap.get(row.catalogNumber);
        const variant: Partial<Variant> = {
          id: row.code,
          sku: row.catalogNumber,
          title: row.name,
          price: row.prices?.[0]?.listPrice,
          ...(variantQuantity ?? {}),
        };
        if (stock) {
          variant.availability =
            stock.stockStatus === 'inStock' ? AVAILABILITY.IN_STOCK : AVAILABILITY.OUT_OF_STOCK;
        }
        return variant;
      }),
    );
  }

  /**
   * Applies SDS and COA document links. SDS prefers an `en_US` MSDS asset and falls back to the
   * matched ordertable row's `downloadSDSLink`; COA uses the first `en_US` certificate-of-analysis.
   * @param builder - The ProductBuilder to enrich
   * @param ordertable - The raw ordertable response (for the SDS fallback link)
   * @param assets - The raw asset-references response (validated internally)
   * @returns void
   * @source
   */
  private applyAssetReferences(
    builder: ProductBuilder<Product>,
    ordertable: unknown,
    assets: unknown,
  ): void {
    const sdsFromAssets = isVWRAssetReferencesResponse(assets)
      ? this.pickAsset(assets.assetReferences, 'MSDS')
      : undefined;
    const coa = isVWRAssetReferencesResponse(assets)
      ? this.pickAsset(assets.assetReferences, 'CERTIFICATE_OF_ANALYSIS')
      : undefined;

    const sdsFallback = isVWROrdertableResponse(ordertable)
      ? (ordertable.productRows.find((row) => row.downloadSDSLink)?.downloadSDSLink ??
        ordertable.downloadSDSLink)
      : undefined;

    builder.setSDSUrl(sdsFromAssets ?? sdsFallback).setCoaUrl(coa);
  }

  /**
   * Picks the URL of the first asset of the given type, preferring an `en_US` localization.
   * @param assetReferences - The asset references to search
   * @param assetType - The asset type to match (e.g. `"MSDS"`, `"CERTIFICATE_OF_ANALYSIS"`)
   * @returns The chosen asset URL, or undefined if none match
   * @source
   */
  private pickAsset(
    assetReferences: VWRAssetReference[],
    assetType: NonNullable<VWRAssetReference['assetType']>,
  ): string | undefined {
    const ofType = assetReferences.filter((asset) => asset.assetType === assetType);
    const preferred = ofType.find((asset) => asset.languageLists?.includes('en_US'));
    return (preferred ?? ofType[0])?.url;
  }

  /**
   * Fetches per-catalog-number stock availability in a single batched request.
   * @param catalogNumbers - The variant catalog numbers to look up
   * @returns Map of catalog number to its availability status/message (empty on failure)
   * @source
   */
  private async fetchStock(
    catalogNumbers: string[],
  ): Promise<Map<string, { stockStatus?: string; availabilityMessage?: string }>> {
    const stockMap = new Map<string, { stockStatus?: string; availabilityMessage?: string }>();
    if (catalogNumbers.length === 0) {
      return stockMap;
    }

    const response = await this.httpPostJson({
      path: this.paths.stock,
      host: this.apiURL,
      body: catalogNumbers.map((catalogNumber) => ({ catalogNumber })),
      headers: { 'content-type': 'application/json' },
      params: {
        fields: 'FULL',
        lang: 'en_US',
        curr: 'USD',
        newStorefront: true,
      },
    });

    if (!isVWRStockResponse(response)) {
      this.logger.warn('Invalid VWR stock response', { response });
      return stockMap;
    }

    for (const detail of response.articleAvailabilityDetails.articleAvailabilityDetail) {
      stockMap.set(detail.catalogNumber, {
        stockStatus: detail.availability.stockStatus,
        availabilityMessage: detail.availability.availabilityMessage,
      });
    }
    return stockMap;
  }

  /**
   * Reads the `o_size` cell (e.g. `"2.5 L"`) from an ordertable row's column map.
   * @param row - The ordertable product row
   * @returns The size string, or undefined if not present
   * @source
   */
  private rowSize(row: VWRProductRow): string | undefined {
    return row.colCellMap?.entry?.find((cell) => cell.key === 'o_size')?.value ?? undefined;
  }

  /**
   * Builds a synthesized, absolute product URL that encodes the `baseProduct` id so it can be
   * recovered during detail enrichment and doubles as the product-detail cache key.
   * @param item - The raw VWR search product
   * @returns A relative product path (resolved to absolute by the builder)
   * @source
   */
  private productUrl(item: VWRSearchProduct): string {
    return `/store/product/${item.baseProduct}/${encodeURIComponent(item.code)}`;
  }

  /**
   * Extracts the `baseProduct` id from a synthesized product URL.
   * @param url - The product URL (absolute or relative)
   * @returns The baseProduct id, or undefined if the URL doesn't match the expected shape
   * @source
   */
  private baseProductFromUrl(url: unknown): string | undefined {
    if (typeof url !== 'string') {
      return undefined;
    }
    return url.match(/\/store\/product\/([^/]+)\//)?.[1];
  }
}
