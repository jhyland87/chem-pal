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
 * HeaderObject represents key-value string pairs for headers
 * @param {string} [key] - Key-value string pairs for headers
 */
export type HeaderObject = { [key: string]: string };

/**
 * ChromeStorageItems represents storage items supporting various primitive types
 * @param {string|number|boolean|null|undefined} [key] - Storage items supporting various primitive types
 */
export type ChromeStorageItems = { [key: string]: string | number | boolean | null | undefined };

/**
 * Settings interface for application configuration
 * @param {string} [searchResultUpdateTs] - Timestamp of last search result update
 * @param {boolean} showHelp - Whether to show help tooltips
 * @param {boolean} caching - Whether to enable caching
 * @param {boolean} autocomplete - Whether to enable autocomplete
 * @param {string} currency - Selected currency code
 * @param {string} location - User's location
 * @param {boolean} shipsToMyLocation - Whether to filter for items that ship to user's location
 * @param {string} foo - Temporary setting for testing
 * @param {boolean} jason - Feature flag for Jason's features
 * @param {boolean} antoine - Feature flag for Antoine's features
 * @param {string} popupSize - Size of the popup window
 * @param {boolean} autoResize - Whether to automatically resize the window
 * @param {boolean} someSetting - Generic setting flag
 * @param {string[]} suppliers - List of enabled suppliers
 * @param {string} theme - Current theme (light/dark)
 * @param {boolean} showAllColumns - Whether to show all columns
 * @param {string[]} hideColumns - List of columns to hide
 * @param {boolean} showColumnFilters - Whether to show column filters
 * @param {Record<string, ColumnMeta>} columnFilterConfig - Configuration for column filters
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
 * Product interface representing a chemical product
 * @param {string} supplier - Name of the supplier
 * @param {string} [description] - Product description
 * @param {string} title - Product title
 * @param {string} url - Product URL
 * @param {string} [manufacturer] - Product manufacturer
 * @param {CAS<string>} [cas] - Chemical Abstracts Service number
 * @param {string} [formula] - Chemical formula
 * @param {string} displayPrice - Formatted price string
 * @param {number} price - Numeric price value
 * @param {CurrencyCode} [currencyCode] - Currency code (e.g., USD, EUR)
 * @param {CurrencySymbol} [currencySymbol] - Currency symbol (e.g., $, €)
 * @param {string} [uom] - Unit of measure
 * @param {number} [quantity] - Quantity value
 * @param {string} [displayQuantity] - Formatted quantity string
 * @param {number} [sku] - Stock keeping unit number
 * @param {string} [grade] - Chemical grade
 * @param {string} [conc] - Concentration
 * @param {string} [seoname] - SEO-friendly name
 * @param {string} [status] - Inventory status
 * @param {string} [statusTxt] - Status text message
 * @param {string} [shippingInformation] - Shipping information
 * @param {Variant[]} [variants] - Available variants of the product
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
 * HelpTooltipProps interface for help tooltip component
 * @param {string} text - The help text to display
 * @param {ReactElement<{className?: string}>} children - The element that triggers the tooltip
 * @param {number} [delay] - Delay before showing the tooltip in milliseconds
 * @param {number} [duration] - Duration to show the tooltip in milliseconds
 */
export type HelpTooltipProps = {
  text: string;
  children: ReactElement<{ className?: string }>;
  delay?: number;
  duration?: number;
};

/**
 * Item interface representing a task or item
 * @param {number} id - Unique identifier
 * @param {string} name - Item name
 * @param {Date} deadline - Deadline date
 * @param {string} type - Item type
 * @param {boolean} isComplete - Whether the item is complete
 * @param {Item[]} [nodes] - Nested items
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
 * Sku interface representing a stock keeping unit
 * @param {Object} priceInfo - Price information
 * @param {number[]} priceInfo.regularPrice - Regular price array
 * @param {Object} variantsMap - Variant mapping
 * @param {number} variantsMap.volume - Volume
 * @param {string} variantsMap.chemical-grade - Chemical grade
 * @param {string} variantsMap.concentration - Concentration
 * @param {string} skuId - SKU identifier
 * @param {string} seoName - SEO-friendly name
 * @param {string} inventoryStatus - Current inventory status
 * @param {string} inventoryStatusMsg - Status message
 * @param {Object} specifications - Shipping specifications
 * @param {string} specifications.shippingInformation - Shipping information
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
 * Variant interface representing a product variant
 * @param {number} price - Price of the variant
 * @param {number} quantity - Available quantity
 * @param {number} sku - SKU number
 * @param {string} grade - Chemical grade
 * @param {string} conc - Concentration
 * @param {string} seoname - SEO-friendly name
 * @param {string} status - Current status
 * @param {string} statusTxt - Status text message
 * @param {string} shippingInformation - Shipping information
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
 * SearchProps interface for search functionality
 * @param {string} query - Current search query
 * @param {Function} setQuery - Function to update the search query
 */
export interface SearchProps {
  query: string;
  setQuery: (value: string) => void;
}

/**
 * Supplier interface representing a product supplier
 * @param {string} supplierName - Name of the supplier
 * @param {string} _query - Current search query
 * @param {Product[]} _products - Array of products from this supplier
 * @param {Record<string, unknown>[]} _queryResults - Raw query results
 * @param {string} _baseURL - Base URL for the supplier's API
 * @param {AbortController} _controller - Controller for aborting requests
 * @param {number} _limit - Query result limit
 * @param {number} _httpRequestHardLimit - Hard limit for HTTP requests
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
 * TabPanelProps interface for tab panel component
 * @param {ReactNode} [children] - Child elements
 * @param {string} [dir] - Text direction (ltr/rtl)
 * @param {number} index - Tab index
 * @param {number|string} value - Current value
 * @param {object} [style] - Additional styles
 * @param {string} name - Panel name
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
 * AppContextProps interface for application context
 * @param {Settings} settings - Application settings
 * @param {Function} setSettings - Function to update settings
 */
export interface AppContextProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}

/**
 * TableProps interface for table component
 * @typeParam TData - The type of data in the table
 * @param {TData[]} data - Array of data to display
 * @param {ColumnDef<TData>[]} columns - Column definitions
 * @param {Function} renderSubComponent - Function to render sub-components
 * @param {Function} getRowCanExpand - Function to determine if a row can be expanded
 * @param {Function} rerender - Function to trigger re-render
 * @param {Function} refreshData - Function to refresh data
 * @param {[ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>]} columnFilterFns - Column filter state and setter
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
 * ProductTableProps interface for product table component
 * @typeParam TData - The type of data in the product table
 * @param {ColumnDef<TData, unknown>[]} [columns] - Column definitions
 * @param {Function} renderVariants - Function to render variants
 * @param {Function} getRowCanExpand - Function to determine if a row can be expanded
 * @param {[ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>]} columnFilterFns - Column filter state and setter
 */
export type ProductTableProps<TData extends RowData> = {
  columns?: ColumnDef<TData, unknown>[];
  renderVariants: (props: { row: Row<TData> }) => React.ReactElement;
  getRowCanExpand: (row: Row<TData>) => boolean;
  columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>];
};

/**
 * ProductTableHeader interface for table header component
 * @typeParam TData - The type of data in the table header
 * @param {string} id - Column ID
 * @param {number} colSpan - Number of columns to span
 * @param {boolean} isPlaceholder - Whether this is a placeholder
 * @param {ColumnDef<TData, unknown>} column - Column definition
 * @param {Function} getCanFilter - Function to check if column can be filtered
 * @param {Function} getCanSort - Function to check if column can be sorted
 * @param {Function} getToggleSortingHandler - Function to handle sort toggle
 * @param {Function} getIsSorted - Function to get current sort state
 * @param {Function} getContext - Function to get column context
 * @param {Function} getSize - Function to get column size
 * @param {Partial<ColumnDef<TData>>} columnDef - Column definition with partial properties
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
 * FilterVariantComponentProps interface for filter variant component
 * @param {CustomColumn<Product, unknown>} column - Column to filter
 */
export type FilterVariantComponentProps = {
  column: CustomColumn<Product, unknown>;
};

/**
 * TableOptionsProps interface for table options component
 * @param {Table<Product>} table - Table instance
 * @param {string} searchInput - Current search input
 * @param {Dispatch<SetStateAction<string>>} setSearchInput - Function to update search input
 */
export type TableOptionsProps = {
  table: Table<Product>;
  searchInput: string;
  setSearchInput: Dispatch<SetStateAction<string>>;
};

/**
 * ProductRow interface representing a row in the product table
 * @param {Row<Product>} row - Row data
 */
export type ProductRow = {
  row: Row<Product>;
};

/**
 * TextOptionFacet interface for text option facets
 * @param {string} name - Facet name
 * @param {string} value - Facet value
 */
export interface TextOptionFacet {
  name: string;
  value: string;
}

/**
 * WixProduct interface representing a Wix product
 * @param {string} [discountedPrice] - Discounted price if available
 * @param {string} price - Regular price
 * @param {string} title - Product title
 * @param {string} url - Product URL
 * @param {TextOptionFacet[]} [textOptionsFacets] - Text option facets
 */
export interface WixProduct {
  discountedPrice?: string;
  price: string;
  title: string;
  url: string;
  textOptionsFacets?: TextOptionFacet[];
}

/**
 * FilterInputProps interface for filter input component
 * @param {Column<Product, unknown>} [column] - Column to filter
 * @param {ReactNode} [children] - Child elements
 * @param {string[]|number[]} [rangeValues] - Range values for numeric filters
 * @param {string} [label] - Input label
 * @param {Function} [onChange] - Change event handler
 * @param {string} [value] - Current value
 * @param {Record<string, unknown>} [props] - Additional props
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
 * ColumnMeta interface for column metadata
 * @param {("range"|"select"|"text")} [filterVariant] - Type of filter variant
 * @param {string[]} [uniqueValues] - Unique values for select filters
 * @param {number[]} [rangeValues] - Range values for numeric filters
 * @param {CSSProperties} [style] - Custom styles
 */
export interface ColumnMeta {
  filterVariant?: "range" | "select" | "text";
  uniqueValues?: string[];
  rangeValues?: number[];
  style?: CSSProperties;
}

/**
 * CustomColumn interface for custom column definition
 * @typeParam TData - The type of data in the column
 * @typeParam TValue - The type of value in the column
 * @param {Object} columnDef - Column definition
 * @param {ColumnMeta} [columnDef.meta] - Column metadata
 */
export type CustomColumn<TData extends RowData, TValue = unknown> = Column<TData, TValue> & {
  columnDef: {
    meta?: ColumnMeta;
  };
};

/**
 * Props interface for generic component props
 * @typeParam T - The type of items to render
 * @param {T[]} data - Array of items to render
 * @param {Function} renderItem - Function to render each item
 */
export type Props<T> = {
  data: T[];
  renderItem: (item: T) => React.ReactNode;
};

/**
 * IconSpinnerProps interface for icon spinner component
 * @param {number} [size] - Size of the spinner
 * @param {unknown} [key] - Additional props
 */
export interface IconSpinnerProps {
  size?: number;
  [key: string]: unknown;
}

/**
 * FilterVariantInputProps interface for filter variant input component
 * @param {CustomColumn<Product, unknown>} column - Column to filter
 * @param {unknown} [key] - Additional props
 */
export type FilterVariantInputProps = {
  column: CustomColumn<Product, unknown>;
  [key: string]: unknown;
};
