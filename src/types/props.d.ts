import { SvgIconProps } from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";
import { Column, ColumnDef, ColumnFiltersState, Row, RowData, Table } from "@tanstack/react-table";
import {
  ChangeEvent,
  ChangeEventHandler,
  Dispatch,
  IntrinsicAttributes,
  ReactElement,
  ReactNode,
  SetStateAction,
} from "react";
import { CustomColumn, Product, Settings } from "./types";

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
export interface IconSpinnerProps extends SvgIconProps {
  /** Speed of the spinner */
  speed?: string | number;
  /** Size of the spinner */
  size?: number;
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

/**
 * Props interface for the results table hook
 */
export interface UseResultsTableProps {
  /** Array of products to display in search results */
  showSearchResults: Product[];
  /** Column filter state and setter function tuple */
  columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>];
  /** Function to determine if a row can be expanded */
  getRowCanExpand: (row: Row<Product>) => boolean;
}

/**
 * Props interface for the search hook
 */
export interface UseSearchProps {
  /** Function to update the search results array */
  setSearchResults: React.Dispatch<React.SetStateAction<Product[]>>;
  /** Function to update the status label text/visibility */
  setStatusLabel: React.Dispatch<React.SetStateAction<string | boolean>>;
  /** Function to update the loading state */
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Props interface for the IconTextFader component that fades between an icon and text
 */
export interface IconTextFaderProps {
  /** Icon element to display */
  children: ReactNode;
  /** Text to display when fading from icon */
  text: string;
  /** Whether the component is in active state */
  active: boolean;
}
