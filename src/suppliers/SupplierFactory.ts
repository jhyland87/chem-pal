import { defaultResultsLimit } from "@/../config.json";
import { mapDefined } from "@/helpers/utils";
import Logger from "@/utils/Logger";
import { incrementParseError } from "@/utils/SupplierStatsStore";
import { Queue } from "async-await-queue";
import * as suppliers from ".";
import SupplierBase from "./SupplierBase";

/** Constructor signature for supplier classes used by the factory */
type SupplierConstructor<P extends Product> = new (
  query: string,
  limit: number,
  controller: AbortController,
) => SupplierBase<unknown, P>;
/**
 * Factory class for querying multiple chemical suppliers simultaneously.
 * This class provides a unified interface to search across multiple supplier implementations.
 *
 * @category Suppliers
 * @example
 * ```typescript
 * // Create a factory to search all suppliers
 * const factory = new SupplierFactory("sodium chloride", new AbortController());
 *
 * // Create a factory to search specific suppliers
 * const factory = new SupplierFactory(
 *   "sodium chloride",
 *   new AbortController(),
 *   ["SupplierCarolina", "SupplierLaballey"]
 * );
 *
 * // Iterate over results from all selected suppliers
 * for await (const product of factory) {
 *   console.log(product.supplier, product.title, product.price);
 * }
 * ```
 * @source
 */
export default class SupplierFactory<P extends Product> {
  // Term being queried
  private query: string;

  // Abort controller for fetch control
  private controller: AbortController;

  // List of supplier class names to include in query results
  private suppliers: Array<string>;

  // Maximum number of results for each supplier
  private limit: number = defaultResultsLimit;

  // Whether supplier caches (query + product detail) should be read from and
  // written to for this search. Mirrors userSettings.caching so a user who has
  // disabled caching gets fresh results every time.
  private caching: boolean;

  // Optional global fuzz-scorer override from userSettings.fuzzScorerOverride.
  // When set, applied to every supplier instance before execute() runs so the
  // user's Advanced-settings choice wins over each supplier class's default.
  private fuzzScorerOverride?: string;

  // Logger instance
  private logger: Logger;

  /**
   * Factory class for querying all suppliers.
   *
   * @param query - Value to query for
   * @param limit - Maximum number of results for each supplier
   * @param controller - Fetch controller (can be used to terminate the query)
   * @param suppliers - Array of suppliers to query (empty is the same as querying all)
   * @param caching - Whether to read from / write to the supplier caches. Defaults to true.
   * @param fuzzScorerOverride - Optional fuzz scorer name (from `FUZZ_SCORERS`)
   *   that overrides each supplier's default `fuzzScorer`. Omit or pass
   *   `undefined` to respect per-supplier defaults.
   * @source
   */
  constructor(
    query: string,
    limit: number = this.limit,
    controller: AbortController,
    suppliers: Array<string> = [],
    caching: boolean = true,
    fuzzScorerOverride?: string,
  ) {
    this.logger = new Logger("SupplierFactory");
    this.logger.debug("initialized", {
      query,
      limit,
      controller,
      suppliers,
      caching,
      fuzzScorerOverride,
    });
    this.query = query;
    this.limit = limit;
    this.controller = controller;
    this.suppliers = suppliers;
    this.caching = caching;
    this.fuzzScorerOverride = fuzzScorerOverride;
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
   * const factory = new SupplierFactory("acid", controller, suppliers);
   * ```
   * @source
   */
  public static supplierList(): Array<string> {
    return Object.keys(suppliers);
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
      mapDefined(Object.entries(suppliers), ([key, SupplierClass]) => {
        const ConcreteClass = SupplierClass as unknown as SupplierConstructor<Product>;
        const instance = new ConcreteClass("", 1, controller);
        return [key, instance.supplierName];
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
      mapDefined(Object.entries(suppliers), ([key, SupplierClass]) => {
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
   * Executes the execute() method on all selected suppliers in parallel using async-await-queue.
   * Results are collected and flattened into a single array.
   *
   * @param concurrency - Maximum number of suppliers to process in parallel (default: 3)
   * @returns Promise resolving to an array of all products from all suppliers
   * @example
   * ```typescript
   * const factory = new SupplierFactory("acetone", 5, new AbortController());
   * const allProducts = await factory.executeAll(3); // 3 suppliers in parallel
   * console.log(allProducts);
   * ```
   * @source
   */
  public async executeAll(concurrency: number = 3): Promise<P[]> {
    // 1. Instantiate supplier classes
    const supplierInstances: SupplierBase<unknown, P>[] = mapDefined(
      Object.entries(suppliers),
      ([supplierClassName, supplierClass]) => {
        if (!(this.suppliers.length === 0 || this.suppliers.includes(supplierClassName))) return;

        this.logger.debug("Initializing supplier class:", supplierClassName);
        const ConcreteSupplierClass = supplierClass as unknown as SupplierConstructor<P>;
        const instance = new ConcreteSupplierClass(this.query, this.limit, this.controller);
        instance.initCache(this.caching);
        instance.setFuzzScorerOverride(this.fuzzScorerOverride);
        return instance;
      },
    );

    // 2. Filter to only suppliers with granted host permissions
    const permittedInstances = await this.filterByPermissions(supplierInstances);

    // 3. Use async-await-queue for parallel execution
    const queue = new Queue(concurrency, 100);
    const allResults: P[] = [];
    const errors: SupplierExecutionError<P>[] = [];

    const tasks = permittedInstances.map((supplier) =>
      queue.run(async () => {
        try {
          for await (const product of supplier.execute()) {
            allResults.push(product);
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
    const supplierInstances: SupplierBase<unknown, P>[] = mapDefined(
      Object.entries(suppliers),
      ([supplierClassName, supplierClass]) => {
        if (!(this.suppliers.length === 0 || this.suppliers.includes(supplierClassName))) return;

        this.logger.debug("Initializing supplier class", { supplierClassName });
        const ConcreteSupplierClass = supplierClass as unknown as SupplierConstructor<P>;
        console.log("Initializing supplier class...", { supplierClassName, ConcreteSupplierClass });
        const instance = new ConcreteSupplierClass(this.query, this.limit, this.controller);
        console.log("After initializing supplier class", { supplierClassName, instance });
        instance.initCache(this.caching);
        instance.setFuzzScorerOverride(this.fuzzScorerOverride);
        return instance;
      },
    );

    // Filter to only suppliers with granted host permissions
    const permittedInstances = await this.filterByPermissions(supplierInstances);
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
            channel.push(product);
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
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  }
}
