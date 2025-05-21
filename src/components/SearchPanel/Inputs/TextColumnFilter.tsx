import TextField from "@mui/material/TextField";
import { ChangeEvent, useState } from "react";
import { FilterVariantInputProps } from "types/props";
import { StyledFormControlSelector } from "../../Styles";

/**
 * TextColumnFilter component that provides a text input filter for columns.
 * It allows users to filter data by entering text that matches column values.
 *
 * @component
 *
 * @param {FilterVariantInputProps} props - Component props
 * @param {CustomColumn<Product, unknown>} props.column - The column configuration
 *
 * @example
 * ```tsx
 * <TextColumnFilter column={column} />
 * ```
 */
export default function TextColumnFilter({ column }: FilterVariantInputProps) {
  const [columnFilterValue, setColumnFilterValue] = useState<string>(
    column.getFilterValue() as string,
  );

  /**
   * Handles changes to the text filter input.
   * Updates the local state and triggers the column filter update with debouncing.
   *
   * @param {ChangeEvent<HTMLInputElement>} event - The change event
   */
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
