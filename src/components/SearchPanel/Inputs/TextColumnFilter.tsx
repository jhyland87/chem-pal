import { TextField } from "@mui/material";
import { ChangeEvent, useState } from "react";
import { FilterVariantInputProps } from "../../../types";
import { StyledFormControlSelector } from "../../Styles";

export default function TextColumnFilter({ column }: FilterVariantInputProps) {
  const [columnFilterValue, setColumnFilterValue] = useState<string>(
    column.getFilterValue() as string,
  );

  const handleColumnTextFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {
      target: { value },
    } = event;
    setColumnFilterValue(value);
    column.setFilterValueDebounced(value);
  };

  return (
    <StyledFormControlSelector>
      <TextField
        label={column.getHeaderText()}
        style={{ lineHeight: "1em" }}
        id={column.id}
        size="small"
        value={columnFilterValue}
        onChange={handleColumnTextFilterChange}
      />
    </StyledFormControlSelector>
  );
}
