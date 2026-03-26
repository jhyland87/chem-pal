import { Checkbox, FormControl, List, ListItem, ListItemButton, ListItemText } from "@mui/material";
import { useState } from "react";
import { FilterListItemIcon } from "../../Styles";
import "./SelectColumnFilter.scss";

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
 * @source
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

    console.debug("handleOptionSelect", { optionValue, newChecked });
    setColumnFilterValue(newChecked);
    column.setFilterValueDebounced(newChecked);
  };

  const columnFilterOptions = column.getAllUniqueValues();
  const columnHeader = column.getHeaderText();

  return (
    <FormControl component="fieldset" variant="standard" className="select-column-filter">
      {/*<ListSubheader component="legend" sx={{ padding: 0 }}>
        {columnHeader}
      </ListSubheader>
      <FormLabel component="legend">{columnHeader}</FormLabel>*/}
      <List className="select-column-filter__list">
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
                  className="select-column-filter__list-item-btn"
                  role={undefined}
                  onClick={() => handleOptionSelect(option)}
                  dense
                >
                  <FilterListItemIcon>
                    <Checkbox
                      size="small"
                      edge="start"
                      className="select-column-filter__checkbox"
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
