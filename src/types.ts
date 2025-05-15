import { SelectChangeEvent } from "@mui/material/Select";
import { Column, ColumnDef, ColumnFiltersState, Row, RowData, Table } from "@tanstack/react-table";
import {
  ChangeEvent,
  ChangeEventHandler,
  CSSProperties,
  Dispatch,
  ReactElement,
  ReactNode,
  SetStateAction,
} from "react";
import { CAS } from "./types/cas";
import { CurrencyCode, CurrencySymbol } from "./types/currency";
export * from "./types/cas";
export * from "./types/currency";
export * from "./types/quantity";

export type HeaderObject = { [key: string]: string };
export type ChromeStorageItems = { [key: string]: string | number | boolean | null | undefined };

export interface Settings {
  searchResultUpdateTs?: string;
  showHelp: boolean;
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
  hideColumns: Array<string>;
  showColumnFilters: boolean;
  columnFilterConfig: Record<string, ColumnMeta>;
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
  variantsMap: { volume: number; "chemical-grade": string; concentration: string };
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
  _queryResults: Array<Record<string, unknown>>;
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
  //setSetting: (key: string, value: unknown) => void;
}

export type TableProps<TData extends RowData> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  renderSubComponent: (props: { row: Row<TData> }) => React.ReactElement;
  getRowCanExpand: (row: Row<TData>) => boolean;
  rerender: () => void;
  refreshData: () => void;
  //columnFilters: ColumnFiltersState
  //setColumnFilters: (columnFilters: OnChangeFn<ColumnFiltersState>) => void
  columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>];
};

export type ProductTableProps<TData extends RowData> = {
  columns?: ColumnDef<TData, unknown>[];
  renderVariants: (props: { row: Row<TData> }) => React.ReactElement;
  getRowCanExpand: (row: Row<TData>) => boolean;
  //columnFilters: ColumnFiltersState
  //setColumnFilters: (columnFilters: OnChangeFn<ColumnFiltersState>) => void
  columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>];
};

export type ProductTableHeader<TData extends RowData> = {
  id: string;
  colSpan: number;
  isPlaceholder: boolean;
  column: ColumnDef<TData, unknown>;
  getCanFilter: () => boolean;
  getCanSort: () => boolean;
  getToggleSortingHandler: () => void;
  getIsSorted: () => string;
  getContext: () => Record<string, unknown>;
  getSize: () => number;
  columnDef: Partial<ColumnDef<TData>>;
};

export type TableOptionsProps = {
  table: Table<Product>;
  searchInput: string;
  setSearchInput: Dispatch<SetStateAction<string>>;
};

export type ProductRow = {
  row: Row<Product>;
};

export type HelpTooltipProps = {
  text: string;
  children: ReactElement<{ className?: string }>;
  delay?: number;
  duration?: number;
};

export interface TextOptionFacet {
  name: string;
  value: string;
}
export interface WixProduct {
  discountedPrice?: string;
  price: string;
  title: string;
  url: string;
  textOptionsFacets?: TextOptionFacet[];
}

export type FilterInputProps = {
  column?: Column<Product, unknown>;
  children?: ReactNode;
  rangeValues?: string[] | number[];
  label?: string;
  onChange?: (
    event:
      | SelectChangeEvent<string>
      | ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>
      | undefined,
  ) => void;
  value?: string;
  props?: Record<string, unknown>;
};

/*
export type ColumnMeta = {
  filterVariant?: "range" | "select" | "text";
  uniqueValues?: string[];
  rangeValues?: number[];
  style?: CSSProperties;
};
*/

export interface ColumnMeta {
  filterVariant?: "range" | "select" | "text";
  uniqueValues?: string[];
  rangeValues?: number[];
  style?: CSSProperties;
}

export type CustomColumn<TData extends RowData, TValue = unknown> = Column<TData, TValue> & {
  columnDef: {
    meta?: ColumnMeta;
  };
};

export type Props<T> = {
  data: T[];
  renderItem: (item: T) => React.ReactNode;
};

export interface IconSpinnerProps {
  size?: number;
  [key: string]: unknown; // Optional: To allow additional props
}

export type FilterVariantInputProps = {
  columnConfig: CustomColumn<Product, unknown>;
};
