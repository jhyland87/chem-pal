import { useAppContext } from "@/context";
import SupplierFactory from "@/suppliers/SupplierFactory";
import Avatar from "@mui/material/Avatar";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { ChangeEvent } from "react";

/**
 * SuppliersPanel component that displays a list of available suppliers with toggle functionality.
 * Each supplier is represented by an avatar and name, with a checkbox to enable/disable them.
 * The component manages the state of selected suppliers through the application context.

 * @component
 * @category Components
 *
 * @example
 * ```tsx
 * <SuppliersPanel />
 * ```
 */
export default function SuppliersPanel() {
  const appContext = useAppContext();

  /**
   * Handles toggling a supplier's selection state.
   * Updates the application settings with the new list of selected suppliers.
   *
   * @param supplierName - The name of the supplier to toggle
   * @returns A callback function that handles the toggle action
   */
  const handleToggle = (supplierName: string) => () => {
    const selectedSuppliers = appContext.userSettings.suppliers;
    const currentIndex = selectedSuppliers.indexOf(supplierName);
    const newChecked = [...selectedSuppliers];

    if (currentIndex === -1) {
      newChecked.push(supplierName);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    appContext.setUserSettings({
      ...appContext.userSettings,
      suppliers: newChecked,
    });
  };

  const handleToggleAll = (e: ChangeEvent<HTMLInputElement>) => {
    console.log("handleToggleAll", e.target.checked);
    let newChecked: string[] = [];
    if (e.target.checked === true) {
      newChecked = [...SupplierFactory.supplierList()];
    }

    appContext.setUserSettings({
      ...appContext.userSettings,
      suppliers: newChecked,
    });
  };

  return (
    <List dense sx={{ width: "100%", bgcolor: "background.paper", color: "text.primary" }}>
      <ListItem>
        <ListItemText primary="Suppliers" />
        <Checkbox
          value="all"
          edge="end"
          onChange={handleToggleAll}
          checked={
            appContext.userSettings.suppliers.length === SupplierFactory.supplierList().length
          }
          aria-labelledby="checkbox-list-secondary-label-all"
          size="small"
        />
      </ListItem>
      <Divider />
      {SupplierFactory.supplierList().map((supplierName) => {
        const labelId = `checkbox-list-secondary-label-${supplierName}`;
        return (
          <ListItem
            key={supplierName}
            secondaryAction={
              <Checkbox
                value={supplierName}
                edge="end"
                onChange={handleToggle(supplierName)}
                checked={appContext.userSettings.suppliers.includes(supplierName)}
                aria-labelledby={labelId}
                size="small"
              />
            }
            disablePadding
          >
            <ListItemButton>
              <ListItemAvatar>
                <Avatar
                  alt={`Avatar n°${supplierName}`}
                  src={`/static/images/avatar/${supplierName}.png`}
                />
              </ListItemAvatar>
              <ListItemText id={labelId} primary={supplierName.replace(/^Supplier/, "")} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
