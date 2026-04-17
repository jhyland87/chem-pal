import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import { ReactNode, useState } from "react";

/**
 * Compact multi-select filter for header columns with discrete values.
 * Options come from the values actually present in the data
 * (`column.getAllUniqueValues()`). The column header sits directly above, so
 * we skip the floating label and use the placeholder (from
 * `meta.filterPlaceholder`) for hinting when nothing is selected.
 *
 * Display rule:
 *   - No selection → the placeholder text.
 *   - Selected, default → comma-separated values (truncated with `…` when
 *     they overflow the narrow header cell).
 *   - Selected + `meta.renderSelectOption` → the renderer's output for each
 *     value, space-separated (e.g. flag icons for the country column).
 * @component
 * @param props - Component props.
 * @param props.column - A TanStack column with `meta.filterVariant === "select"`.
 * @returns A 32px-tall MUI `Select` bound to the column's debounced filter.
 * @example
 * ```tsx
 * // Supplier column — plain text, no custom renderer.
 * <SelectColumnFilter column={supplierColumn} />
 * // No selection → shows "BVV, HiMedia, etc..." placeholder.
 * // Picking "BVV" + "HiMedia" → "BVV, HiMedia" in the field,
 * // column.setFilterValueDebounced(["BVV", "HiMedia"]).
 *
 * // Country column — declared meta.renderSelectOption: code => flag emoji.
 * <SelectColumnFilter column={countryColumn} />
 * // Picking "US" + "CN" → "🇺🇸 🇨🇳" rendered in the field;
 * // dropdown rows also show the flag next to each option.
 * ```
 * @source
 */
export default function SelectColumnFilter({ column }: FilterVariantInputProps) {
  const [columnFilterValue, setColumnFilterValue] = useState<string[]>(
    (column.getFilterValue() as string[]) ?? [],
  );

  const columnFilterOptions = (column.getAllUniqueValues() as (string | number)[]).map(String);
  const hasOptions = columnFilterOptions.length > 0;
  const columnHeader = column.getHeaderText();
  const renderSelectOption = column.columnDef.meta?.renderSelectOption;
  const placeholder =
    column.columnDef.meta?.filterPlaceholder ?? `Filter ${columnHeader?.toLowerCase() ?? ""}`;

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const { value } = event.target;
    const next = typeof value === "string" ? value.split(",") : value;
    setColumnFilterValue(next);
    column.setFilterValueDebounced(next);
  };

  const renderValue = (selected: string[]): ReactNode => {
    if (selected.length === 0) {
      return <span style={{ color: "rgba(0, 0, 0, 0.4)" }}>{placeholder}</span>;
    }
    if (renderSelectOption) {
      // Space-separated rendered nodes — e.g. "🇺🇸 🇨🇳 🇩🇪".
      return selected.map((value, idx) => (
        <span key={value} style={{ marginRight: idx < selected.length - 1 ? 4 : 0 }}>
          {renderSelectOption(value)}
        </span>
      ));
    }
    return selected.join(", ");
  };

  return (
    <FormControl size="small" fullWidth sx={{ m: 0, mr: 0.5 }}>
      <Select
        multiple
        displayEmpty
        value={columnFilterValue}
        onChange={handleChange}
        disabled={!hasOptions}
        renderValue={renderValue}
        inputProps={{ "aria-label": columnHeader }}
        sx={{
          height: 32,
          // `fontSize: inherit` bypasses the project-wide MuiSelect/Input
          // theme overrides and picks up the TableCell's default, so the
          // filter text matches the body rows.
          fontSize: "inherit",
          "& .MuiSelect-select": {
            py: 0,
            fontSize: "inherit",
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
          },
        }}
        MenuProps={{
          PaperProps: { sx: { maxHeight: 300 } },
        }}
      >
        {columnFilterOptions.map((option) => (
          <MenuItem key={option} value={option} dense>
            <Checkbox
              size="small"
              checked={columnFilterValue.includes(option)}
              sx={{ p: 0.5, mr: 0.5 }}
            />
            <ListItemText primary={renderSelectOption ? renderSelectOption(option) : option} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
