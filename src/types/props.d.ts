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
import { CustomColumn, Product } from "./types";

declare global {
  /**
   * HelpTooltipProps interface for help tooltip component
   */
  interface HelpTooltipProps {
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
  interface TabPanelProps {
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
  interface AppContextProps {
    /** Application settings */
    userSettings: UserSettings;
    /** Function to update settings */
    setUserSettings: (settings: UserSettings) => void;
    /** Search results */
    searchResults: Product[];
    /** Function to update search results */
    setSearchResults: (results: Product[]) => void;
    /** Function to update panel */
    setPanel?: (panel: number) => void;
    /** Function to update drawer tab */
    setDrawerTab: (tab: number) => void;
    /** Function to toggle drawer */
    toggleDrawer: () => void;
    /** Drawer state management - -1 = closed, 0 = search tab, 1 = settings tab */
    drawerTab: number;
  }

  /**
   * TableProps interface for table component
   */
  interface TableProps<TData extends RowData> {
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
  interface ProductTableProps<TData extends RowData> {
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
  interface ProductTableHeader<TData extends RowData> {
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
  interface FilterVariantComponentProps {
    /** Column to filter */
    column: CustomColumn<Product, unknown>;
  }

  /**
   * TableOptionsProps interface for table options component
   */
  interface TableOptionsProps {
    /** Table instance */
    table: Table<Product>;
    /** Search input value */
    //searchInput: string;
    /** Function to update search input */
    //setSearchInput: Dispatch<SetStateAction<string>>;
    onSearch?: (query: string) => void;
  }

  /**
   * FilterInputProps interface for filter input component
   */
  interface FilterInputProps {
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
  interface Props<T> {
    /** Data array */
    data: T[];
    /** Function to render item */
    renderItem: (item: T) => React.ReactNode;
  }

  /**
   * IconSpinnerProps interface for icon spinner component
   */
  interface IconSpinnerProps extends SvgIconProps {
    /** Speed of the spinner */
    speed?: string | number;
    /** Size of the spinner */
    size?: number;
  }

  /**
   * FilterVariantInputProps interface for filter variant input component
   */
  interface FilterVariantInputProps {
    /** Column to filter */
    column: CustomColumn<Product, unknown>;
    /** Additional props */
    [key: string]: unknown;
  }

  /**
   * Props for the LoadingBackdrop component
   */
  interface LoadingBackdropProps {
    /** Whether backdrop is visible */
    open: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Number of results */
    resultCount: number;
  }

  /**
   * Props for the SpeedDialMenu component
   */
  interface SpeedDialMenuProps {
    /** Whether speed dial is visible */
    speedDialVisibility: boolean;
  }

  /**
   * Props for the TabHeader component
   */
  interface TabHeaderProps {
    /** Current page number */
    page: number;
    /** Function to update page */
    setPage: (page: number) => void;
  }

  /**
   * Props for the Link component
   */
  interface LinkProps {
    /** Link href */
    href: IntrinsicAttributes;

    /** History object */
    history?: HistoryEntry;

    /** Child elements */
    children: React.ReactNode;
  }

  /**
   * Props for the SearchInput component
   */
  interface SearchInputStates {
    /** Function to update search input */
    onSearch?: (query: string) => void;
  }

  /**
   * Props for the UseResultsTable hook
   */
  interface UseResultsTableProps {
    /** Array of products to display in search results */
    showSearchResults: Product[];
    /** Column filter state and setter function tuple */
    columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>];
    /** Function to determine if a row can be expanded */
    getRowCanExpand: (row: Row<Product>) => boolean;
    /** Currency rate */
    userSettings?: UserSettings;
  }

  /**
   * Props for the UseSearch hook
   */
  interface UseSearchProps {
    /** Function to update the search results array */
    setSearchResults: React.Dispatch<React.SetStateAction<Product[]>>;
    /** Function to update the status label text/visibility */
    setStatusLabel: React.Dispatch<React.SetStateAction<string | boolean>>;
    /** Function to update the loading state */
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  }

  /**
   * Props for the IconTextFader component
   */
  interface IconTextFaderProps {
    /** Icon element to display */
    children: ReactNode;
    /** Text to display when fading from icon */
    text: string;
    /** Whether the component is in active state */
    active: boolean;
  }
}

// This export is needed to make the file a module
export {};
