import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
} from "@mui/material";
import { useState } from "react";
import { FilterVariantInputProps } from "../../types";

export function SelectColumnFilter({ columnConfig }: FilterVariantInputProps) {
  const [columnFilterValue, setColumnFilterValue] = useState<string[]>([]);

  const handleColumnFilterValueChange = (
    //event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string[]>,
    event: any,
  ) => {
    const {
      target: { value },
    } = event;
    setColumnFilterValue(value);
    //settingsContext.setSetting(columnConfig.id, value);
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

  const columnFilterOptions = columnConfig.getUniqueValues();
  const columnHeader = columnConfig.getHeaderText();

  return (
    <FormControl sx={{ m: 0, width: "100%", lineHeight: "1em", fontSize: "1em" }}>
      <InputLabel
        id={`search-result-${columnConfig.id}-filter-label`}
        sx={{ lineHeight: "1em", fontSize: "1em" }}
      >
        {columnHeader}
      </InputLabel>
      <Select
        style={{ lineHeight: "1em" }}
        labelId={`search-result-${columnConfig.id}-filter-label`}
        id={`search-result-${columnConfig.id}-filter`}
        size="small"
        multiple
        value={columnFilterValue}
        onChange={handleColumnFilterValueChange}
        input={<OutlinedInput label={columnHeader} />}
        renderValue={(selected) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {selected.map((value) => (
              <Chip key={value} label={value} />
            ))}
          </Box>
        )}
        MenuProps={MenuProps}
      >
        {columnFilterOptions.map((option) => (
          <MenuItem key={option} value={option}>
            <Checkbox checked={columnFilterValue.includes(option as string)} />
            <ListItemText primary={option} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
