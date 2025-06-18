import { SelectChangeEvent } from "@mui/material/Select";
import { useCallback, useState } from "react";
import { useAppContext } from "./hooks/useContext";

/**
 * Hook to manage filter menu state including drawer, tabs, suppliers, and column visibility.
 * Consolidates all the filter-related state management from FilterMenu component.
 *
 * @returns Filter menu state and handlers
 *
 * @example
 * ```tsx
 * const {
 *   // Drawer state
 *   drawerState,
 *   toggleDrawer,
 *   // Tab state
 *   activeTab,
 *   setActiveTab,
 *   handleTabChange,
 *   handleTabClick,
 *   // Accordion state
 *   expanded,
 *   handleAccordionChange,
 *   // Supplier state
 *   selectedSuppliers,
 *   handleSupplierSelect,
 *   // Column visibility
 *   columnVisibility,
 *   setColumnVisibility,
 *   handleColumnVisibilityChange
 * } = useFilterMenu(table);
 * ```
 */
export function useFilterMenu(table?: any) {
  const appContext = useAppContext();

  // Drawer state
  const [drawerState, setDrawerState] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Accordion state for filters
  const [expanded, setExpanded] = useState<string | false>("");

  // Supplier selection state
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(
    appContext?.userSettings.suppliers ?? [],
  );

  // Column visibility state
  const columnStatus =
    table?.getAllColumns()?.reduce((accu: string[], column: any) => {
      if (column.getIsVisible() && column.getCanHide()) accu.push(column.id);
      return accu;
    }, []) ?? [];

  const [columnVisibility, setColumnVisibility] = useState<string[]>(columnStatus);

  // Drawer handlers
  const toggleDrawer = useCallback((newState: boolean) => {
    setDrawerState(newState);
  }, []);

  // Tab handlers
  const handleTabChange = useCallback(
    (event: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
      // Auto-open drawer when tab is clicked
      if (!drawerState) {
        toggleDrawer(true);
      }
    },
    [drawerState, toggleDrawer],
  );

  const handleTabClick = useCallback(() => {
    // Always open drawer when any tab is clicked
    if (!drawerState) {
      toggleDrawer(true);
    }
  }, [drawerState, toggleDrawer]);

  // Accordion handlers
  const handleAccordionChange = useCallback((panel: string) => {
    return (event: React.SyntheticEvent, newExpanded: boolean) => {
      setExpanded(newExpanded ? panel : false);
    };
  }, []);

  // Supplier selection handlers
  const handleSupplierSelect = useCallback(
    (supplierName: string) => {
      const newChecked = [...selectedSuppliers];
      const currentIndex = newChecked.indexOf(supplierName);
      if (currentIndex === -1) {
        newChecked.push(supplierName);
      } else {
        newChecked.splice(currentIndex, 1);
      }
      setSelectedSuppliers(newChecked);
      appContext?.setUserSettings({
        ...appContext.userSettings,
        suppliers: newChecked,
      });
    },
    [selectedSuppliers, appContext],
  );

  // Column visibility handlers
  const handleColumnVisibilityChange = useCallback(
    (event: SelectChangeEvent<string[]>) => {
      const {
        target: { value },
      } = event;
      const newColumnVisibility = typeof value === "string" ? value.split(",") : value;
      setColumnVisibility(newColumnVisibility);

      table?.getAllColumns().forEach((column: any) => {
        if (typeof column === "undefined") return;
        column.setColumnVisibility?.(
          !column.getCanHide() || newColumnVisibility.includes(column.id),
        );
      });
    },
    [table],
  );

  return {
    // Drawer state
    drawerState,
    toggleDrawer,
    getState: () => drawerState,

    // Tab state
    activeTab,
    setActiveTab,
    handleTabChange,
    handleTabClick,

    // Accordion state
    expanded,
    setExpanded,
    handleAccordionChange,

    // Supplier state
    selectedSuppliers,
    setSelectedSuppliers,
    handleSupplierSelect,

    // Column visibility
    columnVisibility,
    setColumnVisibility,
    handleColumnVisibilityChange,
  };
}
