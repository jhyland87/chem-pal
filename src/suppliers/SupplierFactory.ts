import * as suppliers from "../suppliers";
import SupplierBase from "../suppliers/supplier_base";
import { Product } from "../types";

/**
 * Factory class for querying all suppliers.
 * @category Supplier
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
   * @param query {string} - Value to query for
   * @param controller {AbortController} - Fetch controller (can be used to terminate the query)
   * @param suppliers {Array} - Array of suppliers to query (empty is the same as querying all)
   */
  constructor(query: string, controller: AbortController, suppliers: Array<string> = []) {
    this._query = query;
    this._controller = controller;
    this._suppliers = suppliers;
  }

  /**
   * Get the names of the supplier modules
   *
   * @returns {array} - List of supplier class names
   */
  public static supplierList(): Array<string> {
    return Object.keys(suppliers);
  }

  /**
   * Async iterator yielding results
   * @returns AsyncGenerator<T, void, unknown>
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
   * Creates a master async generator that only includes the suppliers selected to query.
   * @returns AsyncGenerator<Product, void, unknown>
   */
  private _getConsolidatedGenerator(): AsyncGenerator<Product, void, unknown> {
    async function* combineAsyncIterators(
      asyncIterators: SupplierBase<Product>[],
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
        (result: SupplierBase<Product>[], [supplierClassName, supplierClass]) => {
          if (this._suppliers.length == 0 || this._suppliers.includes(supplierClassName))
            result.push(new supplierClass(this._query, 10, this._controller));
          return result;
        },
        [] as SupplierBase<Product>[],
      ),
    );
  }
}
