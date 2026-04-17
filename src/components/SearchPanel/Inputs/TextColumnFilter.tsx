import TextField from "@mui/material/TextField";
import { ChangeEvent, useState } from "react";

/**
 * Compact text filter input for the results-table header row. The column
 * header is shown in the row above, so we drop the redundant input label and
 * lean on `meta.filterPlaceholder` for hinting.
 *
 * @component
 * @param props - Component props
 * @example
 * ```tsx
 * <TextColumnFilter column={column} />
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
        // Match the Autocomplete `size="small"` height so text/select filters
        // line up visually across the filter row.
        "& .MuiInputBase-root": { height: 32 },
        "& .MuiInputBase-input": { padding: "4px 8px", fontSize: 13 },
      }}
      slotProps={{ htmlInput: { "aria-label": column.getHeaderText() } }}
    />
  );
}
