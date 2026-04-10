import { mapDefined } from "@/helpers/utils";
import Logger from "@/utils/Logger";
import { incrementParseError } from "@/utils/SupplierStatsStore";
import { Queue } from "async-await-queue";
import * as suppliers from ".";
import SupplierBase from "./SupplierBase";
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
  private limit: number = 15;

  // Logger instance
  private logger: Logger;

  /**
   * Factory class for querying all suppliers.
   *
   * @param query - Value to query for
   * @param limit - Maximum number of results for each supplier
   * @param controller - Fetch controller (can be used to terminate the query)
   * @param suppliers - Array of suppliers to query (empty is the same as querying all)
   * @source
   */
  constructor(
    query: string,
    limit: number = this.limit,
    controller: AbortController,
    suppliers: Array<string> = [],
  ) {
    this.logger = new Logger("SupplierFactory");
    this.logger.debug("initialized", { query, limit, controller, suppliers });
    this.query = query;
    this.limit = limit;
    this.controller = controller;
    this.suppliers = suppliers;
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
        const ConcreteClass = SupplierClass as unknown as new (
          query: string,
          limit: number,
          controller: AbortController,
        ) => SupplierBase<unknown, Product>;
        const instance = new ConcreteClass("", 1, controller);
        return [key, instance.supplierName];
      }),
    );
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
        const ConcreteSupplierClass = supplierClass as unknown as new (
          query: string,
          limit: number,
          controller: AbortController,
        ) => SupplierBase<unknown, P>;
        const instance = new ConcreteSupplierClass(this.query, this.limit, this.controller);
        instance.initCache();
        return instance;
      },
    );

    // 2. Use async-await-queue for parallel execution
    const queue = new Queue(concurrency, 100);
    const allResults: P[] = [];
    const errors: SupplierExecutionError<P>[] = [];

    const tasks = supplierInstances.map((supplier) =>
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
        const ConcreteSupplierClass = supplierClass as unknown as new (
          query: string,
          limit: number,
          controller: AbortController,
        ) => SupplierBase<unknown, P>;
        const instance = new ConcreteSupplierClass(this.query, this.limit, this.controller);
        instance.initCache();
        return instance;
      },
    );

    const queue = new Queue(concurrency, 100);
    const channel: P[] = [];
    let doneCount = 0;

    supplierInstances.forEach((supplier) => {
      queue.run(async () => {
        try {
          const iterator = supplier.execute() as AsyncGenerator<P, void, undefined>;
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
    while (doneCount < supplierInstances.length || channel.length > 0) {
      if (channel.length > 0) {
        yield channel.shift()!;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  }
}
