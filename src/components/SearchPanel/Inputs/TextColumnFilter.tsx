import TextField from "@mui/material/TextField";
import { ChangeEvent, useState } from "react";

/**
 * Compact text filter input for the results-table header row. The column
 * header is shown in the row above, so we drop the redundant input label and
 * lean on `meta.filterPlaceholder` for hinting. Keystrokes update local
 * state immediately; the table's filter is updated via the column's
 * debounced setter so typing doesn't thrash.
 * @component
 * @param props - Component props.
 * @param props.column - A TanStack column with `meta.filterVariant === "text"`.
 * @returns A 32px-tall `TextField` bound to the column's debounced filter.
 * @example
 * ```tsx
 * // TableColumns.tsx declared meta.filterPlaceholder = "Description..."
 * <TextColumnFilter column={descriptionColumn} />
 * // Renders: <input placeholder="Description..." aria-label="Description" />
 * // User types "acid" → column.setFilterValueDebounced("acid") after 250ms,
 * // which filters the table via TanStack's string-includes filter.
 * ```
 * @source
 */
export default function TextColumnFilter({ column }: FilterVariantInputProps) {
  const [columnFilterValue, setColumnFilterValue] = useState<string>(
    String(column.getFilterValue() ?? ""),
  );

  const handleColumnTextFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {
      target: { value },
    } = event;
    setColumnFilterValue(value);
    column.setFilterValueDebounced(value);
  };

  return (
    <TextField
      id={column.id}
      size="small"
      fullWidth
      placeholder={column.columnDef.meta?.filterPlaceholder}
      value={columnFilterValue}
      onChange={handleColumnTextFilterChange}
      sx={{
        m: 0,
        mr: 0.5,
        "& .MuiInputBase-root": { height: 32, fontSize: "inherit" },
        "& .MuiInputBase-input": { padding: "4px 8px", fontSize: "inherit" },
      }}
      slotProps={{ htmlInput: { "aria-label": column.getHeaderText() } }}
    />
  );
}
