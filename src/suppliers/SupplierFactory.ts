import { defaultResultsLimit } from "@/../config.json";
import { filterRestrictedProduct } from "@/helpers/purchaseRestriction";
import {
  looksLikeSmiles,
  parseStructurePrefix,
  resolveSmiles,
  type ResolvedStructure,
} from "@/helpers/smiles";
import { mapDefined, sleep } from "@/helpers/utils";
import { Logger } from "@/utils/Logger";
import { extractAllPositiveTerms } from "@/utils/search-query/extractPositiveTerms";
import { parseSearchQuery } from "@/utils/search-query/parseSearchQuery";
import type { ParsedSearchQuery } from "@/utils/search-query/types";
import { incrementParseError } from "@/utils/SupplierStatsStore";
import { Queue } from "async-await-queue";
import * as suppliers from ".";
import { SupplierBase } from "./SupplierBase";

/** Constructor signature for supplier classes used by the factory */
type SupplierConstructor<P extends Product> = new (
  query: string,
  limit: number,
  controller: AbortController,
) => SupplierBase<unknown, P>;

/**
 * Options for constructing a {@link SupplierFactory}. `controller` is required; every other field
 * is optional and falls back to a sensible default. Most fields mirror the corresponding
 * `userSettings` value.
 * @source
 */
export interface SupplierFactoryOptions {
  /** Fetch controller (can be used to terminate the query). */
  controller: AbortController;
  /** Maximum number of results per supplier. Defaults to `defaultResultsLimit`. */
  limit?: number;
  /** Suppliers to query; empty (the default) queries all. */
  suppliers?: Array<SupplierClassName>;
  /** Whether to read from / write to the supplier caches. Defaults to true. */
  caching?: boolean;
  /** Fuzz-scorer name (from `FUZZ_SCORERS`) overriding each supplier's default. */
  fuzzScorerOverride?: string;
  /** When true, suppliers returning zero results skip writing a cache entry. Defaults to false. */
  doNotCacheEmptyResults?: boolean;
  /** Max age (minutes) of a query cache entry before eviction on read; 0 disables. Defaults to 0. */
  cacheTtlMinutes?: number;
  /** HTTP statuses that prevent a product-detail fetch from being cached. Defaults to [429]. */
  noCacheStatusCodes?: number[];
  /** Override (ms) for each supplier's search-time budget. Omit to keep per-supplier defaults. */
  maxAllowableSearchTime?: number;
  /** When true, suppliers skip fuzzball scoring and show raw/boolean-only results. Defaults to false. */
  fuzzyFilteringDisabled?: boolean;
  /** User's ISO 3166-1 alpha-2 location; enables the shipping/restriction filters below. */
  location?: string;
  /** When true (with a `location`), drop suppliers that don't ship to the user. Defaults to false. */
  excludeNonShippingSuppliers?: boolean;
  /** When true, hide products the user can't buy (region/buyer restrictions). Defaults to false. */
  hideRestrictedProducts?: boolean;
  /** Supplier class names to exclude from the search entirely, regardless of `suppliers`. Defaults to []. */
  disabledSuppliers?: Array<SupplierClassName>;
}

/**
 * Factory class for querying multiple chemical suppliers simultaneously.
 * This class provides a unified interface to search across multiple supplier implementations.
 *
 * @category Suppliers
 * @example
 * ```typescript
 * // Create a factory to search all suppliers
 * const factory = new SupplierFactory("sodium chloride", { controller: new AbortController() });
 *
 * // Create a factory to search specific suppliers
 * const factory = new SupplierFactory("sodium chloride", {
 *   controller: new AbortController(),
 *   suppliers: ["SupplierCarolina", "SupplierLaballey"],
 * });
 *
 * // Iterate over results from all selected suppliers
 * for await (const product of factory) {
 *   console.log(product.supplier, product.title, product.price);
 * }
 * ```
 * @source
 */
export class SupplierFactory<P extends Product> {
  // Term being queried
  private query: string;

  // Abort controller for fetch control
  private controller: AbortController;

  // List of supplier class names to include in query results. Held as plain strings
  // because it's compared against the runtime string keys of the suppliers barrel; the
  // public option is typed SupplierClassName[] for authoring convenience.
  private suppliers: Array<string>;

  // Mirrors userSettings.disabledSuppliers. Supplier class names the user has turned
  // off; excluded from every search before the include-list is even consulted, so the
  // deny-list wins even when `suppliers` is empty (which otherwise means "query all").
  // Held as plain strings for the same reason as `suppliers` above.
  private disabledSuppliers: Array<string>;

  // Maximum number of results for each supplier
  private limit: number = defaultResultsLimit;

  // Whether supplier caches (query + product detail) should be read from and
  // written to for this search. Mirrors userSettings.caching so a user who has
  // disabled caching gets fresh results every time.
  private caching: boolean;

  // Mirrors userSettings.doNotCacheEmptyResults. Forwarded to each supplier's
  // SupplierCache so an empty-result query for a previously out-of-stock
  // supplier doesn't get cached and mask future restocks.
  private doNotCacheEmptyResults: boolean;

  // Mirrors userSettings.cacheTtlMinutes. Forwarded to each supplier's
  // SupplierCache so query cache entries older than this are evicted on read.
  // 0 disables TTL expiration.
  private cacheTtlMinutes: number;

  // Mirrors userSettings.noCacheStatusCodes. Forwarded to each supplier so a
  // product-detail fetch that hit one of these HTTP statuses (default [429])
  // isn't cached, letting a later search retry it.
  private noCacheStatusCodes: number[];

  // Optional global fuzz-scorer override from userSettings.fuzzScorerOverride.
  // When set, applied to every supplier instance before execute() runs so the
  // user's Advanced-settings choice wins over each supplier class's default.
  private fuzzScorerOverride?: string;

  // Optional global max-search-time override (ms) from userSettings.maxAllowableSearchTime.
  // When set, applied to every supplier instance so the user's Advanced-settings value
  // overrides each supplier class's default search-time budget.
  private maxAllowableSearchTime?: number;

  // Parsed advanced-search query, derived once from `query` and shared with every
  // supplier instance so they all see the same AST.
  private parsedQuery: ParsedSearchQuery;

  // Mirrors userSettings.fuzzyFilteringDisabled. When true, suppliers skip
  // fuzzball scoring and rely on the boolean predicate (or raw results) instead.
  private fuzzyFilteringDisabled: boolean;

  // User's location (ISO 3166-1 alpha-2 country code) from userSettings.location.
  // Used together with excludeNonShippingSuppliers to drop suppliers that don't
  // ship to the user. Empty/undefined disables shipping filtering.
  private location?: string;

  // Mirrors userSettings.excludeNonShippingSuppliers. When true (and a location
  // is set), suppliers that don't ship to the user's location are filtered out
  // before their queries run. Defaults to false so existing callers are unaffected.
  private excludeNonShippingSuppliers: boolean;

  // Mirrors userSettings.hideRestrictedProducts. When true (the default), each
  // yielded product is run through filterRestrictedProduct: options the user can't
  // buy (region/buyer/etc.) are pruned, and fully-restricted products are dropped.
  private hideRestrictedProducts: boolean;

  // SMILES/structure query terms resolved to chemical identifiers, keyed by the
  // raw term. Resolved lazily once per search (see resolveStructuresOnce) and
  // shared with every supplier instance so none of them re-hit the network.
  private resolvedStructures?: ReadonlyMap<string, ResolvedStructure>;

  // Logger instance
  private logger: Logger;

  // Set true by executeAll/executeAllStream when there were candidate suppliers
  // but shipping filtering removed every one of them (i.e. no selected supplier
  // ships to the user's location). Lets the UI explain an empty result set.
  public shippingExcludedAll: boolean = false;

  /**
   * Factory class for querying all suppliers.
   *
   * @param query - Value to query for
   * @param options - Factory configuration; see {@link SupplierFactoryOptions}. `controller` is
   *   required, everything else is optional with sensible defaults.
   * @source
   */
  constructor(query: string, options: SupplierFactoryOptions) {
    const {
      controller,
      limit = defaultResultsLimit,
      suppliers = [],
      caching = true,
      fuzzScorerOverride,
      doNotCacheEmptyResults = false,
      cacheTtlMinutes = 0,
      noCacheStatusCodes = [429],
      maxAllowableSearchTime,
      fuzzyFilteringDisabled = false,
      location,
      excludeNonShippingSuppliers = false,
      hideRestrictedProducts = false,
      disabledSuppliers = [],
    } = options;

    this.logger = new Logger("SupplierFactory");
    this.logger.debug("initialized", {
      query,
      limit,
      controller,
      suppliers,
      caching,
      fuzzScorerOverride,
      doNotCacheEmptyResults,
      cacheTtlMinutes,
      noCacheStatusCodes,
      maxAllowableSearchTime,
      fuzzyFilteringDisabled,
      location,
      excludeNonShippingSuppliers,
      hideRestrictedProducts,
      disabledSuppliers,
    });

    this.query = query;
    this.limit = limit;
    this.controller = controller;
    this.suppliers = suppliers;
    this.caching = caching;
    this.fuzzScorerOverride = fuzzScorerOverride;
    this.doNotCacheEmptyResults = doNotCacheEmptyResults;
    this.cacheTtlMinutes = cacheTtlMinutes;
    this.noCacheStatusCodes = noCacheStatusCodes;
    this.maxAllowableSearchTime = maxAllowableSearchTime;
    this.fuzzyFilteringDisabled = fuzzyFilteringDisabled;
    this.location = location;
    this.excludeNonShippingSuppliers = excludeNonShippingSuppliers;
    this.hideRestrictedProducts = hideRestrictedProducts;
    this.disabledSuppliers = disabledSuppliers;
    this.parsedQuery = parseSearchQuery(query);
  }

  /**
   * Get the list of available supplier module names.
   * Use these names when specifying which suppliers to query in the constructor.
   *
   * @returns Array of supplier class names that can be queried
   * @example
   * ```typescript
   * const suppliers = SupplierFactory.supplierList();
   * // Returns: ["SupplierCarolina", "SupplierLaballey", "SupplierBioFuranChem", ...]
   *
   * // Use these names to create a targeted factory
   * const factory = new SupplierFactory("acid", { controller, suppliers });
   * ```
   * @source
   */
  public static supplierList(): Array<SupplierClassName> {
    return Object.keys(suppliers) as unknown as Array<SupplierClassName>;
  }

  /**
   * Type guard narrowing an arbitrary string to a known {@link SupplierClassName}. Use at
   * runtime boundaries (persisted values, UI inputs) where a plain string needs to be
   * confirmed as one of the barrel-exported supplier names before it's stored or searched.
   * @param value - Candidate string to test.
   * @returns True (and narrows `value` to `SupplierClassName`) when it names an exported supplier.
   * @example
   * ```typescript
   * ["SupplierCarolina", "Nope"].filter(SupplierFactory.isSupplierClassName);
   * // => ["SupplierCarolina"]
   * ```
   * @source
   */
  public static isSupplierClassName(value: string): value is SupplierClassName {
    return SupplierFactory.supplierList().some((name) => name === value);
  }

  /**
   * Get a map of supplier module names to their display names.
   *
   * @returns Record mapping supplier class names to their supplierName property
   * @source
   */
  public static supplierDisplayNames(): Record<string, string> {
    const controller = new AbortController();
    return Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/naming-convention
      mapDefined(Object.entries(suppliers), ([key, SupplierClass]) => {
        // Trusted static supplier classes; the union of concrete constructors
        // isn't structurally assignable to the generic SupplierConstructor.
        const ConcreteClass = SupplierClass as unknown as SupplierConstructor<Product>;
        const instance = new ConcreteClass("", 1, controller);
        return [key, instance.supplierName];
      }),
    );
  }

  /**
   * Get a map of supplier class names to whether they ship to the given location.
   * Creates throwaway instances and delegates to
   * {@link SupplierBase.shipsToCountry}, so it applies the same `shipsTo`/scope
   * heuristic used at search time. Lets the UI grey out suppliers that won't ship
   * to the user.
   *
   * @param location - The user's location as an ISO 3166-1 alpha-2 country code.
   * @returns Record mapping supplier class names to a ships-to boolean.
   * @example
   * ```typescript
   * const map = SupplierFactory.supplierShipsTo("US");
   * // { SupplierCarolina: true, SupplierWarchem: false, ... }
   * ```
   * @source
   */
  public static supplierShipsTo(location: CountryCode): Record<string, boolean> {
    const controller = new AbortController();
    return Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/naming-convention
      mapDefined(Object.entries(suppliers), ([key, SupplierClass]) => {
        // Trusted static supplier classes; the union of concrete constructors
        // isn't structurally assignable to the generic SupplierConstructor.
        const ConcreteClass = SupplierClass as unknown as SupplierConstructor<Product>;
        const instance = new ConcreteClass("", 1, controller);
        return [key, instance.shipsToCountry(location)];
      }),
    );
  }

  /**
   * Get a map of supplier class names to their required host origins.
   * Creates throwaway instances to read requiredHosts from each supplier.
   *
   * @returns Record mapping supplier class names to their requiredHosts arrays
   * @source
   */
  public static supplierRequiredHosts(): Record<string, string[]> {
    const controller = new AbortController();
    return Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/naming-convention
      mapDefined(Object.entries(suppliers), ([key, SupplierClass]) => {
        // Trusted static supplier classes; the union of concrete constructors
        // isn't structurally assignable to the generic SupplierConstructor.
        const ConcreteClass = SupplierClass as unknown as SupplierConstructor<Product>;
        const instance = new ConcreteClass("", 1, controller);
        return [key, instance.requiredHosts];
      }),
    );
  }

  /**
   * Filters supplier instances to only those whose required host permissions
   * are already granted. Uses chrome.permissions.contains() which is a passive
   * check — it does not prompt the user. Permission granting should be handled
   * separately in a UI flow (e.g., a settings page).
   *
   * @param instances - Array of supplier instances to check
   * @returns Filtered array of suppliers with granted permissions
   * @source
   */
  private async filterByPermissions<P extends Product>(
    instances: SupplierBase<unknown, P>[],
  ): Promise<SupplierBase<unknown, P>[]> {
    const results = await Promise.all(
      instances.map(async (instance) => {
        if (instance.requiredHosts.length === 0) return { instance, granted: true };
        try {
          const granted = await chrome.permissions.contains({ origins: instance.requiredHosts });
          if (!granted) {
            this.logger.warn("Permission check failed for supplier", {
              supplier: instance.supplierName,
              requiredHosts: instance.requiredHosts,
            });
          }
          return { instance, granted };
        } catch (e) {
          this.logger.error("Permission check failed for supplier", {
            supplier: instance.supplierName,
            error: e,
          });
          return { instance, granted: false };
        }
      }),
    );
    return results.filter((r) => r.granted).map((r) => r.instance);
  }

  /**
   * Filters supplier instances to only those that ship to the user's location.
   * A no-op (returns all instances) when shipping filtering is disabled or no
   * location is set. Synchronous — unlike {@link filterByPermissions}, it only
   * reads in-memory supplier metadata via {@link SupplierBase.shipsToCountry}.
   *
   * @param instances - Array of supplier instances to check.
   * @returns The subset of instances that ship to the user's location.
   * @source
   */
  private filterByShipping<P extends Product>(
    instances: SupplierBase<unknown, P>[],
  ): SupplierBase<unknown, P>[] {
    if (!this.excludeNonShippingSuppliers || !this.location) {
      return instances;
    }
    const location = this.location as CountryCode;
    return instances.filter((instance) => instance.shipsToCountry(location));
  }

  /**
   * Applies per-product purchase-restriction filtering to a single result. A no-op
   * (returns the product unchanged) when `hideRestrictedProducts` is off; otherwise
   * delegates to {@link filterRestrictedProduct}, which prunes options the user can't
   * buy and returns undefined when the whole product is unbuyable.
   *
   * @param product - The product to filter.
   * @returns The product (possibly with restricted variants pruned), or undefined to drop it.
   * @source
   */
  private applyRestrictionFilter<Q extends Product>(product: Q): Q | undefined {
    if (this.hideRestrictedProducts !== true) {
      return product;
    }
    return filterRestrictedProduct(product, this.location);
  }

  /**
   * Resolves every SMILES/structure term in the query to its chemical identifiers
   * (name, CAS, InChIKey) exactly once, memoizing the result on the factory so it
   * is shared with every supplier instead of each supplier re-hitting the network.
   *
   * Only positive (non-negated) leaf terms that look like a structure (via
   * {@link looksLikeSmiles} or an explicit `smiles:`/`inchikey:` prefix) are
   * resolved, so plain/CAS/formula/name queries make no network calls at all.
   * Each unique term is resolved once; failures are logged and skipped so a
   * dead resolver never blocks the search.
   *
   * @returns A map of raw search term → resolved structure (empty when none apply).
   * @example
   * ```typescript
   * // query "CCO" -> Map { "CCO" => { name: "ethanol", cas: ["64-17-5"], ... } }
   * await factory.resolveStructuresOnce();
   * ```
   * @source
   */
  private async resolveStructuresOnce(): Promise<ReadonlyMap<string, ResolvedStructure>> {
    if (this.resolvedStructures) {
      return this.resolvedStructures;
    }

    const resolved = new Map<string, ResolvedStructure>();
    for (const term of extractAllPositiveTerms(this.parsedQuery.ast)) {
      if (resolved.has(term)) {
        continue;
      }
      const { mode, value } = parseStructurePrefix(term);
      const isStructure = mode === "smiles" || (mode === "auto" && looksLikeSmiles(value));
      if (!isStructure) {
        continue;
      }
      try {
        const structure = await resolveSmiles(value);
        if (structure) {
          resolved.set(term, structure);
        }
      } catch (error) {
        this.logger.warn("Failed to resolve structure term; skipping", { term, error });
      }
    }

    this.resolvedStructures = resolved;
    return resolved;
  }

  /**
   * Executes the execute() method on all selected suppliers in parallel using async-await-queue.
   * Results are collected and flattened into a single array.
   *
   * @param concurrency - Maximum number of suppliers to process in parallel (default: 3)
   * @returns Promise resolving to an array of all products from all suppliers
   * @example
   * ```typescript
   * const factory = new SupplierFactory("acetone", { limit: 5, controller: new AbortController() });
   * const allProducts = await factory.executeAll(3); // 3 suppliers in parallel
   * console.log(allProducts);
   * ```
   * @source
   */
  public async executeAll(concurrency: number = 3): Promise<P[]> {
    // Resolve any SMILES/structure terms once up front so every instance shares them.
    await this.resolveStructuresOnce();

    // 1. Instantiate supplier classes
    const supplierInstances: SupplierBase<unknown, P>[] = mapDefined(
      Object.entries(suppliers),
      ([supplierClassName, supplierClass]) => {
        if (this.disabledSuppliers.includes(supplierClassName)) return;
        if (!(this.suppliers.length === 0 || this.suppliers.includes(supplierClassName))) return;

        this.logger.debug("Initializing supplier class:", supplierClassName);
        // Trusted static supplier classes; the union of concrete constructors
        // isn't structurally assignable to the generic SupplierConstructor<P>.
        const ConcreteSupplierClass = supplierClass as unknown as SupplierConstructor<P>;
        const instance = new ConcreteSupplierClass(this.query, this.limit, this.controller);
        instance.initCache(
          this.caching,
          this.doNotCacheEmptyResults,
          this.cacheTtlMinutes,
          this.noCacheStatusCodes,
        );
        instance.setFuzzScorerOverride(this.fuzzScorerOverride);
        instance.setMaxAllowableSearchTime(this.maxAllowableSearchTime);
        instance.setParsedQuery(this.parsedQuery);
        instance.setFuzzyFilteringDisabled(this.fuzzyFilteringDisabled);
        instance.setResolvedStructures(this.resolvedStructures);
        return instance;
      },
    );

    // 2. Drop suppliers that don't ship to the user's location, then keep only
    // those with granted host permissions.
    const shippableInstances = this.filterByShipping(supplierInstances);
    this.shippingExcludedAll = supplierInstances.length > 0 && shippableInstances.length === 0;
    const permittedInstances = await this.filterByPermissions(shippableInstances);

    // 3. Use async-await-queue for parallel execution
    const queue = new Queue(concurrency, 100);
    const allResults: P[] = [];
    const errors: SupplierExecutionError<P>[] = [];

    const tasks = permittedInstances.map((supplier) =>
      queue.run(async () => {
        try {
          for await (const product of supplier.execute()) {
            const filtered = this.applyRestrictionFilter(product);
            if (filtered !== undefined) {
              allResults.push(filtered);
            }
          }
        } catch (e) {
          this.logger.error("Error executing supplier", { error: e, supplier });
          incrementParseError(supplier.supplierName);
          errors.push({ error: e, supplier });
        }
      }),
    );

    await Promise.all(tasks);

    // Optionally, you can return errors as well
    // return { products: allResults, errors };
    return allResults;
  }

  /**
   * Streams products from all selected suppliers as soon as each supplier's execute() resolves.
   * Uses async-await-queue for concurrency control and yields products as they are available.
   *
   * @param concurrency - Maximum number of suppliers to process in parallel (default: 3)
   * @returns AsyncGenerator yielding products from all suppliers as soon as they are ready
   * @example
   * ```typescript
   * for await (const product of factory.executeAllStream(3)) {
   *   console.log(product);
   * }
   * ```
   * @source
   */
  public async *executeAllStream(concurrency: number = 3): AsyncGenerator<P, void, undefined> {
    // Resolve any SMILES/structure terms once up front so every instance shares them.
    await this.resolveStructuresOnce();

    const supplierInstances: SupplierBase<unknown, P>[] = mapDefined(
      Object.entries(suppliers),
      ([supplierClassName, supplierClass]) => {
        if (this.disabledSuppliers.includes(supplierClassName)) return;
        if (!(this.suppliers.length === 0 || this.suppliers.includes(supplierClassName))) return;

        this.logger.debug("Initializing supplier class", { supplierClassName });
        // Trusted static supplier classes; the union of concrete constructors
        // isn't structurally assignable to the generic SupplierConstructor<P>.
        const ConcreteSupplierClass = supplierClass as unknown as SupplierConstructor<P>;
        console.log("Initializing supplier class...", { supplierClassName, ConcreteSupplierClass });
        const instance = new ConcreteSupplierClass(this.query, this.limit, this.controller);
        console.log("After initializing supplier class", { supplierClassName, instance });
        instance.initCache(
          this.caching,
          this.doNotCacheEmptyResults,
          this.cacheTtlMinutes,
          this.noCacheStatusCodes,
        );
        instance.setFuzzScorerOverride(this.fuzzScorerOverride);
        instance.setMaxAllowableSearchTime(this.maxAllowableSearchTime);
        instance.setParsedQuery(this.parsedQuery);
        instance.setFuzzyFilteringDisabled(this.fuzzyFilteringDisabled);
        instance.setResolvedStructures(this.resolvedStructures);
        return instance;
      },
    );

    // Drop suppliers that don't ship to the user's location, then keep only
    // those with granted host permissions.
    const shippableInstances = this.filterByShipping(supplierInstances);
    this.shippingExcludedAll = supplierInstances.length > 0 && shippableInstances.length === 0;
    const permittedInstances = await this.filterByPermissions(shippableInstances);
    console.log("After filtering by permissions", { permittedInstances });
    const queue = new Queue(concurrency, 100);

    const channel: P[] = [];
    let doneCount = 0;

    permittedInstances.forEach((supplier) => {
      console.log("Running queue", { supplier });
      queue.run(async () => {
        try {
          const iterator = supplier.execute();
          for await (const product of iterator) {
            const filtered = this.applyRestrictionFilter(product);
            if (filtered !== undefined) {
              channel.push(filtered);
            }
          }
        } catch (e) {
          this.logger.error("Error executing supplier", { error: e, supplier });
          incrementParseError(supplier.supplierName);
        } finally {
          doneCount++;
        }
      });
    });

    // Yield results as they come in, until all suppliers are done and the channel is empty
    while (doneCount < permittedInstances.length || channel.length > 0) {
      if (channel.length > 0) {
        yield channel.shift()!;
      } else {
        await sleep(25);
      }
    }
  }
}
