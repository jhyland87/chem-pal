import { MenuItem, SelectChangeEvent, Theme, useTheme } from "@mui/material";
import InputLabel from "@mui/material/InputLabel";

import { OutlinedInput, Select } from "@mui/material";
import { StyledFormControlSelector } from "../../Styles";

function getStyles(name: string, personName: string[], theme: Theme) {
  return {
    fontWeight: personName.includes(name)
      ? theme.typography.fontWeightMedium
      : theme.typography.fontWeightRegular,
  };
}

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

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
