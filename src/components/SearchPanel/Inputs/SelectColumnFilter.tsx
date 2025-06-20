import {
  Checkbox,
  FormControl,
  FormLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { useState } from "react";
import { FilterListItemIcon } from "../../Styles";

/**
 * SelectColumnFilter component that provides a scrollable list of checkboxes for columns with discrete values.
 * It allows users to filter data by selecting multiple values from a checkbox list.
 *
 * @component
 * @category Components
 * @subcategory SearchPanel
 * @param props - Component props
 * @example
 * ```tsx
 * <SelectColumnFilter column={column} />
 * ```
 */
export default function SelectColumnFilter({ column }: FilterVariantInputProps) {
  const [columnFilterValue, setColumnFilterValue] = useState<string[]>(
    (column.getFilterValue() as string[]) || [],
  );

  /**
   * Handles individual option selection/deselection.
   * Updates the local state and triggers the column filter update with debouncing.
   *
   * @param optionValue - The value to toggle
   */
  const handleOptionSelect = (optionValue: string) => {
    const newChecked = [...columnFilterValue];
    const currentIndex = newChecked.indexOf(optionValue);

    if (currentIndex === -1) {
      newChecked.push(optionValue);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setColumnFilterValue(newChecked);
    column.setFilterValueDebounced(newChecked);
  };

  const columnFilterOptions = column.getAllUniqueValues();
  const columnHeader = column.getHeaderText();

  return (
    <FormControl component="fieldset" variant="standard" sx={{ width: "100%" }}>
      <FormLabel component="legend">{columnHeader}</FormLabel>
      <List
        sx={{
          width: "100%",
          maxWidth: 360,
          bgcolor: "background.paper",
          paddingLeft: "20px",
          maxHeight: 200, // Limit height to make it scrollable
          overflow: "auto", // Enable scrolling
        }}
      >
        {columnFilterOptions.length === 0 ? (
          <ListItem>
            <ListItemText primary="No Options Available" />
          </ListItem>
        ) : (
          columnFilterOptions.map((option: string) => {
            const labelId = `checkbox-list-label-${column.id}-${option}`;

            return (
              <ListItem key={option} disablePadding>
                <ListItemButton
                  sx={{ padding: 0 }}
                  role={undefined}
                  onClick={() => handleOptionSelect(option)}
                  dense
                >
                  <FilterListItemIcon>
                    <Checkbox
                      size="small"
                      edge="start"
                      sx={{ padding: 0, minWidth: 10 }}
                      checked={columnFilterValue.includes(option)}
                      tabIndex={-1}
                      disableRipple
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      inputProps={{ "aria-labelledby": labelId }}
                    />
                  </FilterListItemIcon>
                  <ListItemText id={labelId} primary={option} />
                </ListItemButton>
              </ListItem>
            );
          })
        )}
      </List>
    </FormControl>
  );
}
