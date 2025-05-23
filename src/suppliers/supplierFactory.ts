import { type Product } from "types";
import * as suppliers from ".";
import SupplierBase from "./supplierBase";

/**
 * Factory class for querying multiple chemical suppliers simultaneously.
 * This class provides a unified interface to search across multiple supplier implementations.
 *
 * @category Supplier
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
 */
export default class SupplierFactory<T extends Product> implements AsyncIterable<T> {
  // Term being queried
  private _query: string;

  // Abort controller for fetch control
  private _controller: AbortController;

  // List of supplier class names to include in query results
  private _suppliers: Array<string>;

  /**
   * Factory class for querying all suppliers.
   *
   * @param query - Value to query for
   * @param controller - Fetch controller (can be used to terminate the query)
   * @param suppliers - Array of suppliers to query (empty is the same as querying all)
   */
  constructor(query: string, controller: AbortController, suppliers: Array<string> = []) {
    this._query = query;
    this._controller = controller;
    this._suppliers = suppliers;
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
   * const factory = new SupplierFactory("acid", controller, suppliers.slice(0, 2));
   * ```
   */
  public static supplierList(): Array<string> {
    return Object.keys(suppliers);
  }

  /**
   * Implements the AsyncIterable interface to allow for-await-of iteration over products.
   * Yields products from all selected suppliers in sequence.
   *
   * @returns AsyncGenerator yielding products of type T
   * @throws Error if a supplier query fails (unless due to abort)
   * @example
   * ```typescript
   * const factory = new SupplierFactory("acid", new AbortController());
   *
   * try {
   *   for await (const product of factory) {
   *     console.log(product.title);
   *   }
   * } catch (err) {
   *   console.error("Search failed:", err);
   * }
   * ```
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    try {
      const supplierIterator = this._getConsolidatedGenerator();

      for await (const value of supplierIterator) {
        yield value as T;
      }
    } catch (err) {
      // Here to catch when the overall search fails
      if (this._controller.signal.aborted === true) {
        console.debug("Search was aborted");
        return;
      }
      console.error("ERROR in generator fn:", err);
    }
  }

  /**
   * Creates a consolidated async generator that yields products from selected suppliers.
   * This method:
   * 1. Filters suppliers based on the names provided in constructor
   * 2. Instantiates selected supplier classes
   * 3. Combines their async iterators into a single stream
   *
   * @returns AsyncGenerator yielding products from all selected suppliers
   * @example
   * ```typescript
   * // Internal use only
   * const generator = this._getConsolidatedGenerator();
   * for await (const product of generator) {
   *   // Process each product
   * }
   * ```
   */
  private _getConsolidatedGenerator(): AsyncGenerator<Product, void, unknown> {
    async function* combineAsyncIterators(
      asyncIterators: SupplierBase<unknown, Product>[],
    ): AsyncGenerator<Product, void, unknown> {
      for (const iterator of asyncIterators) {
        for await (const value of iterator) {
          yield value;
        }
      }
    }

    // Only iterate over the suppliers that are selected (or all if none are selected)
    return combineAsyncIterators(
      Object.entries(suppliers).reduce(
        (result: SupplierBase<unknown, Product>[], [supplierClassName, supplierClass]) => {
          if (this._suppliers.length == 0 || this._suppliers.includes(supplierClassName)) {
            // Cast supplierClass to the correct type to fix type error
            const SupplierClass = supplierClass as new (
              query: string,
              limit: number,
              controller: AbortController,
            ) => SupplierBase<unknown, Product>;
            result.push(new SupplierClass(this._query, 10, this._controller));
          }
          return result;
        },
        [] satisfies SupplierBase<unknown, Product>[],
      ),
    );
  }
}
