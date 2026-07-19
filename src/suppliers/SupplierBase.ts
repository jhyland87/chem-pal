import { defaultResultsLimit } from "@/../config.json";
import { UOM } from "@/constants/common";
import { FUZZ_SCORERS, isFuzzScorerName, type FuzzScorerFn } from "@/constants/fuzzScorers";
import { backgroundFetch, type BackgroundFetchInit } from "@/helpers/backgroundFetch";
import { setCookie } from "@/helpers/cookies";
import { EmptyResponseError, HttpError } from "@/helpers/exceptions";
import {
  countExcludedProductsForSupplier,
  loadExcludedProductKeys,
} from "@/helpers/excludedProducts";
import { fetchDecorator, type FetchDecoratorResponse } from "@/helpers/fetch";
import { stripQuantityFromString } from "@/helpers/quantity";
import type { ResolvedStructure } from "@/helpers/smiles";
import { sleep } from "@/helpers/utils";
import { getSupplierColor } from "@/theme/colors";
import { deleteSupplierQueryCacheEntry } from "@/utils/idbCache";
import { IS_DEV_BUILD } from "@/utils/isDevBuild";
import { Logger } from "@/utils/Logger";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { scoreAstMatch } from "@/utils/search-query/evaluateAst";
import { extractOrGroups } from "@/utils/search-query/extractPositiveTerms";
import { parseSearchQuery } from "@/utils/search-query/parseSearchQuery";
import type { ParsedSearchQuery } from "@/utils/search-query/types";
import { SupplierCache } from "@/utils/SupplierCache";
import {
  incrementFailure,
  incrementParseError,
  incrementProductCount,
  incrementSearchQueryCount,
  incrementSuccess,
} from "@/utils/SupplierStatsStore";
import {
  isHtmlResponse,
  isHttpResponse,
  isJsonResponse,
  isMinimalProduct,
  isPopulatedObject,
} from "@/utils/typeGuards/common";
import { isCachedProductData } from "@/utils/typeGuards/productbuilder";
import { Queue } from "async-await-queue";
import {
  distance,
  extract,
  partial_ratio,
  partial_token_set_ratio,
  partial_token_similarity_sort_ratio,
  partial_token_sort_ratio,
  ratio,
  token_set_ratio,
  token_similarity_sort_ratio,
  token_sort_ratio,
  WRatio,
} from "fuzzball";
import { type JsonValue } from "type-fest";

// CacheMetadata, CachedData<T>, and ProductDefaults are declared globally in
// types/supplierCache.d.ts — see that file for their definitions.

/**
 * The base class for all suppliers.
 * @abstract
 * @category Suppliers
 * @typeParam S - the partial product
 * @typeParam T - The product type
 * @example
 * ```typescript
 * const supplier = new SupplierBase<Product>();
 * ```
 * @source
 */
export abstract class SupplierBase<S, T extends Product> implements ISupplier {
  /** The name of the supplier (used for display name, lists, etc). */
  public abstract readonly supplierName: string;

  /** The base URL for the supplier. */
  public abstract readonly baseURL: string;

  /**
   * Color used to visually tag this supplier's log output (and available for
   * charts/UI). Defaults to a stable palette color derived from the class name
   * via `getSupplierColor`, so no supplier has to set one. Override by
   * assigning a hex string in a subclass constructor (also call
   * `this.logger.setColor(this.color)` there to recolor the already-built logger).
   */
  public color: string = getSupplierColor(this.constructor.name);

  /** The minimum match percentage for a product to be considered a match. */
  protected readonly minMatchPercentage: number = 65;

  /**
   * Fuzz scorer used by `fuzzyFilter` to score each candidate's title against
   * the query. Any function from `fuzzball` with the
   * `(str1, str2, opts?) => number` shape works. Subclasses override this when
   * a supplier's title format needs a different scorer (e.g. a catalog that
   * pads titles with boilerplate might prefer `partial_ratio`). Defaults to
   * `ratio`.
   *
   * Overridable at runtime from `userSettings.fuzzScorerOverride` — see
   * `setFuzzScorerOverride` and `fuzzyFilter` below. The user's Advanced
   * settings selection wins over this subclass default when set.
   */
  protected readonly fuzzScorer: FuzzScorerFn = WRatio;

  /**
   * Runtime override resolved from `userSettings.fuzzScorerOverride`. When
   * set, `fuzzyFilter` uses this instead of `this.fuzzScorer`. Undefined
   * (the default) means "use whatever the supplier class picked". Mutated
   * by `setFuzzScorerOverride` so it can't be `readonly`.
   */
  protected fuzzScorerOverride?: FuzzScorerFn;

  /**
   * Parsed advanced-search query, set per-instance by `SupplierFactory` from the
   * user's input. When absent (e.g. a directly-constructed test supplier),
   * {@link getAst} lazily parses `this.query` instead.
   */
  protected parsedQuery?: ParsedSearchQuery;

  /**
   * SMILES/structure query terms resolved to their chemical identifiers, keyed by
   * the raw search term. Resolved once per search by `SupplierFactory` (network-
   * bound, via NCI Cactus/PubChem) and shared with every supplier so none of them
   * re-resolve. Undefined when the query has no structure terms. Only suppliers
   * that filter by structure (currently Ambeed) read this; others ignore it.
   */
  protected resolvedStructures?: ReadonlyMap<string, ResolvedStructure>;

  /**
   * Runtime flag resolved from `userSettings.fuzzyFilteringDisabled`. When true,
   * `fuzzyFilterAst` skips fuzzball scoring: plain queries return raw supplier
   * results and advanced queries are filtered only by the boolean predicate via
   * case-insensitive substring matching.
   */
  protected fuzzyFilteringDisabled: boolean = false;

  /**
   * Fuzzy strategy. When true (the default), {@link fuzzyFilter}/{@link fuzzyFilterAst}
   * rank candidates by fuzz score and keep them all (in score order) instead of dropping
   * anything below {@link minMatchPercentage}; the base search pipeline then caps the list
   * to {@link limit}, so the highest-scoring matches survive. This avoids dropping clear
   * matches whose ratio-style score falls under the cutoff purely because the title dwarfs
   * the query. Set to `false` on a supplier to restore the hard-cutoff behavior.
   */
  protected readonly fuzzyFilterRankOnly: boolean = false;

  /** Maximum number of backend search requests the keyword-only fallback issues. */
  protected readonly maxFallbackQueries: number = 4;

  /**
   * Whether `queryProducts` handles an advanced (boolean) query natively in a
   * single request — true for suppliers that translate the AST into a server-side
   * query (Wix, Shopify, Chemsavers/Typesense, LiMac/FreeFind). When false (the
   * default), {@link queryProductsWithCache} drives the keyword-only fallback:
   * one backend search per positive OR-group, unioned and deduped, with the full
   * boolean predicate enforced client-side by {@link fuzzyFilterAst}.
   */
  protected readonly supportsNativeAdvancedSearch: boolean = false;

  /**
   * Opt-out flag for the per-product detail cache. Left `false` (the default),
   * every supplier caches its per-product detail data — the safe default, since
   * forgetting to set this just yields harmless redundant caching, never a
   * silent cache regression.
   *
   * Set `true` only on a supplier that resolves every field in the initial
   * search (a passthrough `getProductData` with no per-product fetch): for those
   * the per-product cache saves nothing, so
   * {@link getProductData}/{@link getProductDataWithCache}/{@link partitionForBatch}
   * skip the product-detail cache read+write. The query cache still serves
   * repeat searches, and {@link getUniqueProductKey} is still used for
   * exclusions. Mark the concrete pure-search *supplier* (not a shared base
   * class), so a base's fetching subclass keeps caching by default.
   */
  protected readonly skipProductDetailCache: boolean = false;

  /**
   * The shipping scope of the supplier. Used to determine the shipping scope
   * of the supplier.
   */
  public abstract readonly shipping: ShippingRange;

  /**
   * The country code of the supplier. Used to determine the currency and other
   * country-specific information.
   */
  public abstract readonly country: CountryCode;

  /**
   * The payment methods accepted by the supplier. Used to determine the
   * payment methods accepted by the supplier.
   */
  public abstract readonly paymentMethods: PaymentMethod[];

  /**
   * The countries to which the supplier ships.
   * @example
   * ```typescript
   * public readonly shipsTo: CountryCode[] = ["US", "CN", "NL"];
   * ```
   * @source
   */
  protected readonly shipsTo?: CountryCode[];

  /**
   * Optional external API hostname used by some suppliers (e.g., Typesense,
   * Searchanise). When set, automatically included in `requiredHosts` for
   * permission checks.
   */
  protected readonly apiURL?: string;

  /**
   * All host origin patterns required for this supplier to function.
   * Automatically includes `baseURL` and, if defined, `apiURL`. Used by the
   * factory to check chrome permissions before querying.
   */
  public get requiredHosts(): string[] {
    const hosts = [`${this.baseURL}/*`];
    if (this.apiURL) {
      hosts.push(`https://${this.apiURL}/*`);
    }
    return hosts;
  }

  /**
   * Determines whether this supplier ships to the given country. Prefers the
   * explicit `shipsTo` allowlist when the supplier declares one; otherwise falls
   * back to the coarse `shipping` scope — `"worldwide"`/`"international"` ship
   * anywhere, while `"domestic"`/`"local"` ship only within the supplier's own
   * `country`.
   * @param location - The user's location as an ISO 3166-1 alpha-2 country code.
   * @returns True if the supplier ships to `location`, false otherwise.
   * @example
   * ```typescript
   * // Supplier with shipsTo = ["US", "CA"]:
   * supplier.shipsToCountry("US"); // true
   * supplier.shipsToCountry("DE"); // false
   * // Domestic US supplier (no shipsTo):
   * supplier.shipsToCountry("US"); // true
   * supplier.shipsToCountry("DE"); // false
   * // Worldwide supplier (no shipsTo):
   * supplier.shipsToCountry("DE"); // true
   * ```
   * @source
   */
  public shipsToCountry(location: CountryCode): boolean {
    if (this.shipsTo) {
      return this.shipsTo.includes(location);
    }
    switch (this.shipping) {
      case "worldwide":
      case "international":
        return true;
      case "domestic":
      case "local":
        return this.country === location;
      default:
        return true;
    }
  }

  /**
   * String to query for (product name, CAS, etc.). The search term that will
   * be used to find products. Set during construction and used throughout the
   * supplier's lifecycle.
   */
  protected query: string;

  /**
   * If the products first require a query of a search page that gets iterated
   * over, those results are stored here. Acts as a cache for the initial
   * search results before they are processed into full product objects.
   */
  protected queryResults: S[] = [];

  /**
   * The base search parameters that are always included in search requests.
   * These parameters are merged with any additional search parameters
   * when making requests to the supplier's API.
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBase<Product> {
   *   constructor() {
   *     super();
   *     this.baseSearchParams = {
   *       format: "json",
   *       version: "2.0"
   *     };
   *   }
   * }
   * ```
   * @source
   */
  protected baseSearchParams: Record<string, string | number> = {};

  /**
   * The AbortController instance used to manage and cancel ongoing requests.
   * This allows for cancellation of in-flight requests when needed,
   * such as when a new search is started or the supplier is disposed.
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * const supplier = new MySupplier("acetone", 5, controller);
   *
   * // Later, to cancel all pending requests:
   * controller.abort();
   * ```
   * @source
   */
  protected controller: AbortController;

  /**
   * The maximum number of results to return for a search query.
   * This is not a limit on HTTP requests, but rather the number of
   * products that will be returned to the caller.
   *
   * @example
   * ```typescript
   * const supplier = new MySupplier("acetone", 5); // Limit to 5 results
   * for await (const product of supplier) {
   *   // Will yield at most 5 products
   * }
   * ```
   * @source
   */
  protected limit: number;

  /**
   * The products that are currently being built by the supplier.
   * This array holds ProductBuilder instances that are in the process
   * of being transformed into complete Product objects.
   *
   * @example
   * ```typescript
   * await supplier.queryProducts("acetone");
   * console.log(`Building ${supplier.products.length} products`);
   * for (const builder of supplier.products) {
   *   const product = await builder.build();
   *   console.log("Built product:", product.title);
   * }
   * ```
   * @source
   */
  protected products: ProductBuilder<T>[] = [];

  /**
   * Maximum number of HTTP requests allowed per search query.
   * This is a hard limit to prevent excessive requests to the supplier's API.
   * If this limit is reached, the supplier will stop making new requests.
   *
   * @defaultValue 50
   * @example
   * ```typescript
   * class MySupplier extends SupplierBase<Product> {
   *   constructor() {
   *     super();
   *     this.httpRequestHardLimit = 100; // Allow more requests
   *   }
   * }
   * ```
   * @source
   */
  protected httpRequestHardLimit: number = 50;

  /**
   * Counter for HTTP requests made during the current query execution.
   * This is used to track the number of requests and ensure we don't
   * exceed the httpRequestHardLimit.
   *
   * @defaultValue 0
   * @example
   * ```typescript
   * await supplier.queryProducts("acetone");
   * console.log(`Made ${supplier.requestCount} requests`);
   * if (supplier.requestCount >= supplier.httpRequestHardLimit) {
   *   console.log("Reached request limit");
   * }
   * ```
   * @source
   */
  protected requestCount: number = 0;

  /**
   * Number of requests to process in parallel when fetching product details.
   * This controls the batch size for concurrent requests to avoid overwhelming
   * the supplier's API and the user's bandwidth.
   *
   * @defaultValue 10
   * @example
   * ```typescript
   * class MySupplier extends SupplierBase<Product> {
   *   constructor() {
   *     super();
   *     // Process 5 requests at a time
   *     this.maxConcurrentRequests = 5;
   *   }
   * }
   * ```
   * @source
   */
  protected maxConcurrentRequests: number = 3;

  /**
   * Minimum number of milliseconds between two consecutive tasks
   * @source
   */
  protected minConcurrentCycle: number = 100;

  /**
   * Maximum wall-clock time (in milliseconds) a single supplier's `execute()` search may run.
   * Once exceeded, any in-flight and pending product-detail requests are aborted and the search
   * stops yielding new products — only those already collected are returned. Measured from the
   * start of `execute()`, so it also bounds a slow initial query. Set to `0` (the default) to
   * disable the limit. Override per supplier for sources that are slow or rate-limit-prone.
   *
   * @defaultValue 0 (disabled)
   * @source
   */
  protected maxAllowableSearchTime: number = 0;

  /**
   * HTTP headers used as a basis for all requests to the supplier.
   * These headers are merged with any request-specific headers when
   * making HTTP requests.
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBase<Product> {
   *   constructor() {
   *     super();
   *     this.headers = {
   *       "Accept": "application/json",
   *       "User-Agent": "ChemPal/1.0"
   *     };
   *   }
   * }
   * ```
   * @source
   */
  protected headers: HeadersInit = {};

  /**
   * Cookies that must be written into the browser jar before any request runs
   * — e.g. a currency or session-preference cookie the backend reads. Seeded
   * once per instance by `ensureSetup` (before `setup`) via `chrome.cookies`,
   * since the `Cookie` request header is on the fetch-forbidden list and can't
   * be set through `this.headers`. Each entry's `url` defaults to `baseURL`.
   * Subclasses override this instead of hand-rolling a `setup` that calls
   * `chrome.cookies.set` directly.
   * @defaultValue []
   * @example
   * ```typescript
   * class MySupplier extends SupplierBase<Partial<Product>, Product> {
   *   protected readonly requiredCookies: SupplierCookieSeed[] = [
   *     { name: "currency", value: "2" },
   *   ];
   * }
   * ```
   * @source
   */
  protected readonly requiredCookies: SupplierCookieSeed[] = [];

  /**
   * Number of times `fetch` retries a request that comes back `403`. Some
   * suppliers sit behind a WAF that 403s the first hit while planting a
   * session cookie (a "cookie handshake"); because every request now sets
   * `credentials: "include"`, that cookie lands in the jar and the retry
   * carries it back, usually passing. We can't gate on the `Set-Cookie`
   * header (it's fetch-forbidden and invisible to JS), so this per-supplier
   * flag is the gate — `0` (the default) means never retry. Only enable it
   * for suppliers known to do this handshake.
   * @defaultValue 0
   * @source
   */
  protected readonly challengeRetryLimit: number = 0;

  /**
   * Delay in milliseconds between `403` challenge retries. Gives the WAF a
   * brief beat before re-requesting with the freshly-planted cookie.
   * @defaultValue 300
   * @source
   */
  protected readonly challengeRetryDelayMs: number = 300;

  /**
   * Logger for the supplier. Initialized in the constructor with the name of
   * the inheriting class.
   */
  protected logger: Logger;

  /**
   * Default values for products. These will get overridden if they're found in
   * the product data.
   */
  protected productDefaults: ProductDefaults = {
    uom: UOM.EA,
    quantity: 1,
    currencyCode: "USD",
    currencySymbol: "$",
  };

  /**
   * Cache instance for this supplier.
   *
   * Initialized after construction by `initCache()` (called from
   * `SupplierFactory` once `supplierName` is set). The `!` assertion is safe
   * here because every code path that reads `this.cache`
   * (`queryProductsWithCache`, `getProductData`, `getProductDataWithCache`)
   * runs only after `execute()` is called on a factory-built instance, and the
   * factory always calls `initCache()` before handing the instance out.
   */
  protected cache!: SupplierCache;

  /**
   * HTTP status codes that, when hit while fetching a product's detail data, prevent that
   * product from being cached (see {@link shouldCacheProductData}). Mirrors
   * `userSettings.noCacheStatusCodes`; set by {@link initCache}. Defaults to `[429]`.
   */
  protected noCacheStatusCodes: number[] = [429];

  /**
   * Maps a product's fetch key (permalink, falling back to its processing URL) to the HTTP
   * status of its last failed detail fetch. Populated by subclasses via {@link recordFetchFailure}
   * and consulted by {@link shouldCacheProductData}. Per-search, since the factory builds a fresh
   * supplier instance for each search.
   */
  protected readonly failedFetchStatuses: Map<string, number> = new Map();

  /**
   * Product-data cache keys the user has explicitly excluded via the "Ignore
   * Product" context menu action. Loaded once per `execute()` from
   * `storage.local` so membership checks are synchronous on the hot path
   * (see `getProductData`). Newly-ignored products take effect on the next
   * search, which matches the stated feature requirement.
   */
  protected excludedProductKeys: Set<string> = new Set();

  /**
   * Memoizes `setup()` so it runs at most once per supplier instance, lazily,
   * only when the search is about to do real work. The gate lives at the
   * phase boundaries in `queryProductsWithCache` (before `queryProducts`)
   * and `getProductData` / `getProductDataWithCache` (before the fetcher),
   * so setup runs strictly before any code that reads its mutated state
   * (`this.headers`, `this.localStorage`, etc.) — including subclasses whose
   * request path reads `localStorage` synchronously. If every query and
   * product lookup is a cache hit, the promise stays null and setup is never
   * invoked.
   *
   * @defaultValue null
   * @example
   * ```typescript
   * // First cache miss sets the promise; subsequent awaits share it.
   * await this.ensureSetup();
   * console.log(this.setupPromise); // Promise<void> (resolved)
   * ```
   * @source
   */
  private setupPromise: Promise<void> | null = null;

  /**
   * Creates a new instance of the supplier base class.
   * Initializes the supplier with query parameters, request limits, and abort controller.
   * Sets up logging and default product values.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to return (default: 5)
   * @param controller - AbortController instance for managing request cancellation
   *
   * @example
   * ```typescript
   * // Create a supplier with default limit
   * const supplier = new MySupplier("sodium chloride", undefined, new AbortController());
   *
   * // Create a supplier with custom limit
   * const supplier = new MySupplier("acetone", 10, new AbortController());
   *
   * // Create a supplier and handle cancellation
   * const controller = new AbortController();
   * const supplier = new MySupplier("ethanol", 5, controller);
   *
   * // Later, to cancel all pending requests:
   * controller.abort();
   * ```
   * @source
   */
  public constructor(
    query: string,
    limit: number = defaultResultsLimit,
    controller?: AbortController,
  ) {
    // Initialize required properties
    this.query = query;
    this.limit = limit;
    this.controller = controller ?? new AbortController();
    this.logger = new Logger(this.constructor.name, undefined, this.color);
  }

  /**
   * Initializes the cache for the supplier.
   * This is called after construction to ensure supplierName is set.
   *
   * @remarks
   * The cache is initialized with the supplier's name and is used to store
   * both query results and product data. This method should be called after
   * the supplier's name is set to ensure proper cache key generation.
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBase<Product> {
   *   constructor() {
   *     super("acetone", 5);
   *     // supplierName is set here
   *     this.initCache(); // Initialize cache after supplierName is set
   *   }
   * }
   * ```
   * @source
   */
  public initCache(
    enabled: boolean = true,
    doNotCacheEmptyResults: boolean = false,
    cacheTtlMinutes: number = 0,
    noCacheStatusCodes: number[] = [429],
  ): void {
    this.cache = new SupplierCache(
      this.supplierName,
      this.constructor.name,
      enabled,
      doNotCacheEmptyResults,
      cacheTtlMinutes,
    );
    // Stored on the supplier (not the cache): the decision is made at cache-write time in
    // getProductData(WithCache), where the per-product fetch status is known.
    this.noCacheStatusCodes = noCacheStatusCodes ?? [429];
  }

  /**
   * Applies (or clears) a runtime override for the fuzz scorer. Driven by
   * `userSettings.fuzzScorerOverride` — when the user picks a scorer in the
   * Advanced drawer section, `SupplierFactory` calls this on each instance
   * so the choice takes effect uniformly across every supplier.
   *
   * Silently ignores unknown names so an outdated / corrupted setting can't
   * blow up the search flow — callers fall back to the subclass default.
   * @param name - Name of a scorer from `FUZZ_SCORERS`, or `undefined` to
   *   clear the override and use the subclass default.
   * @example
   * ```ts
   * const supplier = new MySupplier("acetone", 5, controller);
   * supplier.setFuzzScorerOverride("token_set_ratio");
   * // fuzzyFilter now uses token_set_ratio regardless of MySupplier's default
   * supplier.setFuzzScorerOverride(undefined);
   * // back to MySupplier's default
   * ```
   * @source
   */
  public setFuzzScorerOverride(name: string | undefined): void {
    if (isFuzzScorerName(name)) {
      this.fuzzScorerOverride = FUZZ_SCORERS[name];
    } else {
      this.fuzzScorerOverride = undefined;
    }
  }

  /**
   * Applies a runtime override for {@link maxAllowableSearchTime}, driven by
   * `userSettings.maxAllowableSearchTime` (set in the Advanced settings section). Accepts the raw
   * setting value (which may arrive as a string from the number input). An absent, empty, or
   * invalid value is ignored so the supplier keeps its class default; a valid non-negative number
   * (including `0` to disable the limit) replaces it.
   * @param value - The override in milliseconds, or any value (invalid/empty input is ignored)
   * @example
   * ```typescript
   * supplier.setMaxAllowableSearchTime(60000); // cap searches at 60s
   * supplier.setMaxAllowableSearchTime("");     // no-op, keep the per-supplier default
   * ```
   * @source
   */
  public setMaxAllowableSearchTime(value: unknown): void {
    if (value === undefined || value === null || value === "") {
      return;
    }
    const ms = Number(value);
    if (!Number.isNaN(ms) && ms >= 0) {
      this.maxAllowableSearchTime = ms;
    }
  }

  /**
   * Sets the parsed advanced-search query for this instance. Called by
   * `SupplierFactory` once per search so every supplier shares the same parse of
   * the user's input.
   * @param parsed - The parsed query, or undefined to clear it.
   * @example
   * ```typescript
   * supplier.setParsedQuery(parseSearchQuery("Sodium OR Potassium"));
   * ```
   * @source
   */
  public setParsedQuery(parsed: ParsedSearchQuery | undefined): void {
    this.parsedQuery = parsed;
  }

  /**
   * Applies a runtime override for {@link fuzzyFilteringDisabled}, driven by
   * `userSettings.fuzzyFilteringDisabled`. When true, fuzzball scoring is skipped
   * and only the boolean predicate (substring matching) is applied.
   * @param value - True to disable fuzzy filtering, false (default) to keep it.
   * @example
   * ```typescript
   * supplier.setFuzzyFilteringDisabled(true); // show raw/boolean-only results
   * ```
   * @source
   */
  public setFuzzyFilteringDisabled(value: boolean): void {
    this.fuzzyFilteringDisabled = value === true;
  }

  /**
   * Sets the map of resolved structure terms for this instance. Called by
   * `SupplierFactory` once per search so every supplier shares one resolution of
   * any SMILES/structure terms instead of each hitting the network.
   * @param resolved - Map of raw search term → resolved structure, or undefined when none.
   * @example
   * ```typescript
   * supplier.setResolvedStructures(new Map([["CCO", { name: "ethanol", cas: ["64-17-5"] }]]));
   * ```
   * @source
   */
  public setResolvedStructures(resolved: ReadonlyMap<string, ResolvedStructure> | undefined): void {
    this.resolvedStructures = resolved;
  }

  /**
   * Returns the parsed query for this instance, lazily parsing `this.query` when
   * `SupplierFactory` did not set one (e.g. in unit tests that construct a
   * supplier directly).
   * @returns The parsed search query.
   * @example
   * ```typescript
   * const { isAdvanced, ast } = this.getAst();
   * ```
   * @source
   */
  protected getAst(): ParsedSearchQuery {
    return this.parsedQuery ?? parseSearchQuery(this.query);
  }

  /**
   * Placeholder for any setup that needs to be done before the query is made.
   * Override this in subclasses if you need to perform setup (e.g., authentication, token fetching).
   *
   * @returns A promise that resolves when the setup is complete.
   *
   * @example
   * ```typescript
   * await supplier.setup();
   * ```
   * @source
   */
  protected async setup(): Promise<void> {}

  /**
   * Lazy, single-shot wrapper around `setup()`. Invoked at the phase
   * boundaries in `queryProductsWithCache` and `getProductData` /
   * `getProductDataWithCache`, so setup runs only when the search is about
   * to do real work — a fully cached search never triggers setup at all.
   * Concurrency-safe: parallel callers share the same promise and all await
   * its real resolution, so no worker can race past setup. Because the gate
   * lives above `fetch()`, `setup()` itself can freely call `this.httpGet`
   * / `this.httpPost` — there is no re-entry to defend against. If
   * `setup()` throws, the rejected promise is memoized — callers won't
   * silently retry a broken supplier.
   *
   * @returns A promise that resolves once `setup()` has completed.
   *
   * @example
   * ```typescript
   * // Called internally before any code path that reads setup-mutated state:
   * await this.ensureSetup();
   * const response = await this.queryProducts(query, limit);
   * ```
   * @source
   */
  private async ensureSetup(): Promise<void> {
    if (!this.setupPromise) {
      this.setupPromise = (async () => {
        await this.seedRequiredCookies();
        await this.setup();
      })();
    }
    return this.setupPromise;
  }

  /**
   * Writes every entry in `requiredCookies` into the browser jar before
   * `setup` runs. Each cookie's `url` defaults to `baseURL`. Failures are
   * swallowed and logged by `setCookie`, so a missing cookie permission never
   * aborts the query — affected prices/preferences just fall back to the
   * session default.
   * @returns A promise that resolves once all cookies have been seeded.
   * @source
   */
  private async seedRequiredCookies(): Promise<void> {
    for (const cookie of this.requiredCookies) {
      await setCookie({ url: this.baseURL, ...cookie });
    }
  }

  /**
   * Retrieves HTTP headers from a URL using a HEAD request.
   * Useful for checking content types, caching headers, and other metadata without downloading the full response.
   *
   * @param url - The URL to fetch headers from
   * @returns Promise resolving to the response headers or void if request fails
   *
   * @example
   * ```typescript
   * // Basic usage
   * const headers = await supplier.httpGetHeaders('https://example.com/product/123');
   * if (headers) {
   *   console.log('Content-Type:', headers['content-type']);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // With error handling
   * try {
   *   const headers = await supplier.httpGetHeaders('https://example.com/product/123');
   *   if (headers) {
   *     console.log('Headers:', headers);
   *   }
   * } catch (err) {
   *   console.error('Failed to fetch headers:', err);
   * }
   * ```
   * @source
   */
  protected async httpGetHeaders(url: string | URL): Promise<Maybe<HeadersInit>> {
    const requestObj = new Request(this.href(url), {
      signal: this.controller.signal,
      headers: new Headers(this.headers),
      referrer: this.baseURL,
      referrerPolicy: "strict-origin-when-cross-origin",
      body: null,
      method: "HEAD",
      mode: "cors",
      credentials: "include",
    });

    try {
      const httpResponse = await this.fetch(requestObj);
      return Object.fromEntries(httpResponse.headers.entries()) satisfies HeadersInit;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.warn("Request was aborted", { error, signal: this.controller.signal });
        this.controller.abort("Abort signal detected");
      } else {
        this.logger.error("Error received during fetch:", {
          error,
          signal: this.controller.signal,
        });
      }
      return;
    }
  }

  /**
   * Sends a POST request to the given URL with the given body and headers.
   * Handles request setup, error handling, and response caching.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the Response object or void if request fails
   *
   * @example
   * ```typescript
   * // Basic POST request
   * const response = await supplier.httpPost({
   *   path: '/api/v1/products',
   *   body: { name: 'Test Chemical' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // POST with custom headers
   * const response = await supplier.httpPost({
   *   path: '/api/v1/products',
   *   body: { name: 'Test Chemical' },
   *   headers: {
   *     'Authorization': 'Bearer token123',
   *     'Content-Type': 'application/json'
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // POST with custom host and params
   * const response = await supplier.httpPost({
   *   path: '/api/v1/products',
   *   host: 'api.example.com',
   *   body: { name: 'Test Chemical' },
   *   params: { version: '2' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Error handling
   * try {
   *   const response = await supplier.httpPost({ path: '/api/v1/products', body: { name: 'Test' } });
   *   if (response && response.ok) {
   *     const data = await response.json();
   *     console.log('Created:', data);
   *   }
   * } catch (err) {
   *   console.error('POST failed:', err);
   * }
   * ```
   * @source
   */
  protected async httpPost({
    path,
    host,
    body,
    params,
    headers,
  }: RequestOptions): Promise<Maybe<Response>> {
    this.logger.log("httpPost| Requesting:", {
      path,
      host,
      body,
      params,
      headers,
    });
    const method = "POST";
    const mode = "cors";
    const referrer = this.baseURL;
    const referrerPolicy = "strict-origin-when-cross-origin";
    const signal = this.controller.signal;
    const headersObj = new Headers({
      ...this.headers,
      ...headers,
    });

    let bodyStr = null;
    if (body instanceof FormData) {
      headersObj.set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
      bodyStr = body;
    } else if (typeof body === "string") {
      bodyStr = body;
    } else if (typeof body === "object" && body !== null) {
      bodyStr = JSON.stringify(body);
    }
    const url = this.href(path, params, host);

    const requestObj = new Request(url, {
      signal,
      headers: headersObj,
      referrer,
      referrerPolicy,
      body: bodyStr,
      method,
      mode,
      credentials: "include",
    });

    // Fetch the goods
    const httpResponse = await this.fetch(requestObj);

    if (!isHttpResponse(httpResponse) || !httpResponse.ok) {
      const badResponse = await httpResponse.text();
      this.logger.error("Invalid POST response: ", badResponse);
      throw new TypeError(`Invalid POST response: ${String(httpResponse)}`);
    }

    return httpResponse;
  }

  /**
   * Sends a POST request with the body encoded as `multipart/form-data`.
   * Converts the given object into a `FormData` instance (one field per
   * key/value pair) before delegating to `httpPost`.
   * @param options - The request configuration options. `body` must be a non-null object.
   * @returns Promise resolving to the Response object or void if the request fails
   * @throws TypeError - If `body` is not an object, or the response is not a valid HTTP response
   * @example
   * ```typescript
   * const response = await this.httpPostFormData({
   *   path: "/api/v1/cart",
   *   body: { productId: "123", quantity: "2" },
   * });
   * ```
   * @source
   */
  protected async httpPostFormData({
    path,
    host,
    body,
    params,
    headers,
  }: RequestOptions): Promise<Maybe<Response>> {
    if (typeof body !== "object" || body === null) {
      throw new TypeError("httpPostFormData| Body must be an object");
    }

    headers = {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    const formData = new FormData();
    for (const [key, value] of Object.entries(body)) {
      formData.append(key, value);
    }
    const httpResponse = await this.httpPost({ path, host, body: formData, params, headers });
    if (!isHttpResponse(httpResponse) || !httpResponse.ok) {
      const badResponse = await httpResponse?.text();
      this.logger.error("Invalid POST response: ", badResponse);
      throw new TypeError(`Invalid POST response: ${String(httpResponse)}`);
    }
    this.logger.log("httpPostFormData| Successfully sent POST request to:", path);
    return httpResponse;
  }
  /**
   * Sends a POST request and returns the response as a JSON object.
   *
   * @param params - The parameters for the POST request.
   * @returns The response from the POST request as a JSON object.
   *
   * @example
   * ```typescript
   * // Basic usage
   * const data = await supplier.httpPostJson({
   *   path: '/api/v1/products',
   *   body: { name: 'John' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // With custom headers and error handling
   * try {
   *   const data = await supplier.httpPostJson({
   *     path: '/api/v1/products',
   *     body: { name: 'John' },
   *     headers: { 'Authorization': 'Bearer token123' }
   *   });
   *   if (data) {
   *     console.log('Created:', data);
   *   }
   * } catch (err) {
   *   console.error('POST JSON failed:', err);
   * }
   * ```
   * @source
   */
  protected async httpPostJson({
    path,
    host,
    body,
    params,
    headers,
  }: RequestOptions): Promise<Maybe<JsonValue>> {
    const httpResponse = await this.httpPost({ path, host, body, params, headers });
    if (!isJsonResponse(httpResponse) || !httpResponse.ok) {
      this.logger.error("httpPostJson| Invalid POST response: ", {
        httpResponse,
        path,
        host,
        body,
        params,
        headers,
      });
      throw new TypeError(`httpPostJson| Invalid POST response: ${httpResponse}`);
    }
    return await httpResponse.json();
  }

  /**
   * Sends a POST request and returns the response as a HTML string.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the HTML response as a string or void if request fails
   * @throws TypeError - If the response is not valid HTML content
   *
   * @example
   * ```typescript
   * // Basic usage
   * const html = await supplier.httpPostHtml({
   *   path: '/api/v1/products',
   *   body: { name: 'John' }
   * });
   * ```
   * @source
   */
  protected async httpPostHtml({
    path,
    host,
    body,
    params,
    headers,
  }: RequestOptions): Promise<Maybe<string>> {
    const httpResponse = await this.httpPost({ path, host, body, params, headers });
    if (!isHtmlResponse(httpResponse)) {
      throw new TypeError(`httpPostHtml| Invalid POST response: ${httpResponse}`);
    }
    return await httpResponse.text();
  }

  /**
   * Sends a GET request to the given URL with the specified options.
   * Handles request setup, error handling, and response caching.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the Response object or void if request fails
   *
   * @example
   * ```typescript
   * // Basic GET request
   * const response = await supplier.httpGet({
   *   path: '/products/search',
   *   params: { query: 'sodium chloride' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // GET with custom headers
   * const response = await supplier.httpGet({
   *   path: '/products/search',
   *   headers: { 'Accept': 'application/json' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // GET with custom host
   * const response = await supplier.httpGet({
   *   path: '/products/search',
   *   host: 'api.example.com',
   *   params: { category: 'chemicals' }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Error handling
   * try {
   *   const response = await supplier.httpGet({ path: '/products/search' });
   *   if (response && response.ok) {
   *     const data = await response.json();
   *     console.log('Products:', data);
   *   }
   * } catch (err) {
   *   console.error('GET failed:', err);
   * }
   * ```
   * @source
   */
  protected async httpGet({
    path,
    params,
    headers,
    host,
    rethrowErrors,
  }: RequestOptions): Promise<Maybe<Response>> {
    // Check if the request has been aborted before proceeding
    if (this.controller.signal.aborted) {
      this.logger.warn("Request was aborted before fetch", {
        signal: this.controller.signal,
      });
      return;
    }

    const headersRaw = { ...this.headers };

    Object.assign(headersRaw, {
      accept: [
        "text/html",
        "application/xhtml+xml",
        "application/xml;q=0.9",
        "image/avif",
        "image/webp",
        "image/apng",
        "*/*;q=0.8",
      ].join(","),
      ...(headers ?? {}),
    });

    const requestObj = new Request(this.href(path, params, host), {
      signal: this.controller.signal,
      headers: new Headers(headersRaw),
      referrer: this.baseURL,
      referrerPolicy: "no-referrer",
      body: null,
      method: "GET",
      mode: "cors",
      credentials: "include",
      redirect: "follow",
    });

    try {
      // Fetch the goods
      const httpResponse = await this.fetch(requestObj.url, requestObj);

      const responseHeaders = Object.fromEntries(
        httpResponse.headers.entries(),
      ) satisfies HeadersInit;
      this.logger.debug("responseHeaders:", responseHeaders);
      this.logger.debug("responseHeaders.location:", responseHeaders.location);

      return httpResponse;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.warn("Request was aborted", { error, signal: this.controller.signal });
        this.controller.abort("Abort signal detected");
        return;
      }
      this.logger.error("Error received during fetch:", {
        error,
        signal: this.controller.signal,
      });
      // Opt-in: surface the failure (e.g. an HttpError 429) so the caller can apply
      // status-aware retry/backoff. Default behavior remains swallow-and-return-undefined.
      if (rethrowErrors) {
        throw error;
      }
      return;
    }
  }

  /**
   * Evaluation logging: run every candidate scorer against the same
   * query/title pair so we can compare which fuzz filter ranks this
   * supplier's results best. Emitted as one console.table per call so the
   * rows are side-by-side readable in devtools. Remove once we've picked
   * a scorer.
   * @param query - The query to compare the data against
   * @param data - The data to compare the query against
   * @returns void
   * @source
   * ```typescript
   * // Example usage
   * this.showFuzzScorerComparisonTable("sodium chloride", products);
   * ```
   */
  private showFuzzScorerComparisonTable<X>(query: string, data: X[]): void {
    const scorerComparison = data.map((obj, idx) => {
      const title = String(this.titleSelector(obj) ?? "");
      return {
        idx,
        title,
        distance: distance(query, title),
        ratio: ratio(query, title),
        partial_ratio: partial_ratio(query, title),
        token_sort_ratio: token_sort_ratio(query, title),
        token_set_ratio: token_set_ratio(query, title),
        token_similarity_sort_ratio: token_similarity_sort_ratio(query, title),
        partial_token_sort_ratio: partial_token_sort_ratio(query, title),
        partial_token_set_ratio: partial_token_set_ratio(query, title),
        partial_token_similarity_sort_ratio: partial_token_similarity_sort_ratio(query, title),
        WRatio: WRatio(query, title),
      };
    });

    console.table(scorerComparison);
  }

  /**
   * Scores a single string against the current search query (`this.query`)
   * using the active fuzz scorer — the user's `fuzzScorerOverride` when set,
   * otherwise the supplier's `fuzzScorer`. Returns a 0–100 similarity score
   * (higher is closer). Useful for suppliers that can only fuzz-match after a
   * secondary request reveals the real product name, e.g. when the search
   * index only exposes coarse category breadcrumbs.
   *
   * @param text - The text to score against `this.query`.
   * @returns A similarity score from 0 (no match) to 100 (identical).
   * @example
   * ```typescript
   * // this.query === "sodium borohydride"
   * this.fuzzyScore("Sodium borohydride, min 95%"); // ~90
   * this.fuzzyScore("Acetone"); // ~10
   * ```
   * @source
   */
  protected fuzzyScore(text: string): number {
    const activeScorer = this.fuzzScorerOverride ?? this.fuzzScorer;
    return activeScorer(this.query, text);
  }

  /**
   * Filters an array of data using fuzzy string matching to find items that closely match a query string.
   * Uses the WRatio algorithm from fuzzball for string similarity comparison.
   *
   * @param query - The search string to match against
   * @param data - Array of data objects to search through
   * @param minMatchPercentage - Minimum match percentage (0-100) for a match to be included (default: 55)
   * @returns Array of matching data objects with added fuzzy match metadata
   *
   * @example
   * ```typescript
   * // Example with simple string array
   * const products = [
   *   { title: "Sodium Chloride", price: 29.99 },
   *   { title: "Sodium Hydroxide", price: 39.99 },
   *   { title: "Potassium Chloride", price: 19.99 }
   * ];
   *
   * const matches = this.fuzzyFilter("sodium chloride", products);
   * // Returns: [
   * //   {
   * //     title: "Sodium Chloride",
   * //     price: 29.99,
   * //     _fuzz: { score: 100, idx: 0 }
   * //   },
   * //   {
   * //     title: "Sodium Hydroxide",
   * //     price: 39.99,
   * //     _fuzz: { score: 85, idx: 1 }
   * //   }
   * // ]
   *
   * // Example with custom minMatchPercentage
   * const strictMatches = this.fuzzyFilter("sodium chloride", products, 90);
   * // Returns only exact matches with score >= 90
   *
   * // Example with different data structure
   * const chemicals = [
   *   { name: "NaCl", formula: "Sodium Chloride" },
   *   { name: "NaOH", formula: "Sodium Hydroxide" }
   * ];
   *
   * // Override titleSelector to use formula field
   * this.titleSelector = (data) => data.formula;
   * const formulaMatches = this.fuzzyFilter("sodium chloride", chemicals);
   * ```
   * @source
   */
  protected fuzzyFilter<X>(
    query: string,
    data: X[],
    minMatchPercentage: number = this.minMatchPercentage,
  ): X[] {
    // User's Advanced-settings override wins over the subclass default.
    const activeScorer = this.fuzzScorerOverride ?? this.fuzzScorer;

    // console.log(
    //   `[fuzzyFilter] ${this.supplierName} query="${query}" — scorer comparison (cutoff=${minMatchPercentage})`,
    // );

    if (IS_DEV_BUILD) {
      this.showFuzzScorerComparisonTable(query, data);
    }

    if (this.fuzzyFilterRankOnly) {
      // Rank every candidate by score (no cutoff) and return them in score order; the
      // caller slices the top N. Avoids dropping clear matches whose ratio-style score
      // falls under minMatchPercentage purely because the title dwarfs the query.
      return extract(query, data, {
        scorer: activeScorer,
        processor: this.titleSelector,
        sortBySimilarity: true,
      }).map(([obj, score, idx]) => this.attachFuzz(obj, score, idx));
    }

    const results = extract(query, data, {
      scorer: activeScorer,
      processor: this.titleSelector,
      cutoff: minMatchPercentage,
      sortBySimilarity: true,
    }).reduce<FuzzyMatchResult<X>[]>((acc, [obj, score, idx]) => {
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

    this.logger.debug("[fuzzyFilter]", {
      supplierName: this.supplierName,
      query,
      minMatchPercentage,
      activeScorer,
      results,
    });

    // Get rid of any empty items that didn't match closely enough
    return results.filter((item) => !!item);
  }

  /**
   * Annotates an item with its fuzz score, returning it as a {@link FuzzyMatchResult}.
   * Mutates `obj` in place (rather than spreading) so non-plain inputs — e.g. DOM
   * `Element`s fuzzed by HTML-scraping suppliers — keep their prototype and methods. The
   * `as` is needed because a direct `Object.assign` on an unconstrained `X` widens it away.
   * @param obj - The matched item to annotate.
   * @param score - The fuzz score (0–100).
   * @param idx - The item's index in the source list.
   * @returns `obj` extended with `_fuzz` and `matchPercentage`.
   * @example
   * ```typescript
   * this.attachFuzz({ name: "NaCl" }, 92, 0);
   * // => { name: "NaCl", _fuzz: { score: 92, idx: 0 }, matchPercentage: 92 }
   * ```
   * @source
   */
  private attachFuzz<X>(obj: X, score: number, idx: number): FuzzyMatchResult<X> {
    const result = obj as FuzzyMatchResult<X>;
    result._fuzz = { score, idx };
    result.matchPercentage = score;
    return result;
  }

  /**
   * Advanced-search-aware companion to {@link fuzzyFilter}. Filters `data` using
   * the parsed query ({@link getAst}) so boolean operators (AND/OR/NOT) and
   * nesting are honored, and respects the `fuzzyFilteringDisabled` toggle.
   *
   * Behavior matrix:
   * - fuzzing on + plain query → delegates to {@link fuzzyFilter} (identical legacy path).
   * - fuzzing off + plain query → returns `data` unchanged (raw supplier results).
   * - fuzzing on + advanced query → fuzzy-scores each title against the AST, drops
   *   non-matches, ranks by score.
   * - fuzzing off + advanced query → applies the boolean predicate with
   *   case-insensitive substring matching, original order preserved.
   *
   * @param data - Array of raw search-result objects to filter.
   * @param minMatchPercentage - Minimum leaf match score when fuzzing is on.
   * @returns The filtered (and, when fuzzing, ranked) subset, each item tagged
   *   with `_fuzz`/`matchPercentage` like {@link fuzzyFilter}.
   * @example
   * ```typescript
   * // this.query === "Sodium OR Potassium"
   * const matches = this.fuzzyFilterAst(products);
   * ```
   * @source
   */
  protected fuzzyFilterAst<X>(
    data: X[],
    minMatchPercentage: number = this.minMatchPercentage,
  ): X[] {
    const parsed = this.getAst();

    if (!parsed.isAdvanced) {
      // Plain query: either the legacy fuzzy path, or no filtering when disabled.
      return this.fuzzyFilteringDisabled
        ? data
        : this.fuzzyFilter(parsed.raw.trim(), data, minMatchPercentage);
    }

    const scorer = this.fuzzScorerOverride ?? this.fuzzScorer;
    // Rank-only floors the leaf score at 0 so predicate-matching items are never dropped
    // for a low fuzz score; the sort below still ranks them. Otherwise enforce the cutoff.
    const threshold = this.fuzzyFilteringDisabled
      ? 1
      : this.fuzzyFilterRankOnly
        ? 0
        : minMatchPercentage;
    const fuzzyWords = !this.fuzzyFilteringDisabled;

    const matched = data.reduce<FuzzyMatchResult<X>[]>((acc, obj, idx) => {
      const title = this.titleSelector(obj) ?? "";
      const score = scoreAstMatch(title, parsed.ast, { scorer, threshold, fuzzyWords });
      if (score === null) {
        return acc;
      }
      acc.push(this.attachFuzz(obj, score, idx));
      return acc;
    }, []);

    // Rank by relevance when fuzzing; preserve backend order when disabled.
    if (!this.fuzzyFilteringDisabled) {
      matched.sort((a, b) => (b.matchPercentage ?? 0) - (a.matchPercentage ?? 0));
    }
    return matched;
  }

  /**
   * Advanced-search-aware, keep-or-drop companion to {@link fuzzyScore} for
   * suppliers that re-filter a single title after a detail fetch (e.g. LiMac).
   * Returns the score to keep the item, or `null` to drop it, honoring both the
   * parsed query and the `fuzzyFilteringDisabled` toggle:
   * - fuzzing off → plain query keeps everything (score 100); advanced query
   *   keeps items satisfying the boolean predicate by substring match.
   * - fuzzing on → plain query keeps items scoring at/above `minMatchPercentage`;
   *   advanced query keeps items satisfying the predicate with fuzzy leaf scores.
   *
   * @param text - The text (e.g. a detail-page product name) to score.
   * @returns A 0–100 score to keep the item, or `null` to drop it.
   * @example
   * ```typescript
   * // this.query === "acid AND NOT boric"
   * this.fuzzyScoreAst("Sulfuric acid"); // a number
   * this.fuzzyScoreAst("Boric acid");    // null
   * ```
   * @source
   */
  protected fuzzyScoreAst(text: string): number | null {
    const parsed = this.getAst();

    if (!parsed.isAdvanced) {
      if (this.fuzzyFilteringDisabled) {
        return 100;
      }
      const score = this.fuzzyScore(text);
      return score >= this.minMatchPercentage ? score : null;
    }

    const scorer = this.fuzzScorerOverride ?? this.fuzzScorer;
    const threshold = this.fuzzyFilteringDisabled ? 1 : this.minMatchPercentage;
    return scoreAstMatch(text, parsed.ast, {
      scorer,
      threshold,
      fuzzyWords: !this.fuzzyFilteringDisabled,
    });
  }

  /**
   * Derives the backend search terms for a keyword-only supplier from an
   * advanced query: one representative term per positive OR-group (the longest —
   * most selective — token of each AND-group), de-duplicated and capped at
   * {@link maxFallbackQueries}. Returns an empty array when there are no positive
   * terms (e.g. a purely negative query), in which case the caller falls back to
   * a single raw search.
   *
   * @returns The de-duplicated, capped list of backend search terms.
   * @example
   * ```typescript
   * // this.query === "(Sodium OR Potassium) AND Hydroxide"
   * this.deriveFallbackTerms(); // ["Hydroxide", "Hydroxide"] -> ["Hydroxide"] (deduped)
   * ```
   * @source
   */
  protected deriveFallbackTerms(): string[] {
    const groups = extractOrGroups(this.getAst().ast);

    // How many AND-groups each term appears in — a term shared across groups (a
    // common factor, e.g. "Hydroxide" in "(Sodium OR Potassium) AND Hydroxide")
    // covers more of the query in fewer requests, so prefer it; break ties by
    // length (more selective). Picking one representative term per group keeps
    // each request's result set a superset of that group's matches.
    const frequency = new Map<string, number>();
    for (const group of groups) {
      for (const term of new Set(group)) {
        frequency.set(term, (frequency.get(term) ?? 0) + 1);
      }
    }

    const terms = groups
      .map(
        (group) =>
          group.slice().sort((a, b) => {
            const byFrequency = (frequency.get(b) ?? 0) - (frequency.get(a) ?? 0);
            return byFrequency !== 0 ? byFrequency : b.length - a.length;
          })[0],
      )
      .filter((term): term is string => Boolean(term));

    return [...new Set(terms)].slice(0, this.maxFallbackQueries);
  }

  /**
   * Abstract method to select the title from the initial raw search data.
   * This method should be implemented by each supplier to handle their specific
   * data structure.
   *
   * The parameter is typed as `unknown` because callers (`fuzzyFilter`,
   * `groupVariants`, `showFuzzScorerComparisonTable`) accept arbitrary `X[]`
   * arrays — subclasses narrow with a type guard or cast (with a comment
   * explaining why the cast is safe) to their parsed search-result type.
   *
   * @param data - The raw data object to extract the title from
   * @returns The title string to use for fuzzy matching, or undefined
   * @abstract
   * @example
   * ```typescript
   * // Subclass narrows via cast (commented why safe):
   * protected titleSelector(data: unknown): Maybe<string> {
   *   // Safe: queryProducts only stores Cheerio<Element> into queryResults.
   *   return (data as Cheerio<Element>).text();
   * }
   * ```
   * @source
   */
  protected abstract titleSelector(data: unknown): Maybe<string>;

  /**
   * Abstract method to derive a stable, unique key for a product from its raw
   * search-result item. Every supplier must implement it — the returned string
   * (an id, uuid, sku, gid, or, for HTML-only sites, a scraped id or href) is
   * combined with the supplier name (via `getProductIdentityKey`) to key
   * both the product-detail cache and the "Ignore Product" exclusion store.
   *
   * The key must be derivable from the **query-phase** item so it stays stable
   * across the query→detail transition, and must be unique per product within
   * the supplier's catalog. Suppliers stamp it onto each builder at parse time
   * via `ProductBuilder.setCacheKey`; the base reads the stamped value
   * downstream.
   *
   * The parameter is declared `unknown` here for the same reason as
   * {@link titleSelector}; subclasses override it with their concrete
   * parsed search-result type (no cast needed), e.g. `MyItem` below.
   *
   * @param data - The raw search-result item to derive the key from
   * @returns A non-empty string uniquely identifying the product
   * @abstract
   * @example
   * ```typescript
   * // JSON API supplier:
   * protected getUniqueProductKey(data: MyItem): string {
   *   return String(data.id);
   * }
   * ```
   * @source
   */
  protected abstract getUniqueProductKey(data: unknown): string;

  /**
   * Makes an HTTP GET request and returns the response as a string.
   * Handles request configuration, error handling, and HTML parsing.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the HTML response as a string or void if request fails
   * @throws TypeError - If the response is not valid HTML content
   *
   * @example
   * ```typescript
   * // Basic GET request
   * const html = await this.httpGetHtml({
   *   path: "/api/products",
   *   params: { search: "sodium" }
   * });
   *
   * // GET request with custom headers
   * const html = await this.httpGetHtml({
   *   path: "/api/products",
   *   headers: {
   *     "Authorization": "Bearer token123",
   *     "Accept": "text/html"
   *   }
   * });
   *
   * // GET request with custom host
   * const html = await this.httpGetHtml({
   *   path: "/products",
   *   host: "api.supplier.com",
   *   params: { limit: 10 }
   * });
   * ```
   * @source
   */
  protected async httpGetHtml({
    path,
    params,
    headers,
    host,
  }: RequestOptions): Promise<Maybe<string>> {
    const httpResponse = await this.httpGet({ path, params, headers, host });
    if (!isHtmlResponse(httpResponse)) {
      throw new TypeError(`httpGetHtml| Invalid GET response: ${httpResponse}`);
    }
    return await httpResponse.text();
  }

  /**
   * Makes an HTTP GET request and returns the response as parsed JSON.
   * Handles request configuration, error handling, and JSON parsing.
   *
   * @param options - The request configuration options
   * @returns Promise resolving to the parsed JSON response or void if request fails
   * @throws TypeError - If the response is not valid JSON content
   *
   * @example
   * ```typescript
   * // Basic GET request
   * const data = await supplier.httpGetJson({ path: '/api/products', params: { search: 'sodium' } });
   * ```
   *
   * @example
   * ```typescript
   * // GET request with custom headers
   * const data = await supplier.httpGetJson({
   *   path: '/api/products',
   *   headers: {
   *     'Authorization': 'Bearer token123',
   *     'Accept': 'application/json'
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // GET request with custom host
   * const data = await supplier.httpGetJson({
   *   path: '/products',
   *   host: 'api.supplier.com',
   *   params: { limit: 10 }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Error handling
   * try {
   *   const data = await supplier.httpGetJson({ path: '/api/products' });
   *   if (data) {
   *     console.log('Products:', data);
   *   }
   * } catch (error) {
   *   console.error('Failed to fetch products:', error);
   * }
   * ```
   * @source
   */
  protected async httpGetJson({
    path,
    params,
    headers = {},
    host,
  }: RequestOptions): Promise<Maybe<JsonValue>> {
    if (
      typeof headers?.accept === "undefined" ||
      !Array.isArray(headers?.accept) ||
      !headers?.accept.includes("application/json")
    ) {
      headers.accept = ["application/json", "text/plain", "*/*"].join(",");
    }
    const httpRequest = await this.httpGet({ path, params, headers, host });

    if (!isJsonResponse(httpRequest)) {
      const badResponse = isHttpResponse(httpRequest) ? await httpRequest.text() : undefined;
      this.logger.error("Invalid HTTP GET JSON response:", {
        badResponse,
        httpRequest,
        path,
        params,
        headers,
        host,
      });
      return;
    }

    return await httpRequest.json();
  }

  /**
   * Executes a product search query with caching support.
   * First checks the cache for existing results, then falls back to the actual query if needed.
   * The limit parameter is only used for the actual query and doesn't affect caching.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to return (defaults to instance limit)
   * @returns Promise resolving to array of product builders or void if search fails
   *
   * @example
   * ```typescript
   * // Basic usage with default limit
   * const results = await supplier.queryProductsWithCache("acetone");
   * if (results) {
   *   console.log(`Found ${results.length} products`);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // With custom limit
   * const results = await supplier.queryProductsWithCache("acetone", 10);
   * if (results) {
   *   for (const builder of results) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price);
   *   }
   * }
   * ```
   * @source
   */
  protected async queryProductsWithCache(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<T>[] | void> {
    // Check cache first (processed product data)
    this.logger.debug(
      "queryProductsWithCache: called for",
      this.supplierName,
      "query:",
      query,
      "limit:",
      limit,
    );
    const key = this.cache.generateCacheKey(query);
    const cached = await this.cache.getCachedQueryEntry(key);
    this.logger.debug("queryProductsWithCache: cache hit:", !!cached, "key:", key);
    if (cached) {
      const cachedLimit = cached.__cacheMetadata.limit;
      const insufficientLimit = typeof cachedLimit === "number" && cachedLimit < limit;
      if (!insufficientLimit) {
        this.logger.debug("Returning cached query results");
        // Re-initialize product builders from cached processed data
        return ProductBuilder.createFromCache<T>(this.baseURL, cached.data.slice(0, limit));
      }
      // Cached entry was built with a smaller limit than requested — drop it and re-query below.
      this.logger.debug("Invalidating query cache due to insufficient limit", {
        cachedLimit,
        requestedLimit: limit,
      });
      await deleteSupplierQueryCacheEntry(key);
    }

    // If not in cache, perform the actual query. Run setup first so any
    // subclass state it mutates (headers, localStorage, tokens, etc.) is
    // in place before `queryProducts` reads it. Memoized, so this is cheap
    // on repeat calls within the same supplier instance.
    await this.ensureSetup();
    const results = await this.queryProductsResolved(query, limit);
    if (results) {
      // Store processed results in cache (dumped/serialized form) and the limit used
      await this.cache.cacheQueryResults(
        query,
        results.map((b) => b.dump()),
        limit,
      );
    }
    return results;
  }

  /**
   * Resolves the supplier's `queryProducts` for the current search, applying the
   * keyword-only advanced-search fallback when needed. For a plain query, or for
   * a supplier that handles boolean queries natively
   * ({@link supportsNativeAdvancedSearch}), this is a single `queryProducts`
   * call. For an advanced query on a keyword-only backend, it issues one search
   * per derived OR-group term ({@link deriveFallbackTerms}) and unions the
   * results, deduping by product URL/ID. Each `queryProducts` batch already
   * enforces the full boolean predicate via {@link fuzzyFilterAst}, so the union
   * is the set of products matching the whole query. Honors
   * `httpRequestHardLimit`; the fetches run inside `execute()`'s existing
   * `maxAllowableSearchTime` race so an aborted controller cancels them.
   *
   * @param query - The raw search query.
   * @param limit - The per-supplier result limit.
   * @returns The (possibly unioned) product builders, or void.
   * @source
   */
  protected async queryProductsResolved(
    query: string,
    limit: number,
  ): Promise<ProductBuilder<T>[] | void> {
    const parsed = this.getAst();
    if (!parsed.isAdvanced || this.supportsNativeAdvancedSearch) {
      return this.queryProducts(query, limit);
    }

    const terms = this.deriveFallbackTerms();
    if (terms.length <= 1) {
      // Nothing to union (single positive term, or a purely negative query):
      // run the raw query once and let fuzzyFilterAst enforce the predicate.
      return this.queryProducts(terms[0] ?? query, limit);
    }

    const seen = new Set<string>();
    const union: ProductBuilder<T>[] = [];
    for (const term of terms) {
      if (this.requestCount >= this.httpRequestHardLimit) {
        this.logger.warn("queryProductsResolved: httpRequestHardLimit reached, stopping fallback", {
          term,
          requestCount: this.requestCount,
        });
        break;
      }
      const batch = await this.queryProducts(term, limit);
      if (!batch) {
        continue;
      }
      for (const builder of batch) {
        const key = String(builder.get("url") ?? builder.get("id") ?? builder.get("title") ?? "");
        if (key === "" || seen.has(key)) {
          continue;
        }
        seen.add(key);
        union.push(builder);
      }
    }
    return union.length > 0 ? union : undefined;
  }

  /**
   * Arms the optional per-supplier search-time budget raced by {@link execute}.
   *
   * When `maxAllowableSearchTime` is positive, returns a promise that resolves to `sentinel`
   * once the budget elapses. On elapse it also aborts `this.controller` (cancelling in-flight
   * and future fetches) and logs a warning; {@link execute} races this promise against the
   * outstanding product-detail fetches, and when it wins the race flushes any not-yet-yielded
   * products with their basic query-phase data so those rows still show.
   *
   * It is deliberately a race sentinel rather than an `AbortSignal.timeout()` on the fetches:
   * a bare abort signal would only reject the detail fetches, dropping those rows instead of
   * surfacing their basic data. The returned `handle` must be passed to `clearTimeout` when the
   * search settles so the timer doesn't leak.
   *
   * @param sentinel - Unique symbol the returned promise resolves to on timeout.
   * @returns `{ promise, handle }`; both `undefined` when no budget is set (`maxAllowableSearchTime <= 0`).
   * @example
   * ```typescript
   * const SEARCH_TIMEOUT = Symbol("searchTimeout");
   * const { promise, handle } = this.armSearchTimeout(SEARCH_TIMEOUT);
   * try {
   *   const winner = await Promise.race(promise ? [task, promise] : [task]);
   *   if (winner === SEARCH_TIMEOUT) { ... flush collected products ... }
   * } finally {
   *   if (handle !== undefined) clearTimeout(handle);
   * }
   * ```
   * @source
   */
  private armSearchTimeout<S extends symbol>(
    sentinel: S,
  ): { promise?: Promise<S>; handle?: ReturnType<typeof setTimeout> } {
    if (this.maxAllowableSearchTime <= 0) {
      return {};
    }
    let handle: ReturnType<typeof setTimeout> | undefined;
    const promise = new Promise<S>((resolve) => {
      handle = setTimeout(() => {
        this.logger.warn(
          `Search exceeded maxAllowableSearchTime (${this.maxAllowableSearchTime}ms); ` +
            `aborting outstanding requests and returning collected results`,
          { supplier: this.supplierName },
        );
        this.controller.abort(
          `Search exceeded maxAllowableSearchTime (${this.maxAllowableSearchTime}ms)`,
        );
        resolve(sentinel);
      }, this.maxAllowableSearchTime);
    });
    return { promise, handle };
  }

  /**
   * Executes the supplier's search query and returns the results.
   * This method will execute all results concurrently (to the limits set in the supplier
   * class), and resolve to an array of product objects.
   *
   * @remarks
   * This method is used to execute the supplier's search query and return the results.
   * @returns Promise resolving to an array of products
   * @source
   */
  public async *execute(): AsyncGenerator<T, void, undefined> {
    // setup() is not called eagerly here — it's run lazily from the
    // phase-boundary gates inside `queryProductsWithCache` and
    // `getProductData` / `getProductDataWithCache`. A fully cached search
    // never reaches those gates, so setup's token/cookie/permission
    // requests are skipped entirely.
    // Snapshot the user's ignore list once per search. Any product whose
    // exclusion key matches an entry here is dropped before the detail phase
    // runs (see the filter after queryProductsWithCache below).
    this.excludedProductKeys = await loadExcludedProductKeys();
    // Over-fetch by the number of previously-ignored products belonging to
    // this supplier so that, in the worst case where every ignored product
    // appears in the top of the query result set, we still end up with
    // `this.limit` survivors after filtering. The queryProductsWithCache
    // cache invalidates itself when the requested limit exceeds the cached
    // limit, so this is safe.
    const excludedForSupplier = await countExcludedProductsForSupplier(this.supplierName);
    const fetchLimit = this.limit + excludedForSupplier;
    incrementSearchQueryCount(this.supplierName);

    // Optional per-supplier search-time budget; see armSearchTimeout. When it elapses the
    // race below wins via SEARCH_TIMEOUT and flushes any not-yet-yielded products.
    const SEARCH_TIMEOUT = Symbol("searchTimeout");
    const { promise: timeoutPromise, handle: timeoutHandle } =
      this.armSearchTimeout(SEARCH_TIMEOUT);

    try {
      const results = await this.queryProductsWithCache(this.query, fetchLimit);
      if (!results || results.length === 0) {
        this.logger.log(`No query results found`);
        return;
      }
      // Drop any products the user has ignored, then slice back down to the
      // user-visible limit. Uses the same dual-read (identity + legacy URL) as
      // getProductData/partitionForBatch so the check is consistent wherever it
      // fires first.
      const survivors: ProductBuilder<T>[] = [];
      for (const builder of results) {
        if (survivors.length >= this.limit) break;
        if (this.isExcluded(builder)) {
          this.logger.debug("Skipping excluded product (pre-detail)", {
            url: builder.get("url"),
          });
          continue;
        }
        survivors.push(builder);
      }
      this.products = survivors;
      const queue = new Queue(this.maxConcurrentRequests, this.minConcurrentCycle);

      // Each task fetches a product's detail data and finishes it, tagged with its index so the
      // yield loop can track which products are still outstanding when the budget elapses.
      const pending = new Map<number, Promise<{ index: number; finished: Maybe<T> }>>();
      this.products.forEach((product, index) => {
        pending.set(
          index,
          queue.run(async () => {
            // If the budget already elapsed, skip the (now-aborted) detail fetch — the timeout
            // handler below emits this product's basic data directly.
            if (this.controller.signal.aborted) {
              return { index, finished: undefined };
            }
            try {
              const builder = await this.getProductData(product);
              const finished = builder ? await this.finishProduct(builder) : undefined;
              return { index, finished };
            } catch (e: unknown) {
              this.logger.error("Error processing product", { error: e, product });
              incrementParseError(this.supplierName);
              return { index, finished: undefined };
            }
          }),
        );
      });

      // As each task resolves, yield the product. Race against the optional search-time budget;
      // when it elapses, emit every not-yet-yielded product with its basic (query-phase) data so
      // the rows still show — the enrichment for those simply wasn't cached, so a later search
      // (served from the query cache) re-fetches their detail data.
      const yielded = new Set<number>();
      while (pending.size > 0) {
        const result = await Promise.race(
          timeoutPromise ? [...pending.values(), timeoutPromise] : [...pending.values()],
        );

        if (result === SEARCH_TIMEOUT) {
          for (let index = 0; index < this.products.length; index++) {
            if (yielded.has(index)) continue;
            // The builder is enriched in place, so this carries whatever detail data was set
            // before the abort, falling back to the basic query-phase fields otherwise.
            const finished = await this.finishProduct(this.products[index]);
            if (finished) {
              yield finished;
            }
          }
          break;
        }

        pending.delete(result.index);
        yielded.add(result.index);
        if (result.finished) {
          yield result.finished;
        }
      }
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Abstract method that must be implemented by supplier classes to perform the actual product search.
   * This is the core method that each supplier implements to query their specific API or website.
   *
   * @remarks
   * The implementation should:
   * 1. Make the necessary HTTP requests to the supplier's API/website
   * 2. Parse the response into initial product data
   * 3. Create ProductBuilder instances for each result
   * 4. Set basic product information (title, URL, etc.)
   *
   * The method should not fetch detailed product data - that is handled by getProductData.
   *
   * @todo Whats the difference between this and the finish method? Forgot why I created the other.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to return
   * @returns Promise resolving to array of ProductBuilder instances or void if search fails
   *
   * @example
   * ```typescript
   * // Example implementation for a JSON API supplier
   * protected async queryProducts(
   *   query: string,
   *   limit: number
   * ): Promise<ProductBuilder<Product>[] | void> {
   *   const response = await this.httpGetJson({
   *     path: '/api/search',
   *     params: {
   *       q: query,
   *       limit,
   *       format: 'json'
   *     }
   *   });
   *
   *   if (!response?.items) return;
   *
   *   return response.items.map(item => {
   *     const builder = new ProductBuilder<Product>(this.baseURL);
   *     builder
   *       .setBasicInfo(item.title, item.url, this.supplierName)
   *       .setPricing(item.price, item.currency)
   *       .setQuantity(item.quantity, item.uom);
   *     return builder;
   *   });
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Example implementation for an HTML scraping supplier
   * protected async queryProducts(
   *   query: string,
   *   limit: number
   * ): Promise<ProductBuilder<Product>[] | void> {
   *   const html = await this.httpGetHtml({
   *     path: '/search',
   *     params: { q: query }
   *   });
   *
   *   if (!html) return;
   *
   *   const $ = cheerio.load(html);
   *   const products: ProductBuilder<Product>[] = [];
   *
   *   $('.product-item').each((_, el) => {
   *     if (products.length >= limit) return false;
   *
   *     const $el = $(el);
   *     const builder = new ProductBuilder<Product>(this.baseURL);
   *     builder
   *       .setBasicInfo(
   *         $el.find('.title').text(),
   *         $el.find('a').attr('href'),
   *         this.supplierName
   *       )
   *       .setPricing(
   *         $el.find('.price').text()
   *       );
   *     products.push(builder);
   *   });
   *
   *   return products;
   * }
   * ```
   * @source
   */
  protected abstract queryProducts(
    query: string,
    limit: number,
  ): Promise<ProductBuilder<T>[] | void>;

  /**
   * Finalizes a partial product by adding computed properties and validating the result.
   * This method:
   * 1. Validates the product has minimal required properties
   * 2. Computes USD price if product is in different currency
   * 3. Calculates base quantity using the unit of measure
   * 4. Ensures the product URL is absolute
   *
   * @param product - The ProductBuilder instance containing the partial product to finalize
   * @returns Promise resolving to a complete Product object or void if validation fails
   *
   * @example
   * ```typescript
   * // Example with a valid partial product
   * const builder = new ProductBuilder<Product>(this.baseURL);
   * builder
   *   .setBasicInfo("Sodium Chloride", "/products/nacl", "ChemSupplier")
   *   .setPricing(29.99, "USD", "$")
   *   .setQuantity(500, "g");
   *
   * const finishedProduct = await this.finishProduct(builder);
   * if (finishedProduct) {
   *   console.log("Finalized product:", {
   *     title: finishedProduct.title,
   *     price: finishedProduct.price,
   *     quantity: finishedProduct.quantity,
   *     uom: finishedProduct.uom,
   *     usdPrice: finishedProduct.usdPrice,
   *     baseQuantity: finishedProduct.baseQuantity
   *   });
   * }
   *
   * // Example with an invalid partial product
   * const invalidBuilder = new ProductBuilder<Product>(this.baseURL);
   * invalidBuilder.setBasicInfo("Sodium Chloride", "/products/nacl", "ChemSupplier");
   * // Missing required fields
   *
   * const invalidProduct = await this.finishProduct(invalidBuilder);
   * if (!invalidProduct) {
   *   console.log("Failed to finalize product - missing required fields");
   * }
   * ```
   * @source
   */
  protected async finishProduct(product: ProductBuilder<T>): Promise<Maybe<T>> {
    if (!isMinimalProduct(product.dump())) {
      this.logger.warn("Unable to finish product - Minimum data not set", { product });
      return;
    }

    // Dev guard: every builder should carry a stamped `cacheKey` (set at parse
    // time via `setCacheKey(getUniqueProductKey(item))`). A missing key means a
    // supplier implemented `getUniqueProductKey` but forgot to stamp — it would
    // silently disable per-product caching and precise exclusion for that
    // product. Surface it loudly in dev/tests.
    if (IS_DEV_BUILD && product.get("cacheKey") == null) {
      this.logger.error("finishProduct| product is missing a stamped cacheKey", {
        supplier: this.supplierName,
        url: product.get("url"),
      });
    }

    // Set the country and shipping scope of the supplier
    // have different restrictions on different products or countries.
    product.setSupplierCountry(this.country);
    product.setSupplierShipping(this.shipping);

    if (this.paymentMethods.length > 0) {
      product.setSupplierPaymentMethods(this.paymentMethods);
    }

    const built = await product.build();
    return built;
  }

  /**
   * The stable per-product cache/exclusion key for a builder: the identity
   * stamped on it at parse time ({@link getUniqueProductKey} →
   * `setCacheKey`), hashed with the supplier name via
   * `getProductIdentityKey`. Returns undefined when no identity was
   * stamped (so callers can skip the identity cache/exclusion path).
   *
   * @param product - The product builder
   * @returns The identity cache key, or undefined when unstamped
   * @example
   * ```typescript
   * const key = this.productIdentityKey(builder); // md5({key, supplier}) or undefined
   * ```
   * @source
   */
  protected productIdentityKey(product: ProductBuilder<T>): string | undefined {
    const identity = product.get("cacheKey");
    if (typeof identity === "string" && identity.length > 0) {
      return this.cache.getProductIdentityCacheKey(identity);
    }
    return undefined;
  }

  /**
   * Whether a product is on the user's ignore list, matched by its identity key
   * ({@link productIdentityKey}) — the same key the "Ignore Product" action
   * writes.
   *
   * @param product - The product builder to check
   * @returns true if the product matches an ignore-list entry
   * @example
   * ```typescript
   * if (this.isExcluded(builder)) continue; // skip ignored product
   * ```
   * @source
   */
  protected isExcluded(product: ProductBuilder<T>): boolean {
    const identityKey = this.productIdentityKey(product);
    return identityKey !== undefined && this.excludedProductKeys.has(identityKey);
  }

  /**
   * Partitions query-phase builders for a **batch** supplier (one that enriches
   * details up front rather than per-product in {@link getProductData}). Runs a
   * three-way split: **ignored** products are dropped from both results;
   * **cache hits** (found in the product-detail cache by their stamped
   * identity) are hydrated in place via `setData` and kept in `survivors` but
   * excluded from `misses`; everything else is a **miss**, kept in both. The
   * caller enriches only `misses`, then caches them, and returns `survivors`.
   *
   * Skips the cache lookup entirely when {@link skipProductDetailCache} is true
   * (pure-search suppliers), so those still drop ignored products but treat
   * every survivor as needing no enrichment.
   *
   * @param products - The query-phase builders (each already `setCacheKey`-stamped)
   * @returns `{ survivors, misses }` — see above
   * @example
   * ```typescript
   * const { survivors, misses } = await this.partitionForBatch(builders);
   * await this.enrichVariants(misses);
   * await this.cacheProductBuilders(misses);
   * return survivors;
   * ```
   * @source
   */
  protected async partitionForBatch(
    products: ProductBuilder<T>[],
  ): Promise<{ survivors: ProductBuilder<T>[]; misses: ProductBuilder<T>[] }> {
    const survivors: ProductBuilder<T>[] = [];
    const misses: ProductBuilder<T>[] = [];
    for (const product of products) {
      if (this.isExcluded(product)) {
        continue;
      }
      survivors.push(product);
      if (this.skipProductDetailCache) {
        continue;
      }
      const key = this.productIdentityKey(product);
      const cached = key ? await this.cache.getCachedProductData(key) : undefined;
      if (isCachedProductData<T>(cached)) {
        product.setData(cached);
      } else {
        misses.push(product);
      }
    }
    return { survivors, misses };
  }

  /**
   * Writes each enriched builder to the product-detail cache under its stamped
   * identity key. No-ops for suppliers with {@link skipProductDetailCache} true,
   * for aborted searches, and for builders {@link shouldCacheProductData}
   * rejects (e.g. a fetch that hit a `noCacheStatusCode`). Used by batch
   * suppliers after enriching their `misses`.
   *
   * @param products - The enriched builders to persist
   * @returns A promise that resolves once all writes complete
   * @example
   * ```typescript
   * await this.cacheProductBuilders(misses);
   * ```
   * @source
   */
  protected async cacheProductBuilders(products: ProductBuilder<T>[]): Promise<void> {
    if (this.skipProductDetailCache || this.controller.signal.aborted) {
      return;
    }
    await Promise.all(
      products.map(async (product) => {
        const key = this.productIdentityKey(product);
        if (key && this.shouldCacheProductData(product)) {
          await this.cache.cacheProductData(key, product.dump());
        }
      }),
    );
  }

  /**
   * Takes in either a relative or absolute URL and returns an absolute URL. This is useful for when you aren't
   * sure if the link (retrieved from parsed text, a setting, an element, an anchor value, etc) is absolute or
   * not. Using relative links will result in http://chrome-extension://... being added to the link.
   *
   * @param path - URL object or string
   * @param params - The parameters to add to the URL.
   * @param host - The host to use for overrides (eg: needing to call a different host for an API)
   * @returns absolute URL
   * @example
   * ```typescript
   * this.href('/some/path')
   * // https://supplier_base_url.com/some/path
   *
   * this.href('https://supplier_base_url.com/some/path', null, 'another_host.com')
   * // https://another_host.com/some/path
   *
   * this.href('/some/path', { a: 'b', c: 'd' }, 'another_host.com')
   * // http://another_host.com/some/path?a=b&c=d
   *
   * this.href('https://supplier_base_url.com/some/path')
   * // https://supplier_base_url.com/some/path
   *
   * this.href(new URL('https://supplier_base_url.com/some/path'))
   * // https://supplier_base_url.com/some/path
   *
   * this.href('/some/path', { a: 'b', c: 'd' })
   * // https://supplier_base_url.com/some/path?a=b&c=d
   *
   * this.href('https://supplier_base_url.com/some/path', new URLSearchParams({ a: 'b', c: 'd' }))
   * // https://supplier_base_url.com/some/path?a=b&c=d
   * ```
   * @source
   */
  protected href(path: string | URL, params?: Maybe<RequestParams>, host?: string): string {
    const href = new URL(path, this.baseURL);

    if (host) {
      href.host = host;
    }

    if (params && Object.keys(params).length > 0) {
      href.search = this.buildSearchParams(params).toString();
    }

    return String(href);
  }

  /**
   * Recursively serializes an object into `URLSearchParams`, encoding nested
   * objects with bracket notation (`parent[child]=value`). Fixes the case that
   * `new URLSearchParams(obj)` mishandles — it stringifies a nested object to
   * `"[object Object]"` — so a params object with nested filters serializes
   * correctly. Primitive values (and arrays, which serialize comma-joined like
   * `URLSearchParams` does) are appended directly.
   *
   * @param obj - The params object to serialize
   * @param params - The `URLSearchParams` to append into (defaults to a fresh instance)
   * @param prefix - The key prefix used while recursing into nested objects
   * @returns The populated `URLSearchParams`
   * @example
   * ```typescript
   * this.buildSearchParams({ q: "acid", filter: { size: "500g" } }).toString();
   * // "q=acid&filter%5Bsize%5D=500g"  (i.e. filter[size]=500g)
   * ```
   * @source
   */
  protected buildSearchParams(
    obj: Record<string, unknown>,
    params: URLSearchParams = new URLSearchParams(),
    prefix: string = "",
  ): URLSearchParams {
    for (const [key, value] of Object.entries(obj)) {
      // Bracket-nest the key as depth grows: parent[child][grandchild]...
      const formKey = prefix ? `${prefix}[${key}]` : key;
      if (isPopulatedObject(value)) {
        this.buildSearchParams(value, params, formKey);
      } else {
        params.append(formKey, String(value));
      }
    }
    return params;
  }

  /**
   * Retrieves detailed product data for a given product builder.
   * Handles caching of product data and fetches fresh data if not cached.
   *
   * @param product - The ProductBuilder instance to get data for
   * @returns Promise resolving to the updated ProductBuilder or void if fetch fails
   *
   * @example
   * ```typescript
   * const builder = new ProductBuilder<Product>(this.baseURL);
   * builder.setBasicInfo("Acetone", "/products/acetone", "ChemSupplier");
   *
   * const updatedBuilder = await supplier.getProductData(builder);
   * if (updatedBuilder) {
   *   const product = await updatedBuilder.build();
   *   console.log("Product details:", product);
   * }
   * ```
   * @source
   */
  protected async getProductData(product: ProductBuilder<T>): Promise<ProductBuilder<T> | void> {
    const url = product.get("url");
    if (typeof url !== "string") {
      this.logger.error("[SupplierBase > getProductData] Invalid URL in product:", { url });
      return undefined;
    }
    // Skip products the user has ignored (matched by identity key).
    if (this.isExcluded(product)) {
      this.logger.debug("[SupplierBase > getProductData] Skipping excluded product", {
        url,
        supplierName: this.supplierName,
      });
      return undefined;
    }
    // Key the product-detail cache by the supplier's stable identity, stamped on
    // the builder at parse time. Absent only if a supplier failed to stamp one,
    // in which case this product simply isn't cached.
    const cacheKey = this.productIdentityKey(product);
    this.logger.debug("[SupplierBase > getProductData] Product detail cache key:", cacheKey, {
      url,
    });
    try {
      if (!this.skipProductDetailCache && cacheKey) {
        const cachedData = await this.cache.getCachedProductData(cacheKey);
        if (isCachedProductData<T>(cachedData)) {
          product.setData(cachedData);
          return product;
        }
      }
      // Cache miss (or caching skipped): run setup (memoized) so any state
      // subclasses rely on is ready before the fetcher reads it, then fetch.
      await this.ensureSetup();
      let resultBuilder: ProductBuilder<T> | void = undefined;
      try {
        resultBuilder = await this.getProductDataWithCache(product, this.getProductData);
      } catch (err: unknown) {
        this.logger.error("[SupplierBase > getProductData] Error in product detail fetcher:", err);
        incrementParseError(this.supplierName);
        return undefined;
      }
      // Don't cache data gathered after the search was aborted (e.g. maxAllowableSearchTime): the
      // enrichment fetch was cancelled, so the result is incomplete — let a later search retry it.
      if (
        resultBuilder &&
        cacheKey &&
        !this.skipProductDetailCache &&
        !this.controller.signal.aborted &&
        this.shouldCacheProductData(resultBuilder)
      ) {
        await this.cache.cacheProductData(cacheKey, resultBuilder.dump());
      }
      return resultBuilder;
    } catch (outerErr: unknown) {
      this.logger.error(
        "[SupplierBase > getProductData] Error in getProductDataWithCache:",
        outerErr,
      );
      incrementParseError(this.supplierName);
      return undefined;
    }
  }

  /**
   * Retrieves product data with caching support.
   * Similar to getProductData but allows for additional parameters to be included in the cache key.
   *
   * @param product - The ProductBuilder instance to get data for
   * @param fetcher - The function to use for fetching product data
   * @returns Promise resolving to the updated ProductBuilder or void if fetch fails
   *
   * @example
   * ```typescript
   * const builder = new ProductBuilder<Product>(this.baseURL);
   * builder.setBasicInfo("Acetone", "/products/acetone", "ChemSupplier");
   *
   * const updatedBuilder = await supplier.getProductDataWithCache(
   *   builder,
   *   async (b) => {
   *     // Custom fetching logic
   *     return b;
   *   },
   * );
   * ```
   * @source
   */
  protected async getProductDataWithCache(
    product: ProductBuilder<T>,
    fetcher: (builder: ProductBuilder<T>) => Promise<ProductBuilder<T> | void>,
  ): Promise<ProductBuilder<T> | void> {
    const url = product.get("url");
    if (typeof url !== "string") {
      this.logger.error("[SupplierBase > getProductDataWithCache] Invalid URL in product:", {
        url,
      });
      return undefined;
    }
    // Skip products the user has ignored (matched by identity key).
    if (this.isExcluded(product)) {
      this.logger.debug("[SupplierBase > getProductDataWithCache] Skipping excluded product", {
        url,
        supplierName: this.supplierName,
      });
      return undefined;
    }

    // Key by the supplier's stable identity, stamped on the builder at parse
    // time. Absent only if a supplier failed to stamp one, in which case this
    // product simply isn't cached.
    const cacheKey = this.productIdentityKey(product);
    this.logger.debug(
      "[SupplierBase > getProductDataWithCache] Product detail cache key:",
      cacheKey,
      {
        url,
      },
    );
    try {
      if (!this.skipProductDetailCache && cacheKey) {
        const cachedData = await this.cache.getCachedProductData(cacheKey);
        if (isCachedProductData<T>(cachedData)) {
          product.setData(cachedData);
          return product;
        }
      }
      // Cache miss (or caching skipped): run setup (memoized) so any state
      // subclasses rely on is ready before the fetcher reads it, then fetch.
      await this.ensureSetup();
      let resultBuilder: ProductBuilder<T> | void = undefined;
      try {
        resultBuilder = await fetcher(product);
      } catch (err: unknown) {
        this.logger.error(
          "[SupplierBase > getProductDataWithCache] Error in product detail fetcher:",
          err,
        );
        incrementParseError(this.supplierName);
        return undefined;
      }
      if (resultBuilder) {
        incrementProductCount(this.supplierName);
        // Skip caching when the search was aborted (e.g. maxAllowableSearchTime) — the enrichment
        // fetch was cancelled, so the data is incomplete and a later search should retry it.
        if (
          cacheKey &&
          !this.skipProductDetailCache &&
          !this.controller.signal.aborted &&
          this.shouldCacheProductData(resultBuilder)
        ) {
          await this.cache.cacheProductData(cacheKey, resultBuilder.dump());
        }
      }
      return resultBuilder;
    } catch (outerErr: unknown) {
      this.logger.error(
        "[SupplierBase > getProductDataWithCache] Error in getProductDataWithCache:",
        outerErr,
      );
      incrementParseError(this.supplierName);
      return undefined;
    }
  }

  /**
   * The key under which a product's detail-fetch failures are recorded/looked up: its permalink
   * if set, otherwise its processing URL. Subclasses that fetch supplemental data should record
   * failures under this same key so {@link shouldCacheProductData} can match them.
   *
   * @param product - The product builder
   * @returns The fetch key, or undefined when neither permalink nor url is a string
   * @example
   * ```typescript
   * this.productFetchKey(builder); // "https://www.aladdinsci.com/us_en/x.html"
   * ```
   * @source
   */
  protected productFetchKey(product: ProductBuilder<T>): string | undefined {
    const key = product.get("permalink") ?? product.get("url");
    return typeof key === "string" ? key : undefined;
  }

  /**
   * Records the HTTP status of a failed product-detail fetch so {@link shouldCacheProductData}
   * can skip caching it. Non-HTTP failures (no status) are not recorded.
   *
   * @param key - The product fetch key (see {@link productFetchKey})
   * @param httpStatus - The HTTP status of the failure, if it was an HttpError
   * @returns void
   * @example
   * ```typescript
   * this.recordFetchFailure(permalink, 429);
   * ```
   * @source
   */
  protected recordFetchFailure(key: string, httpStatus?: number): void {
    if (typeof httpStatus === "number") {
      this.failedFetchStatuses.set(key, httpStatus);
    }
  }

  /**
   * Decides whether a freshly-fetched product's detail data should be written to the cache.
   * Skips caching when the product's last detail fetch failed with a {@link noCacheStatusCodes}
   * status (default 429), so a later search retries it instead of serving the incomplete cached
   * entry. The product is still listed regardless.
   *
   * @param product - The product builder about to be cached
   * @returns True to cache the product data, false to skip caching it
   * @example
   * ```typescript
   * this.shouldCacheProductData(builder); // false when the detail fetch hit a 429
   * ```
   * @source
   */
  protected shouldCacheProductData(product: ProductBuilder<T>): boolean {
    const key = this.productFetchKey(product);
    if (key === undefined) {
      return true;
    }
    const failedStatus = this.failedFetchStatuses.get(key);
    return failedStatus === undefined || !this.noCacheStatusCodes.includes(failedStatus);
  }

  /**
   * Groups variants of a product by their title
   * @param data - Array of product listings from search results
   * @returns Array of product listings with grouped variants
   * @todo Create a generic method for this, the same method is used in
   *       Synthetika and could be of use with LoudWolf.
   * @example
   * ```typescript
   * const results = await this.queryProducts("sodium chloride");
   * const grouped = this.groupVariants(results);
   * // grouped is an array of product listings with grouped variants
   * ```
   * @source
   */
  protected groupVariants<R>(data: R[]): R[] {
    const variants: GroupedItem<R>[] = data
      .map((item) => {
        const title = this.titleSelector(item);
        if (!title) {
          this.logger.error("No title found in product:", { item });
          return undefined;
        }
        const groupId = stripQuantityFromString(title.replace(/(?<=\d{1,3})\s(?=\d{3})/g, ""));
        const groupIdWithoutSpaces = groupId.replace(/[\s-]/g, "");
        return { ...item, groupId: groupIdWithoutSpaces };
      })
      .filter((item): item is GroupedItem<R> => item !== undefined);

    const products = Object.groupBy(variants, (item) => item.groupId);

    return Object.values(products)
      .filter((product): product is GroupedItem<R>[] => product !== undefined)
      .map((product) => {
        const main = product.splice(0, 1)[0];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { groupId, ...newObject } = main;
        // R is unconstrained, so TS widens newObject.variants to
        // R["variants"] & (R[] | undefined), which it cannot prove product
        // (GroupedItem<R>[]) satisfies; assert to the destructured property type.
        newObject.variants = product as typeof newObject.variants;

        return newObject;
      })
      .filter((item): item is GroupedItem<R> => item !== undefined);
  }

  /**
   * Runs an HTTP request from the extension's background service worker instead of this
   * (page) context, sidestepping the CORS restrictions that apply to extension pages.
   * The target host must be granted in the manifest `host_permissions`. Returns a real
   * {@link Response} (text/JSON bodies only). Independent of {@link fetch} — it does not
   * share the request counter, hard limit, or WAF retry logic.
   *
   * @param url - The absolute URL to request.
   * @param init - Optional serializable request options (method, headers, body, etc.).
   * @returns A `Response` reconstructed from the worker's reply.
   * @example
   * ```typescript
   * // Inside a supplier method, e.g. scraping an asset blocked by page CORS:
   * const homepage = await this.backgroundFetch("https://chemsavers.com/");
   * const html = await homepage.text();
   *
   * const search = await this.backgroundFetch("https://api.example.com/search", {
   *   method: "POST",
   *   headers: { "content-type": "application/json" },
   *   body: JSON.stringify({ q: "acid" }),
   * });
   * const results = search.ok ? await search.json() : undefined;
   * ```
   * @source
   */
  protected async backgroundFetch(url: string, init?: BackgroundFetchInit): Promise<Response> {
    this.logger.debug(`Background fetching: ${url}`);
    return backgroundFetch(url, init);
  }

  /**
   * Internal fetch method with request counting and decorator.
   * Tracks request count and enforces hard limits on HTTP requests.
   *
   * @param args - Arguments to pass to fetchDecorator (usually a Request or URL and options)
   * @returns The response from the fetchDecorator
   * @throws Error if request count exceeds hard limit
   *
   * @example
   * ```typescript
   * // Example usage inside a subclass:
   * const response = await this.fetch(new Request('https://example.com'));
   * if (response.ok) {
   *   const data = await response.json();
   *   console.log(data);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // With custom request options
   * const response = await this.fetch(
   *   new Request('https://example.com', {
   *     headers: { 'Accept': 'application/json' }
   *   })
   * );
   * ```
   * @source
   */
  protected async fetch(
    ...args: Parameters<typeof fetchDecorator>
  ): Promise<FetchDecoratorResponse> {
    const [input] = args;
    this.logger.debug(`Fetching: ${input}`);

    // One initial attempt plus up to `challengeRetryLimit` retries. A 403 from
    // a WAF cookie handshake plants a cookie on the first hit (stored because
    // credentials:"include"); the retry sends it back and usually passes.
    const maxAttempts = 1 + Math.max(0, this.challengeRetryLimit);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Each attempt is a real network request, so it counts toward the hard
      // limit. For non-retrying suppliers (maxAttempts === 1) this is
      // identical to the previous single increment.
      this.requestCount++;
      if (this.requestCount > this.httpRequestHardLimit) {
        this.logger.warn("Request count exceeded hard limit", { requestCount: this.requestCount });
        incrementFailure(this.supplierName);
        throw new Error("Request count exceeded hard limit");
      }

      try {
        const response = await fetchDecorator(...args);
        this.logger.debug(`Response Status: ${response.status}`);
        this.logger.debug("response hash:", response.requestHash);
        if (typeof response.data === "string" && response.data?.length === 0) {
          throw new EmptyResponseError(`Invalid response: ${response.data}`);
        }
        incrementSuccess(this.supplierName);
        return response;
      } catch (error: unknown) {
        if (this.shouldRetryChallenge(error) && attempt < maxAttempts) {
          this.logger.warn("Retrying after 403 (WAF cookie handshake)", {
            attempt,
            maxAttempts,
            input,
          });
          await sleep(this.challengeRetryDelayMs);
          continue;
        }
        incrementFailure(this.supplierName);
        throw error;
      }
    }

    // Unreachable: the loop always returns on success or throws on the final
    // failed attempt. Present only to satisfy the return-type checker.
    throw new Error("fetch: exhausted retries without resolving");
  }

  /**
   * Whether a thrown fetch error is a retryable WAF cookie-handshake `403`.
   * Gated by `challengeRetryLimit` so only opted-in suppliers retry; we can't
   * inspect the `Set-Cookie` header (fetch-forbidden), so any `403` qualifies
   * once a supplier has opted in.
   * @param error - The error thrown by `fetchDecorator`
   * @returns `true` when the request should be retried
   * @source
   */
  private shouldRetryChallenge(error: unknown): boolean {
    return this.challengeRetryLimit > 0 && error instanceof HttpError && error.status === 403;
  }
}
