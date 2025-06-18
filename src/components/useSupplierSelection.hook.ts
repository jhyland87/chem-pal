import { useAppContext } from "@/context";
import SupplierFactory from "@/suppliers/SupplierFactory";
import { ChangeEvent, useCallback } from "react";

/**
 * Hook to manage supplier selection state and handlers.
 * Extracted from SuppliersPanel.tsx for better code organization.
 *
 * @returns Supplier selection state and handlers
 *
 * @example
 * ```tsx
 * const { selectedSuppliers, handleToggle, handleToggleAll, isAllSelected } = useSupplierSelection();
 *
 * <Checkbox
 *   checked={isAllSelected}
 *   onChange={handleToggleAll}
 * />
 *
 * {suppliers.map(supplier => (
 *   <Checkbox
 *     key={supplier}
 *     checked={selectedSuppliers.includes(supplier)}
 *     onChange={handleToggle(supplier)}
 *   />
 * ))}
 * ```
 */
export function useSupplierSelection() {
  const appContext = useAppContext();

  if (!appContext) {
    throw new Error("useSupplierSelection must be used within AppContext");
  }

  const selectedSuppliers = appContext.userSettings.suppliers;
  const allSuppliers = SupplierFactory.supplierList();

  /**
   * Handles toggling a supplier's selection state.
   * Updates the application settings with the new list of selected suppliers.
   */
  const handleToggle = useCallback(
    (supplierName: string) => {
      return () => {
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
    },
    [selectedSuppliers, appContext],
  );

  /**
   * Handles toggling all suppliers at once.
   */
  const handleToggleAll = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newChecked: string[] = e.target.checked ? [...allSuppliers] : [];

      appContext.setUserSettings({
        ...appContext.userSettings,
        suppliers: newChecked,
      });
    },
    [allSuppliers, appContext],
  );

  const isAllSelected = selectedSuppliers.length === allSuppliers.length;

  return {
    selectedSuppliers,
    allSuppliers,
    handleToggle,
    handleToggleAll,
    isAllSelected,
  };
}
