
import { Dispatch, ReactNode, SetStateAction } from 'react';
import { CurrencyCode, CurrencySymbol } from './types/currency';
import { CAS } from './types/cas';
import { ColumnDef, ColumnFiltersState, Row, RowData } from '@tanstack/react-table';
export * from './types/quantity'
export * from './types/cas'
export * from './types/currency'


export type HeaderObject = { [key: string]: string };
export type ChromeStorageItems = { [key: string]: any };


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
  theme: string;
  showAllColumns: boolean;
  showColumns: Array<string>;
  showColumnFilters: boolean;
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
  _queryResults: Array<any>;
  _baseURL: string;
  _controller: AbortController;
  _limit: number;
  _httpRequestHardLimit: number;
}

export interface Product {
  supplier: string;
  description?: string;
  title: string;
  url: string;
  manufacturer?: string;
  cas?: CAS<string>;
  formula?: string;
  displayPrice: string;
  price: number;
  currencyCode?: CurrencyCode;
  currencySymbol?: CurrencySymbol;
  uom?: string;
  quantity?: number;
  displayQuantity?: string;
  sku?: number;
  grade?: string;
  conc?: string;
  seoname?: string;
  status?: string;
  statusTxt?: string;
  shippingInformation?: string;
  variants?: Variant[];
}


export interface TabPanelProps {
  children?: ReactNode;
  dir?: string;
  index: number;
  value: number | string;
  style?: object;
  name: string;
}

export interface SettingsContextProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}



export type TableProps<TData extends RowData> = {
  data: TData[]
  columns: ColumnDef<TData>[]
  renderSubComponent: (props: { row: Row<TData> }) => React.ReactElement
  getRowCanExpand: (row: Row<TData>) => boolean
  rerender: () => void
  refreshData: () => void
  //columnFilters: ColumnFiltersState
  //setColumnFilters: (columnFilters: OnChangeFn<ColumnFiltersState>) => void
  columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>]
}

export type ProductTableProps<TData extends RowData> = {
  columns: ColumnDef<TData, any>[]
  renderVariants: (props: { row: Row<TData> }) => React.ReactElement
  getRowCanExpand: (row: Row<TData>) => boolean
  //columnFilters: ColumnFiltersState
  //setColumnFilters: (columnFilters: OnChangeFn<ColumnFiltersState>) => void
  columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>]
}

export type ProductTableHeader<TData extends RowData> = {
  id: string;
  colSpan: number;
  isPlaceholder: boolean;
  column: ColumnDef<TData, any>
  getCanFilter: () => boolean;
  getCanSort: () => boolean;
  getToggleSortingHandler: () => void;
  getIsSorted: () => string;
  getContext: () => any;
  getSize: () => number;
  columnDef: Partial<ColumnDef<TData>>;
}

export type EnhancedTableToolbarProps = {
  table: any;
  searchInput: string;
  setSearchInput: Dispatch<SetStateAction<string>>;
}

export type ProductRow = {
  row: Row<Product>
}