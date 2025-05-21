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
import { CAS } from "types/cas";
import { CurrencyCode, CurrencySymbol } from "types/currency";

/**
 * ChromeStorageItems represents storage items supporting various primitive types
 */
export interface ChromeStorageItems {
  /** Key-value pairs where values can be primitive types */
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Settings interface for application configuration
 */
export interface Settings {
  /** Timestamp of last search result update */
  searchResultUpdateTs?: string;
  /** Whether to show help tooltips */
  showHelp: boolean;
  /** Whether to enable caching */
  caching: boolean;
  /** Whether to enable autocomplete */
  autocomplete: boolean;
  /** Selected currency code */
  currency: string;
  /** User's location */
  location: string;
  /** Whether to show products that ship to user's location */
  shipsToMyLocation: boolean;
  /** Foo setting */
  foo: string;
  /** Jason feature flag */
  jason: boolean;
  /** Antoine feature flag */
  antoine: boolean;
  /** Size of popup window */
  popupSize: string;
  /** Whether to automatically resize */
  autoResize: boolean;
  /** Some setting flag */
  someSetting: boolean;
  /** List of enabled suppliers */
  suppliers: Array<string>;
  /** Selected theme */
  theme: string;
  /** Whether to show all columns */
  showAllColumns: boolean;
  /** List of columns to hide */
  hideColumns: Array<string>;
  /** Whether to show column filters */
  showColumnFilters: boolean;
  /** Configuration for column filters */
  columnFilterConfig: Record<string, ColumnMeta>;
}

/**
 * Variant interface representing a product variant
 */
export interface Variant {
  /** Title of the variant */
  title?: string;
  /** Unit of measurement */
  uom?: string;
  /** Price of the variant */
  price?: number;
  /** Quantity available */
  quantity?: number;
  /** Base quantity for conversion */
  baseQuantity?: number;
  /** Base unit of measurement */
  baseUom?: UOM;
  /** Price in USD */
  usdPrice?: number;
  /** Stock keeping unit identifier */
  sku?: number | string;
  /** URL to product page */
  url?: string;
  /** Unique identifier */
  id?: number | string;
  /** Universal unique identifier */
  uuid?: number | string;
  /** Chemical grade */
  grade?: string;
  /** Concentration */
  conc?: string;
  /** Status of the variant */
  status?: string;
  /** Status text description */
  statusTxt?: string;
  /** Shipping information */
  shippingInformation?: string;
}

/**
 * Product interface representing a chemical product
 */
export interface Product extends Variant {
  /** Currency code for pricing */
  currencyCode: CurrencyCode;
  /** Currency symbol for display */
  currencySymbol: CurrencySymbol;
  /** Available quantity */
  quantity: number;
  /** Product price */
  price: number;
  /** Unit of measurement */
  uom: string;
  /** Product supplier */
  supplier: string;
  /** Product description */
  description?: string;
  /** Product manufacturer */
  manufacturer?: string;
  /** Chemical Abstracts Service number */
  cas?: CAS<string>;
  /** Chemical formula */
  formula?: string;
  /** Product vendor */
  vendor?: string;
  /** Available variants */
  variants?: Variant[];
}

export interface Product extends Variant {
  currencyCode: CurrencyCode;
  currencySymbol: CurrencySymbol;
  quantity: number;
  price: number;
  uom: string;
  //commonUom: UOM;
  supplier: string;
  description?: string;
  //usdPrice?: string;
  //title: string;
  //url: string;
  //price: number;
  manufacturer?: string;
  cas?: CAS<string>;
  formula?: string;
  //displayPrice?: string | number;
  //displayQuantity?: string;
  //sku?: number;
  //grade?: string;
  //conc?: string;
  //seoname?: string;
  //status?: string;
  //statusTxt?: string;
  //shippingInformation?: string;
  vendor?: string;
  variants?: Variant[];
}

/**
 * HelpTooltipProps interface for help tooltip component
 */
export interface HelpTooltipProps {
  /** Tooltip text content */
  text: string;
  /** Child element to attach tooltip to */
  children: ReactElement<{ className?: string }>;
  /** Delay before showing tooltip in milliseconds */
  delay?: number;
  /** Duration to show tooltip in milliseconds */
  duration?: number;
}

/**
 * Item interface representing a task or item
 */
export interface Item {
  /** Unique identifier */
  id: number;
  /** Item name */
  name: string;
  /** Deadline date */
  deadline: Date;
  /** Item type */
  type: string;
  /** Completion status */
  isComplete: boolean;
  /** Nested items */
  nodes?: Item[];
}

/**
 * Sku interface representing a stock keeping unit
 */
export interface Sku {
  /** Price information */
  priceInfo: {
    /** Regular price array */
    regularPrice: number[];
  };
  /** Variant mapping */
  variantsMap: {
    /** Volume */
    volume: number;
    /** Chemical grade */
    chemicalGrade: string;
    /** Concentration */
    concentration: string;
  };
  /** SKU identifier */
  skuId: string;
  /** SEO-friendly name */
  seoName: string;
  /** Inventory status */
  inventoryStatus: string;
  /** Inventory status message */
  inventoryStatusMsg: string;
  /** Product specifications */
  specifications: {
    /** Shipping information */
    shippingInformation: string;
  };
}

/**
 * ProductDetails interface for detailed product information
 */
export interface ProductDetails {
  /** Product name */
  name: string;
  /** Product description */
  description: string;
  /** Product price */
  price: number;
  /** Product quantity */
}

/**
 * SearchProps interface for search component
 */
export interface SearchProps {
  /** Search query string */
  query: string;
  /** Function to update search query */
  setQuery: (value: string) => void;
}

/**
 * Supplier interface representing a product supplier
 */
export interface Supplier {
  /** Name of the supplier */
  supplierName: string;
  /** Current search query */
  _query: string;
  /** Array of products */
  _products: Array<Product>;
  /** Raw query results */
  _queryResults: Array<Record<string, unknown>>;
  /** Base URL for API */
  _baseURL: string;
  /** Abort controller for requests */
  _controller: AbortController;
  /** Result limit */
  _limit: number;
  /** Hard limit for HTTP requests */
  _httpRequestHardLimit: number;
  /** HTTP request headers */
  _headers: HeadersInit;
}

/**
 * TabPanelProps interface for tab panel component
 */
export interface TabPanelProps {
  /** Child elements */
  children?: ReactNode;
  /** Text direction */
  dir?: string;
  /** Tab index */
  index: number;
  /** Current value */
  value: number | string;
  /** Custom styles */
  style?: object;
  /** Panel name */
  name: string;
}

/**
 * AppContextProps interface for application context
 */
export interface AppContextProps {
  /** Application settings */
  settings: Settings;
  /** Function to update settings */
  setSettings: (settings: Settings) => void;
}

/**
 * TableProps interface for table component
 */
export interface TableProps<TData extends RowData> {
  /** Table data array */
  data: TData[];
  /** Column definitions */
  columns: ColumnDef<TData>[];
  /** Function to render sub-component */
  renderSubComponent: (props: { row: Row<TData> }) => React.ReactElement;
  /** Function to determine if row can expand */
  getRowCanExpand: (row: Row<TData>) => boolean;
  /** Function to trigger re-render */
  rerender: () => void;
  /** Function to refresh data */
  refreshData: () => void;
  /** Column filter state and setter */
  columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>];
}

/**
 * ProductTableProps interface for product table component
 */
export interface ProductTableProps<TData extends RowData> {
  /** Column definitions */
  columns?: ColumnDef<TData, unknown>[];
  /** Function to render variants */
  renderVariants: (props: { row: Row<TData> }) => React.ReactElement;
  /** Function to determine if row can expand */
  getRowCanExpand: (row: Row<TData>) => boolean;
  /** Column filter state and setter */
  columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>];
}

/**
 * ProductTableHeader interface for table header component
 */
export interface ProductTableHeader<TData extends RowData> {
  /** Column identifier */
  id: string;
  /** Column span */
  colSpan: number;
  /** Whether column is placeholder */
  isPlaceholder: boolean;
  /** Column definition */
  column: ColumnDef<TData, unknown>;
  /** Whether column can be filtered */
  getCanFilter: () => boolean;
  /** Whether column can be sorted */
  getCanSort: () => boolean;
  /** Function to handle sort toggle */
  getToggleSortingHandler: () => void;
  /** Get current sort direction */
  getIsSorted: () => string;
  /** Get column context */
  getContext: () => Record<string, unknown>;
  /** Get column size */
  getSize: () => number;
  /** Column definition */
  columnDef: Partial<ColumnDef<TData>>;
}

/**
 * FilterVariantComponentProps interface for filter variant component
 */
export interface FilterVariantComponentProps {
  /** Column to filter */
  column: CustomColumn<Product, unknown>;
}

/**
 * TableOptionsProps interface for table options component
 */
export interface TableOptionsProps {
  /** Table instance */
  table: Table<Product>;
  /** Search input value */
  searchInput: string;
  /** Function to update search input */
  setSearchInput: Dispatch<SetStateAction<string>>;
}

/**
 * ProductRow interface representing a row in the product table
 */
export interface ProductRow {
  /** Table row data */
  row: Row<Product>;
}

/**
 * TextOptionFacet interface for text option facets
 */
export interface TextOptionFacet {
  /** Facet name */
  name: string;
  /** Facet value */
  value: string;
}

/**
 * WixProduct interface representing a Wix product
 */
export interface WixProduct {
  /** Discounted price */
  discountedPrice?: string;
  /** Regular price */
  price: string;
  /** Product title */
  title: string;
  /** Product URL */
  url: string;
  /** Text option facets */
  textOptionsFacets?: TextOptionFacet[];
}

/**
 * FilterInputProps interface for filter input component
 */
export interface FilterInputProps {
  /** Column to filter */
  column?: Column<Product, unknown>;
  /** Child elements */
  children?: ReactNode;
  /** Range values for filter */
  rangeValues?: string[] | number[];
  /** Input label */
  label?: string;
  /** Change event handler */
  onChange?: (
    event:
      | SelectChangeEvent<string>
      | ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>
      | undefined,
  ) => void;
  /** Input value */
  value?: string;
  /** Additional props */
  props?: Record<string, unknown>;
}

/**
 * ColumnMeta interface for column metadata
 */
export interface ColumnMeta {
  /** Filter variant type */
  filterVariant?: "range" | "select" | "text";
  /** Unique values for filter */
  uniqueValues?: string[];
  /** Range values for filter */
  rangeValues?: number[];
  /** Custom styles */
  style?: CSSProperties;
}

/**
 * CustomColumn interface for custom column definition
 */
export interface CustomColumn<TData extends RowData, TValue = unknown>
  extends Column<TData, TValue> {
  /** Column definition with metadata */
  columnDef: {
    /** Column metadata */
    meta?: ColumnMeta;
  };
}

/**
 * Props interface for generic component props
 */
export interface Props<T> {
  /** Data array */
  data: T[];
  /** Function to render item */
  renderItem: (item: T) => React.ReactNode;
}

/**
 * IconSpinnerProps interface for icon spinner component
 */
export interface IconSpinnerProps {
  /** Spinner size */
  size?: number;
  /** Additional props */
  [key: string]: unknown;
}

/**
 * FilterVariantInputProps interface for filter variant input component
 */
export interface FilterVariantInputProps {
  /** Column to filter */
  column: CustomColumn<Product, unknown>;
  /** Additional props */
  [key: string]: unknown;
}

/**
 * Props for the LoadingBackdrop component
 */
export interface LoadingBackdropProps {
  /** Whether backdrop is visible */
  open: boolean;
  /** Click handler */
  onClick: () => void;
}

/**
 * Props for the SpeedDialMenu component
 */
export interface SpeedDialMenuProps {
  /** Whether speed dial is visible */
  speedDialVisibility: boolean;
}

/**
 * Props for the TabHeader component
 */
export interface TabHeaderProps {
  /** Current page number */
  page: number;
  /** Function to update page */
  setPage: (page: number) => void;
}

/**
 * TabLink component that displays a link with a custom onClick handler
 */
export interface LinkProps {
  /** Link href */
  href: IntrinsicAttributes;
  /** Child elements */
  children: React.ReactNode;
}

/**
 * Props for the SearchInput component
 */
export interface SearchInputStates {
  /** Search input value */
  searchInput: string;
  /** Function to update search input */
  setSearchInput: (value: string) => void;
}
