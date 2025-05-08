
import { ReactNode } from 'react';

export interface ISettings {
  caching: boolean;
  autocomplete: boolean;
  currency: string;
  location: string;
  shipsToMyLocation: boolean;
  foo: string;
  jason: boolean;
  antoine: boolean;
  popupSize: string;
  autoResize: boolean;
  someSetting: boolean;
  suppliers: Array<string>;
}

export interface IItem {
  id: number;
  name: string;
  deadline: Date;
  type: string;
  isComplete: boolean;
  nodes?: IItem[];
}

export interface ISku {
  priceInfo: { regularPrice: number[] };
  variantsMap: { volume: number; 'chemical-grade': string; concentration: string };
  skuId: string;
  seoName: string;
  inventoryStatus: string;
  inventoryStatusMsg: string;
  specifications: { shippingInformation: string };
}

export interface IVariant {
  price: number;
  quantity: number;
  sku: number;
  grade: string;
  conc: string;
  seoname: string;
  status: string;
  statusTxt: string;
  shippingInformation: string;
}

export interface ISearchProps {
  query: string;
  setQuery: (value: string) => void;
}

export interface ISupplier {
  supplierName: string;
  _query: string;
  _products: Array<IProduct>;
  _query_results: Array<any>;
  _baseURL: string;
  _controller: AbortController;
  _is_aborted: boolean;
  _limit: number;
  _http_request_hard_limit: number;
}

export interface IProduct {
  supplier: string;
  title: string;
  url: string;
  manufacturer?: string;
  cas?: string;
  formula?: string;
  price: number;
  quantity: number;
  sku?: number;
  grade?: string;
  conc?: string;
  seoname?: string;
  status?: string;
  statusTxt?: string;
  shippingInformation?: string;
  variants?: IVariant[];
}

export interface IChromeStorageItems {
  [key: string]: any;
}

export type IHeaderObject = { [key: string]: string };

export interface ITabPanelProps {
  children?: ReactNode;
  dir?: string;
  index: number;
  value: number;
  style?: object
}

export interface ISettingsContext {
  settings: ISettings;
  setSettings: (settings: ISettings) => void;
}
