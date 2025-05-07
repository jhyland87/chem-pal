
import { Product, Supplier } from './types'
import * as suppliers from './suppliers'
import SupplierBase from './suppliers/supplier_base'

export default class SupplierFactory<T extends Product> implements AsyncIterable<T> {
  public static supplier_list: Array<string> = Object.keys(suppliers).map(s => s.replace(/^Supplier/, ''))

  private _query: string

  private _controller: AbortController

  constructor(query: string, controller: AbortController) {
    this._query = query
    this._controller = controller
  }

  public static supplierList() {
    return Object.keys(suppliers).map(s => s.replace(/^Supplier/, ''))
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    try {
      async function* combineAsyncIterators(asyncIterators: (SupplierBase<Product>)[]) {
        for (const iterator of asyncIterators) {
          for await (const value of iterator) {
            yield value;
          }
        }
      }

      const masterIterator = combineAsyncIterators(Object.values(suppliers).map(s => new s(this._query, 10, this._controller)))

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

