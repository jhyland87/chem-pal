import "@tanstack/react-table";
import { UserSettings } from "./common";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    userSettings: UserSettings;
  }
}

// Extend the Product type to include currency-related properties
declare global {
  interface Product {
    currency?: string;
    usdPrice?: number;
    localPrice?: number;
  }
}

// This export is needed to make the file a module
export {};
