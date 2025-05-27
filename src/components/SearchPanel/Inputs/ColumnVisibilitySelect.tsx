import { MenuItem, OutlinedInput, Select, SelectChangeEvent, Theme, useTheme } from "@mui/material";
import InputLabel from "@mui/material/InputLabel";
import { StyledFormControlSelector } from "../../Styles";

/**
 * Returns the appropriate styles for a menu item based on whether it's selected.
 *
 * @param name - The option value
 * @param personName - Array of selected values
 * @param theme - The Material-UI theme
 * @returns  Style object with appropriate font weight
 */
function getStyles(name: string, personName: string[], theme: Theme) {
  return {
    fontWeight: personName.includes(name)
      ? theme.typography.fontWeightMedium
      : theme.typography.fontWeightRegular,
  };
}

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
 * ColumnVisibilitySelect component that provides a multi-select dropdown for controlling
 * which columns are visible in the table. It allows users to show/hide columns by
 * selecting them from a list.
 *
 * @component
 *
 * @param props - Component props
 *
 * @example
 * ```tsx
 * <ColumnVisibilitySelect
 *   columnNames={{ id: "ID", name: "Name" }}
 *   columnVisibility={["id", "name"]}
 *   handleColumnVisibilityChange={handleChange}
 * />
 * ```
 */
export default function ColumnVisibilitySelect({
  columnNames,
  columnVisibility,
  handleColumnVisibilityChange,
}: {
  columnNames: Record<string, string>;
  columnVisibility: string[];
  handleColumnVisibilityChange: (event: SelectChangeEvent<string[]>) => void;
}) {
  const theme = useTheme();
  return (
    <StyledFormControlSelector>
      <InputLabel id="search-result-column-visibility-label">Column Visibility</InputLabel>
      <Select
        //style={{ lineHeight: "1em" }}
        labelId="search-result-column-visibility-label"
        id="search-result-column-visibility"
        size="small"
        multiple
        value={columnVisibility}
        onChange={handleColumnVisibilityChange}
        input={<OutlinedInput label="Column Visibility" />}
        MenuProps={MenuProps}
      >
        {Object.entries(columnNames).map(([key, name]) => (
          <MenuItem key={key} value={name} style={getStyles(name, columnVisibility, theme)}>
            {name}
          </MenuItem>
        ))}
      </Select>
    </StyledFormControlSelector>
  );
}
