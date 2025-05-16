import {
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Theme,
  useTheme,
} from "@mui/material";
import { ChangeEvent, useState } from "react";
import { FilterVariantInputProps } from "../../../types";
import { StyledFormControlSelector } from "../../Styles";

export default function SelectColumnFilter({ column }: FilterVariantInputProps) {
  const theme = useTheme();
  const [columnFilterValue, setColumnFilterValue] = useState<string[]>(
    (column.getFilterValue() as string[]) || [],
  );

  const handleColumnFilterValueChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string[]>,
  ) => {
    const {
      target: { value },
    } = event;
    setColumnFilterValue(value as string[]);
    column.setFilterValueDebounced(value as string[]);
  };

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
          columnFilterOptions.map((option) => (
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
