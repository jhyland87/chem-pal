import { FormControl, TextField } from "@mui/material";
import { ChangeEvent, useState } from "react";
import { FilterVariantInputProps } from "../../types";

export function TextColumnFilter({ columnConfig }: FilterVariantInputProps) {
  const [columnFilterValue, setColumnFilterValue] = useState<string>("");

  const handleColumnTextFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {
      target: { value },
    } = event;
    setColumnFilterValue(value);
    //settingsContext.setSetting(columnConfig.id, value);
  };

  const columnHeader = columnConfig.getHeaderText();
  console.log("TextColumnFilter | columnHeader:", columnHeader);
  return (
    <FormControl sx={{ m: 0, width: "100%", lineHeight: "1em", fontSize: "1em" }}>
      <TextField
        label={columnHeader}
        style={{ lineHeight: "1em" }}
        id={columnConfig.id}
        size="small"
        value={columnFilterValue}
        onChange={handleColumnTextFilterChange}
      />
    </FormControl>
  );
}
