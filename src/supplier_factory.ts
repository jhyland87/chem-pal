
import { IProduct, ISupplier } from './types'
import * as suppliers from './suppliers'
import SupplierBase from './suppliers/supplier_base'

export default class SupplierFactory<T extends IProduct> implements AsyncIterable<T> {
  public static supplier_list: Array<string> = Object.keys(suppliers)

  private _query: string

  private _controller: AbortController

  private _suppliers: Array<string>

  constructor(query: string, controller: AbortController, suppliers: Array<string> = []) {
    this._query = query
    this._controller = controller
    this._suppliers = suppliers
  }

  public static supplierList() {
    return Object.keys(suppliers)
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    try {
      async function* combineAsyncIterators(asyncIterators: (SupplierBase<IProduct>)[]) {
        for (const iterator of asyncIterators) {
          for await (const value of iterator) {
            yield value;
          }
        }
      }

      // Only iterate over the suppliers that are selected (or all if none are selected)
      const masterIterator = combineAsyncIterators(
        Object.entries(suppliers)
          .filter(([supplierClassName, _]) => this._suppliers.length == 0 || this._suppliers.includes(supplierClassName))
          .map(([_, supplierClass]) => supplierClass)
          .map(supplierClass => new supplierClass(this._query, 10, this._controller))
      )

      for await (const value of masterIterator) {
        yield value as T;
      }
    }
    catch (err) { // Here to catch when the overall search fails
      if (this._controller.signal.aborted === true) {
        console.debug('Search was aborted')
        return
      }
      console.error('ERROR in generator fn:', err)
    }
  }
}

