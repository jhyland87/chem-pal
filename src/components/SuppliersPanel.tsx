import { useAppContext } from "@/context";
import SupplierFactory from "@/suppliers/supplierFactory";
import Avatar from "@mui/material/Avatar";
import Checkbox from "@mui/material/Checkbox";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";

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
    const selectedSuppliers = appContext.settings.suppliers;
    const currentIndex = selectedSuppliers.indexOf(supplierName);
    const newChecked = [...selectedSuppliers];

    if (currentIndex === -1) {
      newChecked.push(supplierName);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    appContext.setSettings({
      ...appContext.settings,
      suppliers: newChecked,
    });
  };

  return (
    <List dense sx={{ width: "100%", bgcolor: "background.paper", color: "text.primary" }}>
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
                checked={appContext.settings.suppliers.includes(supplierName)}
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
