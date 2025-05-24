import type { FilterVariantComponentProps, FilterVariantInputProps } from "@/types/props";
import { type CustomColumn, type Product } from "@/types";
import { Button, Typography } from "@mui/material";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Modal from "@mui/material/Modal";
import { type SelectChangeEvent } from "@mui/material/Select";
import { type Table } from "@tanstack/react-table";
import { ComponentType, useState } from "react";
import "./FilterModal.scss";
import ColumnVisibilitySelect from "./Inputs/ColumnVisibilitySelect";
import RangeColumnFilter from "./Inputs/RangeColumnFilter";
import SelectColumnFilter from "./Inputs/SelectColumnFilter";
import TextColumnFilter from "./Inputs/TextColumnFilter";

/**
 * Map of filter variants to their corresponding filter components.
 * Each variant (text, range, select) has a dedicated component for handling its specific filtering needs.
 */
const filterComponentMap: Record<string, ComponentType<FilterVariantInputProps>> = {
  text: TextColumnFilter,
  range: RangeColumnFilter,
  select: SelectColumnFilter,
};

/**
 * Renders the appropriate filter component based on the column's filter variant.
 * Falls back to text filter if no variant is specified or if the variant is not found.
 *
 * @component
 *
 * @param props - Component props
 *
 * @returns The rendered filter component
 */
function FilterVariantComponent({ column }: FilterVariantComponentProps) {
  const ComponentToRender = filterComponentMap[column.columnDef?.meta?.filterVariant ?? "text"];
  if (!ComponentToRender)
    return <div>Filter Component not found: {column.columnDef?.meta?.filterVariant}</div>;
  return <ComponentToRender column={column} />;
}

/**
 * Modal component that provides filtering and column visibility controls for the product results table.
 * It includes column visibility selection and various filter types (text, range, select) based on column configuration.
 *
 * @component
 *
 * @param props - Component props
 *
 * @example
 * ```tsx
 * <FilterModal
 *   filterModalOpen={isOpen}
 *   setFilterModalOpen={setIsOpen}
 *   table={table}
 * />
 * ```
 */
export default function FilterModal({
  filterModalOpen,
  setFilterModalOpen,
  table,
}: {
  filterModalOpen: boolean;
  setFilterModalOpen: (open: boolean) => void;
  table: Table<Product>;
}) {
  /**
   * Closes the filter modal.
   */
  const handleClose = () => setFilterModalOpen(false);

  /**
   * Gets the list of currently visible column IDs.
   * @returns Array of visible column IDs
   */
  const columnStatus = table
    .getAllColumns()
    .reduce((accu: string[], column: CustomColumn<Product, unknown>) => {
      if (column.getIsVisible() && column.getCanHide()) accu.push(column.id);
      return accu;
    }, []);

  const [columnVisibility, setColumnVisibility] = useState<string[]>(columnStatus);

  /**
   * Handles changes to column visibility selection.
   * Updates the visibility state and applies changes to the table columns.
   *
   * @param event - The change event from the select component
   */
  const handleColumnVisibilityChange = (event: SelectChangeEvent<typeof columnVisibility>) => {
    const {
      target: { value },
    } = event;
    setColumnVisibility(
      // On autofill we get a stringified value.
      typeof value === "string" ? value.split(",") : value,
    );

    table.getAllColumns().forEach((column: CustomColumn<Product, unknown>) => {
      column.setColumnVisibility(!column.getCanHide() || columnVisibility.includes(column.id));
    });
  };

  /**
   * Gets a map of column IDs to their header text for filterable columns.
   * @returns Object mapping column IDs to their header text
   */
  const columnNames = table
    .getAllColumns()
    .reduce((accu: Record<string, string>, col: CustomColumn<Product, unknown>) => {
      if (col.getCanFilter()) accu[col.id] = col.getHeaderText() ?? "";
      return accu;
    }, {});

  return (
    <div>
      <Modal
        id="filter-modal-container"
        className="filter-modal"
        open={filterModalOpen}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box
          className="filter-modal-box"
          sx={{
            bgcolor: "background.paper",
          }}
        >
          <Typography className="modal-modal-title" gutterBottom={true} variant="h6" component="h2">
            Search Result Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid size={6}>
              <ColumnVisibilitySelect
                columnNames={columnNames}
                columnVisibility={columnVisibility}
                handleColumnVisibilityChange={handleColumnVisibilityChange}
              />
            </Grid>
            {table.getAllColumns().map((column: CustomColumn<Product, unknown>) => {
              if (!column.getCanFilter()) return;
              return (
                <Grid size={6} key={column.id}>
                  <FilterVariantComponent column={column} />
                </Grid>
              );
            })}
          </Grid>
          <Grid container spacing={2}>
            <Divider />
            <Grid size={12}>
              <Button className="fullwidth" variant="contained" color="primary">
                Clear All
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Modal>
    </div>
  );
}
