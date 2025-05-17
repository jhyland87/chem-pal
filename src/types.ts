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

/**
 * @typeDef {Object} HeaderObject
 * @property {string} [key] - Key-value string pairs for headers
 */
export type HeaderObject = { [key: string]: string };

/**
 * @typeDef {Object} ChromeStorageItems
 * @property {string|number|boolean|null|undefined} [key] - Storage items supporting various primitive types
 */
export type ChromeStorageItems = { [key: string]: string | number | boolean | null | undefined };

/**
 * @typeDef {Object} Settings
 * @property {string} [searchResultUpdateTs] - Timestamp of last search result update
 * @property {boolean} showHelp - Whether to show help tooltips
 * @property {boolean} caching - Whether to enable caching
 * @property {boolean} autocomplete - Whether to enable autocomplete
 * @property {string} currency - Selected currency code
 * @property {string} location - User's location
 * @property {boolean} shipsToMyLocation - Whether to filter for items that ship to user's location
 * @property {string} foo - Temporary setting for testing
 * @property {boolean} jason - Feature flag for Jason's features
 * @property {boolean} antoine - Feature flag for Antoine's features
 * @property {string} popupSize - Size of the popup window
 * @property {boolean} autoResize - Whether to automatically resize the window
 * @property {boolean} someSetting - Generic setting flag
 * @property {string[]} suppliers - List of enabled suppliers
 * @property {string} theme - Current theme (light/dark)
 * @property {boolean} showAllColumns - Whether to show all columns
 * @property {string[]} hideColumns - List of columns to hide
 * @property {boolean} showColumnFilters - Whether to show column filters
 * @property {Record<string, ColumnMeta>} columnFilterConfig - Configuration for column filters
 */
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

/**
 * @typeDef {Object} Product
 * @property {string} supplier - Name of the supplier
 * @property {string} [description] - Product description
 * @property {string} title - Product title
 * @property {string} url - Product URL
 * @property {string} [manufacturer] - Product manufacturer
 * @property {CAS<string>} [cas] - Chemical Abstracts Service number
 * @property {string} [formula] - Chemical formula
 * @property {string} displayPrice - Formatted price string
 * @property {number} price - Numeric price value
 * @property {CurrencyCode} [currencyCode] - Currency code (e.g., USD, EUR)
 * @property {CurrencySymbol} [currencySymbol] - Currency symbol (e.g., $, €)
 * @property {string} [uom] - Unit of measure
 * @property {number} [quantity] - Quantity value
 * @property {string} [displayQuantity] - Formatted quantity string
 * @property {number} [sku] - Stock keeping unit number
 * @property {string} [grade] - Chemical grade
 * @property {string} [conc] - Concentration
 * @property {string} [seoname] - SEO-friendly name
 * @property {string} [status] - Inventory status
 * @property {string} [statusTxt] - Status text message
 * @property {string} [shippingInformation] - Shipping information
 * @property {Variant[]} [variants] - Available variants of the product
 */
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

/**
 * @typeDef {Object} HelpTooltipProps
 * @property {string} text - The help text to display
 * @property {ReactElement<{className?: string}>} children - The element that triggers the tooltip
 * @property {number} [delay] - Delay before showing the tooltip in milliseconds
 * @property {number} [duration] - Duration to show the tooltip in milliseconds
 */
export type HelpTooltipProps = {
  text: string;
  children: ReactElement<{ className?: string }>;
  delay?: number;
  duration?: number;
};

/**
 * @typeDef {Object} Item
 * @property {number} id - Unique identifier
 * @property {string} name - Item name
 * @property {Date} deadline - Deadline date
 * @property {string} type - Item type
 * @property {boolean} isComplete - Whether the item is complete
 * @property {Item[]} [nodes] - Nested items
 */
export interface Item {
  id: number;
  name: string;
  deadline: Date;
  type: string;
  isComplete: boolean;
  nodes?: Item[];
}

/**
 * @typeDef {Object} Sku
 * @property {Object} priceInfo - Price information
 * @property {number[]} priceInfo.regularPrice - Regular price array
 * @property {Object} variantsMap - Variant mapping
 * @property {number} variantsMap.volume - Volume
 * @property {string} variantsMap.chemical-grade - Chemical grade
 * @property {string} variantsMap.concentration - Concentration
 * @property {string} skuId - SKU identifier
 * @property {string} seoName - SEO-friendly name
 * @property {string} inventoryStatus - Current inventory status
 * @property {string} inventoryStatusMsg - Status message
 * @property {Object} specifications - Shipping specifications
 * @property {string} specifications.shippingInformation - Shipping information
 */
export interface Sku {
  priceInfo: { regularPrice: number[] };
  variantsMap: { volume: number; "chemical-grade": string; concentration: string };
  skuId: string;
  seoName: string;
  inventoryStatus: string;
  inventoryStatusMsg: string;
  specifications: { shippingInformation: string };
}

/**
 * @typeDef {Object} Variant
 * @property {number} price - Price of the variant
 * @property {number} quantity - Available quantity
 * @property {number} sku - SKU number
 * @property {string} grade - Chemical grade
 * @property {string} conc - Concentration
 * @property {string} seoname - SEO-friendly name
 * @property {string} status - Current status
 * @property {string} statusTxt - Status text message
 * @property {string} shippingInformation - Shipping information
 */
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

/**
 * @typeDef {Object} SearchProps
 * @property {string} query - Current search query
 * @property {Function} setQuery - Function to update the search query
 */
export interface SearchProps {
  query: string;
  setQuery: (value: string) => void;
}

/**
 * @typeDef {Object} Supplier
 * @property {string} supplierName - Name of the supplier
 * @property {string} _query - Current search query
 * @property {Product[]} _products - Array of products from this supplier
 * @property {Record<string, unknown>[]} _queryResults - Raw query results
 * @property {string} _baseURL - Base URL for the supplier's API
 * @property {AbortController} _controller - Controller for aborting requests
 * @property {number} _limit - Query result limit
 * @property {number} _httpRequestHardLimit - Hard limit for HTTP requests
 */
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

/**
 * @typeDef {Object} TabPanelProps
 * @property {ReactNode} [children] - Child elements
 * @property {string} [dir] - Text direction (ltr/rtl)
 * @property {number} index - Tab index
 * @property {number|string} value - Current value
 * @property {object} [style] - Additional styles
 * @property {string} name - Panel name
 */
export interface TabPanelProps {
  children?: ReactNode;
  dir?: string;
  index: number;
  value: number | string;
  style?: object;
  name: string;
}

/**
 * @typeDef {Object} AppContextProps
 * @property {Settings} settings - Application settings
 * @property {Function} setSettings - Function to update settings
 */
export interface AppContextProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}

/**
 * @typeDef {Object} TableProps
 * @template TData
 * @property {TData[]} data - Array of data to display
 * @property {ColumnDef<TData>[]} columns - Column definitions
 * @property {Function} renderSubComponent - Function to render sub-components
 * @property {Function} getRowCanExpand - Function to determine if a row can be expanded
 * @property {Function} rerender - Function to trigger re-render
 * @property {Function} refreshData - Function to refresh data
 * @property {[ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>]} columnFilterFns - Column filter state and setter
 */
export type TableProps<TData extends RowData> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  renderSubComponent: (props: { row: Row<TData> }) => React.ReactElement;
  getRowCanExpand: (row: Row<TData>) => boolean;
  rerender: () => void;
  refreshData: () => void;
  columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>];
};

/**
 * @typeDef {Object} ProductTableProps
 * @template TData
 * @property {ColumnDef<TData, unknown>[]} [columns] - Column definitions
 * @property {Function} renderVariants - Function to render variants
 * @property {Function} getRowCanExpand - Function to determine if a row can be expanded
 * @property {[ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>]} columnFilterFns - Column filter state and setter
 */
export type ProductTableProps<TData extends RowData> = {
  columns?: ColumnDef<TData, unknown>[];
  renderVariants: (props: { row: Row<TData> }) => React.ReactElement;
  getRowCanExpand: (row: Row<TData>) => boolean;
  columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>];
};

/**
 * @typeDef {Object} ProductTableHeader
 * @template TData
 * @property {string} id - Column ID
 * @property {number} colSpan - Number of columns to span
 * @property {boolean} isPlaceholder - Whether this is a placeholder
 * @property {ColumnDef<TData, unknown>} column - Column definition
 * @property {Function} getCanFilter - Function to check if column can be filtered
 * @property {Function} getCanSort - Function to check if column can be sorted
 * @property {Function} getToggleSortingHandler - Function to handle sort toggle
 * @property {Function} getIsSorted - Function to get current sort state
 * @property {Function} getContext - Function to get column context
 * @property {Function} getSize - Function to get column size
 * @property {Partial<ColumnDef<TData>>} columnDef - Column definition with partial properties
 */
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

/**
 * @typeDef {Object} FilterVariantComponentProps
 * @property {CustomColumn<Product, unknown>} column - Column to filter
 */
export type FilterVariantComponentProps = {
  column: CustomColumn<Product, unknown>;
};

/**
 * @typeDef {Object} TableOptionsProps
 * @property {Table<Product>} table - Table instance
 * @property {string} searchInput - Current search input
 * @property {Dispatch<SetStateAction<string>>} setSearchInput - Function to update search input
 */
export type TableOptionsProps = {
  table: Table<Product>;
  searchInput: string;
  setSearchInput: Dispatch<SetStateAction<string>>;
};

/**
 * @typeDef {Object} ProductRow
 * @property {Row<Product>} row - Row data
 */
export type ProductRow = {
  row: Row<Product>;
};

/**
 * @typeDef {Object} TextOptionFacet
 * @property {string} name - Facet name
 * @property {string} value - Facet value
 */
export interface TextOptionFacet {
  name: string;
  value: string;
}

/**
 * @typeDef {Object} WixProduct
 * @property {string} [discountedPrice] - Discounted price if available
 * @property {string} price - Regular price
 * @property {string} title - Product title
 * @property {string} url - Product URL
 * @property {TextOptionFacet[]} [textOptionsFacets] - Text option facets
 */
export interface WixProduct {
  discountedPrice?: string;
  price: string;
  title: string;
  url: string;
  textOptionsFacets?: TextOptionFacet[];
}

/**
 * @typeDef {Object} FilterInputProps
 * @property {Column<Product, unknown>} [column] - Column to filter
 * @property {ReactNode} [children] - Child elements
 * @property {string[]|number[]} [rangeValues] - Range values for numeric filters
 * @property {string} [label] - Input label
 * @property {Function} [onChange] - Change event handler
 * @property {string} [value] - Current value
 * @property {Record<string, unknown>} [props] - Additional props
 */
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

/**
 * @typeDef {Object} ColumnMeta
 * @property {("range"|"select"|"text")} [filterVariant] - Type of filter variant
 * @property {string[]} [uniqueValues] - Unique values for select filters
 * @property {number[]} [rangeValues] - Range values for numeric filters
 * @property {CSSProperties} [style] - Custom styles
 */
export interface ColumnMeta {
  filterVariant?: "range" | "select" | "text";
  uniqueValues?: string[];
  rangeValues?: number[];
  style?: CSSProperties;
}

/**
 * @typeDef {Object} CustomColumn
 * @template TData
 * @template TValue
 * @property {Object} columnDef - Column definition
 * @property {ColumnMeta} [columnDef.meta] - Column metadata
 */
export type CustomColumn<TData extends RowData, TValue = unknown> = Column<TData, TValue> & {
  columnDef: {
    meta?: ColumnMeta;
  };
};

/**
 * @typeDef {Object} Props
 * @template T
 * @property {T[]} data - Array of items to render
 * @property {Function} renderItem - Function to render each item
 */
export type Props<T> = {
  data: T[];
  renderItem: (item: T) => React.ReactNode;
};

/**
 * @typeDef {Object} IconSpinnerProps
 * @property {number} [size] - Size of the spinner
 * @property {unknown} [key] - Additional props
 */
export interface IconSpinnerProps {
  size?: number;
  [key: string]: unknown;
}

/**
 * @typeDef {Object} FilterVariantInputProps
 * @property {CustomColumn<Product, unknown>} column - Column to filter
 * @property {unknown} [key] - Additional props
 */
export type FilterVariantInputProps = {
  column: CustomColumn<Product, unknown>;
  [key: string]: unknown;
};
