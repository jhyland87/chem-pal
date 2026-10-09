import { CACHE } from '@/constants/common';
import { findCAS } from '@/helpers/cas';
import { HttpError, getErrorMessage, isExpectedAbort } from '@/helpers/exceptions';
import { parseQuantity } from '@/helpers/quantity';
import { findMolarity, findMolarMass, findPurity } from '@/helpers/science';
import { firstMap } from '@/helpers/utils';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { cstorage } from '@/utils/storage';
import {
  isSearchaniseCredentials,
  isSearchaniseVariant,
  isValidSearchaniseApiObject,
  isValidSearchResponse,
} from '@/utils/typeGuards/searchanise';
import { SupplierBase } from './SupplierBase';

/**
 * Searchanise API hosts a storefront may point at. A scraped or stored host is only used if it is
 * listed here (and in `host_permissions`), since it comes from a third-party page.
 * @source
 */
export const SEARCHANISE_API_HOSTS: readonly string[] = [
  'searchserverapi.com',
  'searchserverapi1.com',
];

/**
 * Searchanise API host used until (or unless) a storefront names an allow-listed one.
 * @source
 */
export const SEARCHANISE_DEFAULT_API_HOST = 'searchserverapi.com';

/**
 * Outcome of one `/getresults` request.
 * - `ok` - The request succeeded; `json` is the parsed (unvalidated) body.
 * - `expired` - Searchanise rejected the api key (`ENGINE_REMOVED` / `INVALID_API_KEY`).
 * - `failed` - Any other failure (already logged).
 */
type ResultsOutcome = { kind: 'ok'; json: unknown } | { kind: 'expired' } | { kind: 'failed' };

/**
 * Base class for Searchanise-based suppliers that provides common functionality for
 * interacting with Searchanise API endpoints.
 *
 * @remarks
 * I'm pretty sure that there's a different API tht could be used, but I noticed that when I started
 * searching for a product in the search bar, all of the Searchanise sites were making a call to a
 * `/getresults` endpoint hosted at `searchserverapi.com`. That domain belongs to
 * {@link https://searchanise.io/ | Searchanise}, who provides tracking data and autocomplete
 * functionality for the search feature on the website. There are quite a few query parameters for
 * that page, but the ones we care about most are:
 * - `api_key` - The API key for the search server, this is unique for each supplier.
 * - `q` - The query to search for.
 * - `maxResults` - The maximum number of results to return.
 *
 * - {@link https://searchserverapi.com/getresults?api_key=8B7o0X1o7c&q=acid&maxResults=3 | Query three "Acid" products from LabAlley}
 *
 *
 * The suppliers using this endpoint need literally no custom code at all. The `api_key` is not
 * hardcoded: Searchanise rotates or removes engines, which breaks a fixed key. Instead it is scraped
 * from the `window.Searchanise` object on the storefront homepage ({@link retrieveCredentials}),
 * cached per supplier in extension storage with no expiry, and only fetched again when it is missing
 * or Searchanise answers `ENGINE_REMOVED` / `INVALID_API_KEY` (see {@link isApiKeyRejected}). A
 * rejected key is dropped and re-scraped once per search.
 * Another possible solution would be the graphql api endpoint, which can be found at
 * `/api/2024-10/graphql.json`. I can use this to query data about specific products, but I don't
 * see that its an more useful than just the searchserveapi results.
 *
 * @category Suppliers
 * @example
 * ```typescript
 * // Crate a new class using the SupplierBaseSearchanise class
 * export default class SupplierFoobar
 *   extends SupplierBaseSearchanise
 *   implements AsyncIterable<Product>
 * {
 *   // Name of supplier (for display purposes)
 *   public static readonly supplierName: string = "Foobar";
 *
 *   // Base URL for HTTP(s) requests. The api key is discovered at runtime.
 *   public static readonly baseURL: string = "https://www.foobar.com";
 * }
 * ```
 * @source
 */
export abstract class SupplierBaseSearchanise
  extends SupplierBase<ItemListing, Product>
  implements ISupplier
{
  // Scraped from the storefront and cached in storage; empty until ensureCredentials() runs.
  protected apiKey: string = '';

  // Hostname requests are sent to; one of SEARCHANISE_API_HOSTS.
  protected apiHost: string = SEARCHANISE_DEFAULT_API_HOST;

  protected static readonly apiURL: string = SEARCHANISE_DEFAULT_API_HOST;

  /**
   * Every Searchanise API host the supplier may be pointed at, on top of the storefront itself, so
   * the permission check covers whichever host the storefront names.
   * @returns Origin patterns for the storefront and each allow-listed Searchanise API host
   * @example
   * ```typescript
   * SupplierLaballey.requiredHosts;
   * // ['https://www.laballey.com/*', 'https://searchserverapi.com/*', 'https://searchserverapi1.com/*']
   * ```
   * @source
   */
  public static get requiredHosts(): string[] {
    const apiHosts = SEARCHANISE_API_HOSTS.map((host) => `https://${host}/*`);
    return [...new Set([...super.requiredHosts, ...apiHosts])];
  }

  /**
   * Derives the unique product key from a Searchanise item listing: its
   * `product_code` (the SKU set via `.setSku`), stable across query and detail.
   * @param data - The raw Searchanise item listing
   * @returns The product's product_code
   * @example
   * ```typescript
   * this.getUniqueProductKey(item); // "S770339"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: ItemListing): string {
    return String(data.product_code);
  }

  /**
   * Query products from the Searchanise API
   *
   * @param query - The query to search for
   * @param limit - The limit of products to return
   * @returns A promise that resolves when the products are queried
   * @example
   * ```typescript
   * // Search for sodium chloride with a limit of 10 results
   * const products = await this.queryProducts("sodium chloride", 10);
   * if (products) {
   *   console.log(`Found ${products.length} products`);
   *   for (const product of products) {
   *     const builtProduct = await product.build();
   *     console.log({
   *       title: builtProduct.title,
   *       price: builtProduct.price,
   *       quantity: builtProduct.quantity,
   *       uom: builtProduct.uom
   *     });
   *   }
   * }
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    // curl -s --get https://searchserverapi.com/getresults \
    //   --data-urlencode "api_key=<api_key>" \
    //   --data-urlencode "q=sulf" \
    //   --data-urlencode "maxResults=6" \
    //   --data-urlencode "items=true" | jq
    if (!(await this.ensureCredentials())) {
      this.logger.error('No Searchanise api key available, so the search cannot run');
      return;
    }

    let outcome = await this.fetchResults(this.buildResultsParams(query));

    // The key is only re-scraped when Searchanise rejects it, and only once per search.
    if (outcome.kind === 'expired') {
      this.logger.warn('Searchanise api key was rejected; retrieving a new one');
      await this.resetCredentials();
      if (!(await this.ensureCredentials())) {
        this.logger.error('Failed to retrieve a new Searchanise api key');
        return;
      }
      outcome = await this.fetchResults(this.buildResultsParams(query));
    }

    if (outcome.kind === 'expired') {
      this.logger.error('Searchanise rejected the newly retrieved api key');
      return;
    }

    if (outcome.kind === 'failed') {
      return;
    }

    const searchRequest = outcome.json;

    if (!isValidSearchResponse(searchRequest)) {
      this.logger.error('Invalid search response', { response: searchRequest });
      return;
    }

    if (!('items' in searchRequest)) {
      this.logger.error('Invalid search response', { response: searchRequest });
      return;
    }

    if ('items' in searchRequest === false || !Array.isArray(searchRequest.items)) {
      this.logger.error('Search response items is not an array', { items: searchRequest.items });
      return;
    }

    if (searchRequest.items.length === 0) {
      this.logger.error('Search response items is empty', { items: searchRequest.items });
      return;
    }

    const validItems = (searchRequest.items ?? []).filter(
      (item): item is ItemListing =>
        item !== null &&
        typeof item === 'object' &&
        'quantity' in item &&
        Number(item.quantity) > 0,
    );
    const fuzzResults = this.fuzzyFilterAst<ItemListing>(validItems);
    this.logger.debug('Applied fuzzy filter to search results', { fuzzResults });

    return this.initProductBuilders(fuzzResults.slice(0, limit));
  }

  /**
   * Initialize product builders from Searchanise search response data.
   * Transforms Searchanise product listings into ProductBuilder instances, handling:
   * - Basic product information (title, link, supplier)
   * - Pricing information in USD
   * - Product descriptions
   * - SKU/product codes
   * - Vendor information
   * - Quantity parsing from multiple fields
   * - Searchanise-specific variants with their attributes
   *
   * @param results - Array of Searchanise item listings from search results
   * @returns Array of ProductBuilder instances initialized with Searchanise product data
   * @example
   * ```typescript
   * const results = await this.queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this.initProductBuilders(results);
   *   // Each builder contains parsed product data from Searchanise
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log({
   *       title: product.title,
   *       price: product.price,
   *       quantity: product.quantity,
   *       uom: product.uom,
   *       variants: product.variants
   *     });
   *   }
   * }
   * ```
   * @source
   */
  protected initProductBuilders(results: ItemListing[]): ProductBuilder<Product>[] {
    return results
      .map((item) => {
        const builder = new ProductBuilder(this.baseURL);
        // Searchanise only returns the search-listing fields, so the chemical
        // details (CAS, molar mass, purity, molarity) are parsed out of the
        // title and description here. firstMap tries the title first, then the
        // description, keeping the first value found.
        builder
          .setBasicInfo(item.title, item.link, this.supplierName)
          .setMatchPercentage(this.matchScoreOf(item))
          .setData(this.productDefaults)
          .setPricing(
            Number(item.price),
            this.productDefaults.currencyCode,
            this.productDefaults.currencySymbol,
          )
          .setDescription(item.description)
          .setSku(item.product_code)
          .setVendor(item.vendor)
          .setImage(item.image_link)
          .setCAS(firstMap(findCAS, [item.title, item.description]))
          .setMoleweight(firstMap(findMolarMass, [item.title, item.description]))
          .setPurity(firstMap(findPurity, [item.title, item.description]))
          .setConcentration(firstMap(findMolarity, [item.title, item.description]))
          .setCacheKey(this.getUniqueProductKey(item));

        const quantity = firstMap(parseQuantity, [
          item.product_code,
          item.quantity,
          item.title,
          item.description,
        ]);

        if (!quantity) {
          this.logger.warn('Failed to get quantity from retrieved product data', {
            item,
            parsedValues: [item.product_code, item.quantity, item.title, item.description],
            builder,
          });
          return;
        }

        builder.setQuantity(quantity.quantity, quantity.uom);

        this.logger.debug('Found Shopify variants for item', { item });
        if ('shopify_variants' in item && Array.isArray(item.shopify_variants)) {
          item.shopify_variants.forEach((variant) => {
            if (!isSearchaniseVariant(variant)) return;

            const variantQuantity = firstMap(parseQuantity, [
              String(variant?.options?.Model ?? ''),
              String(variant?.options?.Size ?? ''),
              variant.sku,
            ]);

            this.logger.debug('Parsed variant quantity', { variantQuantity, item });

            builder.addVariant({
              id: variant.variant_id,
              sku: variant.sku,
              //title: variant.title,
              price: variant.price,
              title: String(variant?.options?.Model ?? ''),
              url: variant.link,
              ...variantQuantity,
            });
          });
        }

        return builder;
      })
      .filter((builder): builder is ProductBuilder<Product> => builder !== undefined);
  }

  /**
   * Transforms a Searchanise product listing into the common Product type.
   * @param product - The Searchanise product listing to transform
   * @returns Promise resolving to a partial Product object or void if invalid
   * @example
   * ```typescript
   * const products = await this.queryProducts("sodium chloride");
   * if (products) {
   *   const product = await this.getProductData(products[0]);
   *   if (product) {
   *     const builtProduct = await product.build();
   *     console.log({
   *       title: builtProduct.title,
   *       price: builtProduct.price,
   *       quantity: builtProduct.quantity,
   *       uom: builtProduct.uom,
   *       variants: builtProduct.variants
   *     });
   *   }
   * }
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => builder);
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns - The title of the product
   * @source
   */
  protected titleSelector(data: ItemListing): string {
    return data.title;
  }

  /**
   * Builds the `/getresults` query string parameters for a search.
   * @param query - The product title to search for
   * @returns Request params using the current {@link apiKey}
   * @example
   * ```typescript
   * this.buildResultsParams('acetone');
   * // { api_key: '4p4M0R6q0N', maxResults: 200, queryBy: { title: 'acetone' }, ... }
   * ```
   * @source
   */
  private buildResultsParams(query: string): RequestParams {
    return {
      // The limit applies to the products returned from the supplier, not to this request.
      api_key: this.apiKey,
      maxResults: 200,
      startIndex: 0,
      sortBy: 'relevance',
      items: true,
      pageStartIndex: 0,
      queryBy: {
        title: query,
      },
      pagesMaxResults: 1,
      vendorsMaxResults: 200,
      output: 'json',
      _: new Date().getTime(),
      ...this.baseSearchParams,
    };
  }

  /**
   * Performs one `/getresults` request and classifies the result.
   *
   * Searchanise reports a dead key as plain text (`ENGINE_REMOVED` with a `200`, or
   * `INVALID_API_KEY` with a `400`), so the body is read as text before it is parsed as JSON.
   * @param params - The query parameters from {@link buildResultsParams}
   * @returns `ok` with the parsed body, `expired` when the key was rejected, or `failed`
   * @example
   * ```typescript
   * await this.fetchResults(this.buildResultsParams('acetone'));
   * // { kind: 'ok', json: { totalItems: 12, items: [...] } }
   * // { kind: 'expired' }   (api key was rejected)
   * // { kind: 'failed' }    (network error, abort, or a body that is not JSON)
   * ```
   * @source
   */
  private async fetchResults(params: RequestParams): Promise<ResultsOutcome> {
    let response: Maybe<Response>;
    try {
      response = await this.httpGet({
        path: '/getresults',
        host: this.apiHost,
        params,
        headers: { accept: ['application/json', 'text/plain', '*/*'].join(',') },
        rethrowErrors: true,
      });
    } catch (error) {
      // httpGet already logged the failure; here we only look for a rejected key.
      if (error instanceof HttpError && this.isApiKeyRejected(error.body)) {
        return { kind: 'expired' };
      }
      return { kind: 'failed' };
    }

    // Undefined when the request was aborted or failed (already logged by httpGet).
    if (!response) {
      return { kind: 'failed' };
    }

    const body = await response.text();
    if (this.isApiKeyRejected(body)) {
      return { kind: 'expired' };
    }

    try {
      return { kind: 'ok', json: JSON.parse(body) };
    } catch (error) {
      this.logger.error(`Search response was not valid JSON: ${getErrorMessage(error)}`, {
        error,
        status: response.status,
        bodyPreview: body.slice(0, 200),
      });
      return { kind: 'failed' };
    }
  }

  /**
   * Whether a `/getresults` body means Searchanise no longer accepts the api key.
   *
   * Only short bodies are checked: the error replies are a single word, and a full results payload
   * should never be mistaken for one.
   * @param body - The response body text (or an `HttpError` body)
   * @returns `true` when the body contains `ENGINE_REMOVED` or `INVALID_API_KEY`
   * @example
   * ```typescript
   * this.isApiKeyRejected('ENGINE_REMOVED');        // true
   * this.isApiKeyRejected('INVALID_API_KEY');       // true
   * this.isApiKeyRejected('{"totalItems":12}');     // false
   * this.isApiKeyRejected(undefined);               // false
   * ```
   * @source
   */
  protected isApiKeyRejected(body: unknown): boolean {
    return (
      typeof body === 'string' && body.length < 200 && /ENGINE_REMOVED|INVALID_API_KEY/.test(body)
    );
  }

  /**
   * Extracts the object literal assigned to a global in inline page script, e.g. the
   * `window.Searchanise = {...}` a Searchanise storefront embeds in its HTML.
   *
   * Braces are balanced while skipping over string contents, so `}` characters inside strings
   * don't end the object early.
   * @param text - The page HTML (or script) to search
   * @param name - The assigned variable, defaults to `window.Searchanise`
   * @returns The parsed object, or `undefined` when there is no assignment or it isn't valid JSON
   * @example
   * ```typescript
   * this.extractAssignedJson('<script>window.Searchanise = {"api_key":"4p4M0R6q0N"};</script>');
   * // { api_key: '4p4M0R6q0N' }
   * this.extractAssignedJson('<p>nothing here</p>'); // undefined
   * ```
   * @source
   */
  protected extractAssignedJson(
    text: string,
    name: string = 'window.Searchanise',
  ): Record<string, unknown> | undefined {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`${escaped}\\s*=\\s*\\{`).exec(text);
    if (!m) return undefined;

    const open = m.index + m[0].length - 1;
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = open; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (escape) escape = false;
        else if (c === '\\') escape = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try {
          return JSON.parse(text.slice(open, i + 1));
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  /**
   * Scrapes the Searchanise api key and API host from the storefront homepage.
   *
   * The host the page names is only used if it is on the {@link SEARCHANISE_API_HOSTS}
   * allow-list; otherwise the default host is used.
   * @returns The credentials, or `undefined` if the page couldn't be fetched or has no valid key
   * @throws Re-throws a search abort so the caller can stop
   * @example
   * ```typescript
   * await this.retrieveCredentials();
   * // { apiKey: '4p4M0R6q0N', host: 'searchserverapi1.com' }
   * ```
   * @source
   */
  protected async retrieveCredentials(): Promise<SearchaniseCredentials | undefined> {
    let html: Maybe<string>;
    try {
      html = await this.httpGetHtml({ path: '/' });
    } catch (error) {
      if (isExpectedAbort(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to fetch homepage when looking for api key: ${getErrorMessage(error)}`,
        {
          error,
        },
      );
      return undefined;
    }

    if (!html) {
      this.logger.error('Homepage was empty when looking for api key');
      return undefined;
    }

    const apiObject = this.extractAssignedJson(html, 'window.Searchanise');
    if (!isValidSearchaniseApiObject(apiObject)) {
      this.logger.error('Failed to find a valid Searchanise api object on the homepage', {
        htmlLength: html.length,
        foundObject: apiObject !== undefined,
      });
      return undefined;
    }

    return { apiKey: apiObject.api_key, host: this.resolveApiHost(apiObject.host) };
  }

  /**
   * Maps the `host` a storefront advertises to an allow-listed Searchanise API hostname.
   * @param host - The scraped host, as a URL (`https://searchserverapi1.com`) or bare hostname
   * @returns The hostname if allow-listed, otherwise {@link SEARCHANISE_DEFAULT_API_HOST}
   * @example
   * ```typescript
   * this.resolveApiHost('https://searchserverapi1.com'); // 'searchserverapi1.com'
   * this.resolveApiHost('https://evil.example.com');     // 'searchserverapi.com'
   * ```
   * @source
   */
  private resolveApiHost(host: string): string {
    let hostname = host.toLowerCase();
    try {
      hostname = new URL(host).hostname;
    } catch {
      // Not a URL; treat it as a bare hostname.
    }

    if (SEARCHANISE_API_HOSTS.includes(hostname)) {
      return hostname;
    }

    this.logger.warn(
      'Storefront named a Searchanise host that is not allow-listed; using default',
      {
        host,
      },
    );
    return SEARCHANISE_DEFAULT_API_HOST;
  }

  /**
   * Makes sure {@link apiKey} and {@link apiHost} are set: in memory first, then from storage, and
   * only scraping the storefront when neither has them. Freshly scraped credentials are cached.
   * @returns `true` when a usable api key is available
   * @example
   * ```typescript
   * if (!(await this.ensureCredentials())) return; // no key, can't search
   * ```
   * @source
   */
  protected async ensureCredentials(): Promise<boolean> {
    if (this.apiKey) {
      return true;
    }

    const stored = await this.loadStoredCredentials();
    if (stored) {
      this.apiKey = stored.apiKey;
      this.apiHost = stored.host;
      return true;
    }

    const retrieved = await this.retrieveCredentials();
    if (!retrieved) {
      return false;
    }

    this.apiKey = retrieved.apiKey;
    this.apiHost = retrieved.host;
    await this.storeCredentials(retrieved);
    return true;
  }

  /**
   * Forgets the current credentials, in memory and in storage, so the next
   * {@link ensureCredentials} scrapes a fresh key.
   * @returns Promise resolving once the stored credentials are removed
   * @example
   * ```typescript
   * await this.resetCredentials();
   * await this.ensureCredentials(); // scrapes the storefront again
   * ```
   * @source
   */
  private async resetCredentials(): Promise<void> {
    this.apiKey = '';
    this.apiHost = SEARCHANISE_DEFAULT_API_HOST;
    await this.clearStoredCredentials();
  }

  /**
   * Storage key for this supplier's cached credentials.
   * @returns `searchanise_credentials:<supplierName>`
   * @example
   * ```typescript
   * this.credentialsStorageKey(); // 'searchanise_credentials:Laballey'
   * ```
   * @source
   */
  private credentialsStorageKey(): string {
    return `${CACHE.SEARCHANISE_CREDENTIALS}:${this.supplierName}`;
  }

  /**
   * Reads this supplier's cached credentials from storage.
   * @returns The credentials, or `undefined` if none are stored, they're malformed, or storage failed
   * @example
   * ```typescript
   * await this.loadStoredCredentials(); // { apiKey: '4p4M0R6q0N', host: 'searchserverapi1.com' }
   * ```
   * @source
   */
  private async loadStoredCredentials(): Promise<SearchaniseCredentials | undefined> {
    const storageKey = this.credentialsStorageKey();
    try {
      const stored = await cstorage.local.get([storageKey]);
      const credentials: unknown = stored[storageKey];
      if (!isSearchaniseCredentials(credentials)) {
        return undefined;
      }
      // A stored host must still be allow-listed, in case the list shrank or the record was altered.
      return SEARCHANISE_API_HOSTS.includes(credentials.host) ? credentials : undefined;
    } catch (error) {
      this.logger.warn(`Failed to read stored api key: ${getErrorMessage(error)}`, { error });
      return undefined;
    }
  }

  /**
   * Caches this supplier's credentials so later searches skip the homepage scrape.
   * @param credentials - The validated api key and host to store
   * @returns Promise resolving once the credentials are written
   * @example
   * ```typescript
   * await this.storeCredentials({ apiKey: '4p4M0R6q0N', host: 'searchserverapi1.com' });
   * ```
   * @source
   */
  private async storeCredentials(credentials: SearchaniseCredentials): Promise<void> {
    try {
      await cstorage.local.set({ [this.credentialsStorageKey()]: credentials });
    } catch (error) {
      this.logger.warn(`Failed to persist api key: ${getErrorMessage(error)}`, { error });
    }
  }

  /**
   * Removes this supplier's cached credentials after Searchanise rejected them.
   * @returns Promise resolving once the credentials are removed
   * @example
   * ```typescript
   * await this.clearStoredCredentials();
   * ```
   * @source
   */
  private async clearStoredCredentials(): Promise<void> {
    try {
      await cstorage.local.remove(this.credentialsStorageKey());
    } catch (error) {
      this.logger.warn(`Failed to remove stored api key: ${getErrorMessage(error)}`, { error });
    }
  }
}
