import { type FilterVariantInputProps } from "@/types/props";
import { useTheme, type SelectChangeEvent, type Theme } from "@mui/material";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import { ChangeEvent, useState } from "react";
import { StyledFormControlSelector } from "../../Styles";

/**
 * SelectColumnFilter component that provides a multi-select filter for columns with discrete values.
 * It allows users to filter data by selecting multiple values from a dropdown menu.
 *
 * @component
 * @param props - Component props
 * @example
 * ```tsx
 * <SelectColumnFilter column={column} />
 * ```
 */
export default function SelectColumnFilter({ column }: FilterVariantInputProps) {
  const theme = useTheme();
  const [columnFilterValue, setColumnFilterValue] = useState<string[]>(
    (column.getFilterValue() as string[]) || [],
  );

  /**
   * Handles changes to the select filter value.
   * Updates the local state and triggers the column filter update with debouncing.
   *
   * @param event - The change event
   */
  const handleColumnFilterValueChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string[]>,
  ) => {
    const {
      target: { value },
    } = event;
    setColumnFilterValue(value as string[]);
    column.setFilterValueDebounced(value as string[]);
  };

  /**
   * Configuration for the select menu's dimensions and behavior.
   */
  const ITEM_HEIGHT = 48;
  const ITEM_PADDING_TOP = 8;
  const MenuProps = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    PaperProps: {
      style: {
        maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
        width: 250,
      },
    },
  };

  /**
   * Returns the appropriate styles for a menu item based on whether it's selected.
   *
   * @param name - The option value
   * @param personName - Array of selected values
   * @param theme - The Material-UI theme
   * @returns Style object with appropriate font weight
   */
  function getStyles(name: string, personName: string[], theme: Theme) {
    return {
      fontWeight: personName.includes(name)
        ? theme.typography.fontWeightMedium
        : theme.typography.fontWeightRegular,
    };
  }

  const columnFilterOptions = column.getAllUniqueValues();
  const columnHeader = column.getHeaderText();

  return (
    <StyledFormControlSelector>
      <InputLabel id={`search-result-${column.id}-filter-label`}>{columnHeader}</InputLabel>
      <Select
        labelId={`search-result-${column.id}-filter-label`}
        id={`search-result-${column.id}-filter`}
        size="small"
        multiple
        value={columnFilterValue}
        onChange={handleColumnFilterValueChange}
        input={<OutlinedInput label={columnHeader} />}
        MenuProps={MenuProps}
      >
        {columnFilterOptions.length === 0 ? (
          <MenuItem>No Options Available</MenuItem>
        ) : (
          columnFilterOptions.map((option: string) => (
            <MenuItem
              key={option}
              value={option}
              style={getStyles(option as string, columnFilterOptions as string[], theme)}
            >
              {option}
            </MenuItem>
          ))
        )}
      </Select>
    </StyledFormControlSelector>
  );
}
