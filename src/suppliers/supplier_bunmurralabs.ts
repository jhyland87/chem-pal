import { Product } from '../types'
import SupplierWixBase from './supplier_wixbase'


export default class SupplierBunmurraLabs<T extends Product> extends SupplierWixBase<T> implements AsyncIterable<T> {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = 'Bunmurra Labs'

  // Base URL for HTTP(s) requests
  protected _baseURL: string = 'https://www.bunmurralabs.store';
}

