import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import { HTMLAttributes, SyntheticEvent, useState } from "react";

/**
 * Compact autocomplete-based filter for header columns with discrete values.
 * Options come from the values actually present in the data
 * (`column.getAllUniqueValues()`). The column header sits directly above, so
 * we skip the floating label and lean on `meta.filterPlaceholder` for
 * hinting.
 *
 * Default rendering: selected values collapse into a single count chip
 * (e.g. "3") so the narrow header cell doesn't grow.
 *
 * When the column supplies `meta.renderSelectOption`, that renderer is used
 * for both the dropdown option list AND each selected chip (e.g. flag icons
 * for the country column). In that mode individual chips are rendered and
 * the input area scrolls horizontally so multiple selections stay visible.
 *
 * @component
 * @param props - Component props
 * @example
 * ```tsx
 * <SelectColumnFilter column={column} />
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

  const handleChange = (_event: SyntheticEvent, newValue: string[]) => {
    setColumnFilterValue(newValue);
    column.setFilterValueDebounced(newValue);
  };

  return (
    <Autocomplete
      multiple
      size="small"
      fullWidth
      // Remove both the popup chevron and the clear-all "×". The input opens
      // on focus/click, and users remove individual selections via each chip's
      // own delete "×" — so those extra end-adornments were just crowding the
      // narrow header cell.
      forcePopupIcon={false}
      disableClearable
      options={columnFilterOptions}
      value={columnFilterValue}
      onChange={handleChange}
      disabled={!hasOptions}
      noOptionsText="No Options Available"
      renderOption={
        renderSelectOption
          ? (props, option) => {
              // MUI v5+ forwards `key` via spread, but React 18+ warns about
              // key-in-spread — destructure it out and pass explicitly.
              const { key, ...rest } = props as HTMLAttributes<HTMLLIElement> & {
                key: string;
              };
              return (
                <li key={key} {...rest}>
                  {renderSelectOption(option)}
                </li>
              );
            }
          : undefined
      }
      renderTags={(value, getTagProps) => {
        if (value.length === 0) return null;
        // With a custom renderer, show one small chip per value (icon-only)
        // so the user can see exactly which values are picked; the input
        // area scrolls horizontally via the sx below.
        if (renderSelectOption) {
          return value.map((val, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return (
              <Chip
                key={key}
                size="small"
                label={renderSelectOption(val)}
                {...tagProps}
                sx={{
                  height: 20,
                  fontSize: 13,
                  mr: 0.25,
                  flex: "0 0 auto",
                  "& .MuiChip-label": { px: 0.5 },
                  "& .MuiChip-deleteIcon": { fontSize: 14, mr: 0.25 },
                }}
              />
            );
          });
        }
        // No custom renderer — collapse to a single count pill.
        return (
          <Chip
            size="small"
            label={value.length}
            sx={{ height: 18, fontSize: 11, ml: 0.5, "& .MuiChip-label": { px: 0.75 } }}
          />
        );
      }}
      sx={{
        m: 0,
        mr: 0.5,
        "& .MuiInputBase-root": {
          minHeight: 32,
          maxHeight: 32,
          flexWrap: "nowrap",
          // When a custom renderer is used we scroll horizontally so all
          // selected chips remain visible; otherwise the single count chip
          // never overflows, so hidden is fine.
          overflowX: renderSelectOption ? "auto" : "hidden",
          overflowY: "hidden",
          padding: "0 8px",
        },
        "& .MuiAutocomplete-input": { padding: "4px 0 !important", fontSize: 13 },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={
            columnFilterValue.length === 0
              ? (column.columnDef.meta?.filterPlaceholder ?? `Filter ${columnHeader?.toLowerCase()}`)
              : undefined
          }
          slotProps={{ htmlInput: { ...params.inputProps, "aria-label": columnHeader } }}
        />
      )}
    />
  );
}
