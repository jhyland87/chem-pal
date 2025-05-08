import { IProduct } from '../types'
import SupplierWixBase from './supplier_wixbase'


export default class SupplierFtfScientific<T extends IProduct> extends SupplierWixBase<T> implements AsyncIterable<T> {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = 'FTF Scientific'

  // Base URL for HTTP(s) requests
  protected _baseURL: string = 'https://www.ftfscientific.com';
}

