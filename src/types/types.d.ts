import { Column, RowData } from "@tanstack/react-table";
import { UOM } from "constants/app";
import { CSSProperties } from "react";
import { CAS } from "types/cas";
import { CurrencyCode, CurrencySymbol } from "types/currency";
/**
 * Unit of measurement type
 */
//export type UOM = string;

/**
 * Quantity object type
 */
export interface QuantityObject {
  /** Quantity */
  quantity: number;
  /** Unit of measurement */
  uom: string;
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
 * ProductRow interface representing a row in the product table
 */
export interface ProductRow {
  /** Table row data */
  row: Row<Product>;
}

/**
 * Interface defining mappings between units of measurement and their string aliases.
 * Each property represents a unit of measurement from the UOM enum and maps to an array
 * of possible string representations for that unit.
 *
 * @interface
 * @example
 * ```typescript
 * const aliases: UOMAliases = {
 *   [UOM.KG]: ["kilogram", "kilograms", "kg", "kgs"]
 * };
 * ```
 */
export interface UOMAliases {
  /** Array of string aliases for pieces/units */
  [UOM.PCS]: string[];
  /** Array of string aliases for kilograms */
  [UOM.KG]: string[];
  /** Array of string aliases for pounds */
  [UOM.LB]: string[];
  /** Array of string aliases for milliliters */
  [UOM.ML]: string[];
  /** Array of string aliases for grams */
  [UOM.G]: string[];
  /** Array of string aliases for liters */
  [UOM.L]: string[];
  /** Array of string aliases for quarts */
  [UOM.QT]: string[];
  /** Array of string aliases for gallons */
  [UOM.GAL]: string[];
  /** Array of string aliases for millimeters */
  [UOM.MM]: string[];
  /** Array of string aliases for centimeters */
  [UOM.CM]: string[];
  /** Array of string aliases for meters */
  [UOM.M]: string[];
  /** Array of string aliases for ounces */
  [UOM.OZ]: string[];
  /** Array of string aliases for milligrams */
  [UOM.MG]: string[];
  /** Array of string aliases for kilometers */
  [UOM.KM]: string[];
}

/**
 * Awaitable type
 */
export type Awaitable<T> = T | Promise<T>;
