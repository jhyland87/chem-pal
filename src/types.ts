
import { ReactNode } from 'react';

export interface Settings {
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

export interface Item {
  id: number;
  name: string;
  deadline: Date;
  type: string;
  isComplete: boolean;
  nodes?: Item[];
}

export interface Sku {
  priceInfo: { regularPrice: number[] };
  variantsMap: { volume: number; 'chemical-grade': string; concentration: string };
  skuId: string;
  seoName: string;
  inventoryStatus: string;
  inventoryStatusMsg: string;
  specifications: { shippingInformation: string };
}

export interface Variant {
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

export interface SearchProps {
  query: string;
  setQuery: (value: string) => void;
}

export interface Supplier {
  supplierName: string;
  _query: string;
  _products: Array<Product>;
  _query_results: Array<any>;
  _baseURL: string;
  _controller: AbortController;
  _is_aborted: boolean;
  _limit: number;
  _http_request_hard_limit: number;
}

export interface Product {
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
  variants?: Variant[];
}

export interface ChromeStorageItems {
  [key: string]: any;
}

export type HeaderObject = { [key: string]: string };

export interface TabPanelProps {
  children?: ReactNode;
  dir?: string;
  index: number;
  value: number;
  style?: object
}

export interface SettingsContextProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}
