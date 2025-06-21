import {
  Checkbox,
  FormControl,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  SelectChangeEvent,
} from "@mui/material";
import { FilterListItemIcon } from "../../Styles";

/**
 * ColumnVisibilitySelect component that provides a scrollable list of checkboxes for controlling
 * which columns are visible in the table. It allows users to show/hide columns by
 * checking/unchecking them from a list.
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
  // Default columns to show when "defaults" is checked - these should match the actual column keys
  const defaultColumns = ["supplier", "country", "shipping", "quantity", "price"];

  // Get the actual column keys that exist and match our default column names
  const availableDefaultKeys = defaultColumns.filter((defaultCol) =>
    Object.keys(columnNames).includes(defaultCol),
  );

  // Check if current selection matches default columns (all available defaults are selected)
  const isDefaultsChecked =
    availableDefaultKeys.length > 0 &&
    availableDefaultKeys.every((col) => columnVisibility.includes(col));

  const handleColumnSelect = (columnName: string) => {
    const newChecked = [...columnVisibility];
    const currentIndex = newChecked.indexOf(columnName);

    if (currentIndex === -1) {
      newChecked.push(columnName);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    // Create a synthetic event to maintain compatibility with existing handler
    const syntheticEvent = {
      target: { value: newChecked },
    } as SelectChangeEvent<string[]>;

    handleColumnVisibilityChange(syntheticEvent);
  };

  const handleDefaultsSelect = () => {
    let newChecked: string[];

    if (isDefaultsChecked) {
      // If defaults are currently checked, unchecking should hide all (except title which is always visible)
      newChecked = [];
    } else {
      // If defaults are not checked, checking should show default columns
      newChecked = availableDefaultKeys;
    }

    // Create a synthetic event to maintain compatibility with existing handler
    const syntheticEvent = {
      target: { value: newChecked },
    } as SelectChangeEvent<string[]>;

    handleColumnVisibilityChange(syntheticEvent);
  };

  return (
    <FormControl component="fieldset" variant="standard" sx={{ width: "100%" }}>
      {/*<FormLabel component="legend">Column Visibility</FormLabel>*/}
      <List
        sx={{
          width: "100%",
          maxWidth: 360,
          //bgcolor: "background.paper",
          paddingLeft: "20px",
          maxHeight: 200, // Limit height to make it scrollable
          overflow: "auto", // Enable scrolling
        }}
      >
        {/* Defaults checkbox */}
        <ListItem key="defaults" disablePadding>
          <ListItemButton sx={{ padding: 0 }} role={undefined} onClick={handleDefaultsSelect} dense>
            <FilterListItemIcon>
              <Checkbox
                size="small"
                edge="start"
                sx={{ padding: 0, minWidth: 10 }}
                checked={isDefaultsChecked}
                tabIndex={-1}
                disableRipple
                // eslint-disable-next-line @typescript-eslint/naming-convention
                inputProps={{ "aria-labelledby": "checkbox-list-label-defaults" }}
              />
            </FilterListItemIcon>
            <ListItemText
              id="checkbox-list-label-defaults"
              primary="Defaults"
              primaryTypographyProps={{ variant: "body2", fontWeight: "medium" }}
            />
          </ListItemButton>
        </ListItem>

        {/* Regular column checkboxes */}
        {Object.entries(columnNames)
          .filter(([key]) => key !== "title") // Filter out title column
          .map(([key, name]) => {
            const labelId = `checkbox-list-label-${key}`;

            return (
              <ListItem key={key} disablePadding>
                <ListItemButton
                  sx={{ padding: 0 }}
                  role={undefined}
                  onClick={() => handleColumnSelect(key)}
                  dense
                >
                  <FilterListItemIcon>
                    <Checkbox
                      size="small"
                      edge="start"
                      sx={{ padding: 0, minWidth: 10 }}
                      checked={columnVisibility.includes(key)}
                      tabIndex={-1}
                      disableRipple
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      inputProps={{ "aria-labelledby": labelId }}
                    />
                  </FilterListItemIcon>
                  <ListItemText id={labelId} primary={name} />
                </ListItemButton>
              </ListItem>
            );
          })}
      </List>
    </FormControl>
  );
}
