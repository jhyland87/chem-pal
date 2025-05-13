import MenuItem from "@mui/material/MenuItem";
import { Column } from "@tanstack/react-table";
import { ChangeEvent, CSSProperties } from "react";

import { Product } from "../types";
import SearchPanelRangeFilterInput from "./SearchPanelRangeFilterInput";
import SearchPanelSelectFilterInput from "./SearchPanelSelectFilterInput";
import SearchPanelTextFilterInput from "./SearchPanelTextFilterInput";
// Define the column meta type
type ColumnMeta = {
  filterVariant?: "range" | "select" | "text";
  uniqueValues?: string[];
  rangeValues?: number[];
};

export default function SearchTableHeaderFilter({ column }: { column: Column<Product, unknown> }) {
  const columnFilterValue = column.getFilterValue();
  const { filterVariant = "text" } = (column.columnDef.meta || {}) as ColumnMeta;
  const baseInputStyle: CSSProperties = {
    colorScheme: "light",
  };

  return filterVariant === "range" ? (
    <SearchPanelRangeFilterInput column={column} rangeValues={[]} />
  ) : filterVariant === "select" ? (
    <SearchPanelSelectFilterInput
      column={column}
      label={column.id}
      onChange={(event: ChangeEvent<HTMLSelectElement>) =>
        column.setFilterValue(event.target.value)
      }
      value={columnFilterValue?.toString()}
    >
      {(column.columnDef.meta as { uniqueValues?: string[] })?.uniqueValues?.map(
        (value: string) => (
          <MenuItem key={value} value={value}>
            {value}
          </MenuItem>
        ),
      )}
    </SearchPanelSelectFilterInput>
  ) : (
    <SearchPanelTextFilterInput
      column={column}
      onChange={(event: ChangeEvent<HTMLSelectElement>) =>
        column.setFilterValue(event.target.value)
      }
      value={(columnFilterValue ?? "") as string}
    />

    // See faceted column filters example for datalist search suggestions
  );
}
