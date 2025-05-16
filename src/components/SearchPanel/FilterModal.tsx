import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";

import Divider from "@mui/material/Divider";
import { SelectChangeEvent } from "@mui/material/Select";
import { ComponentType, useState } from "react";

import { Button, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { Table } from "@tanstack/react-table";
import {
  CustomColumn,
  FilterVariantComponentProps,
  FilterVariantInputProps,
  Product,
} from "../../types";
import ColumnVisibilitySelect from "./Inputs/ColumnVisibilitySelect";
import RangeColumnFilter from "./Inputs/RangeColumnFilter";
import SelectColumnFilter from "./Inputs/SelectColumnFilter";
import TextColumnFilter from "./Inputs/TextColumnFilter";

/**
 * filterComponentMap is a map of filter variants to their corresponding components.
 * @type {Record<string, ComponentType<FilterVariantInputProps>>}
 */
const filterComponentMap: Record<string, ComponentType<FilterVariantInputProps>> = {
  text: TextColumnFilter,
  range: RangeColumnFilter,
  select: SelectColumnFilter,
};

/**
 * FilterVariantComponent is a component that renders a filter variant component based on the filter variant.
 * @param column - The column configuration.
 * @returns A component that renders a filter variant component based on the filter variant.
 */
function FilterVariantComponent({ column }: FilterVariantComponentProps) {
  const ComponentToRender = filterComponentMap[column.columnDef?.meta?.filterVariant ?? "text"];
  if (!ComponentToRender)
    return <div>Filter Component not found: {column.columnDef?.meta?.filterVariant}</div>;
  return <ComponentToRender column={column} />;
}
/*
const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

function getStyles(name: string, personName: string[], theme: Theme) {
  return {
    fontWeight: personName.includes(name)
      ? theme.typography.fontWeightMedium
      : theme.typography.fontWeightRegular,
  };
}
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
  const handleClose = () => setFilterModalOpen(false);

  const columnStatus = table
    .getAllColumns()
    .reduce((accu: string[], column: CustomColumn<Product, unknown>) => {
      if (column.getIsVisible() && column.getCanHide()) accu.push(column.id);
      return accu;
    }, []);

  const [columnVisibility, setColumnVisibility] = useState<string[]>(columnStatus);
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

  const columnNames = table
    .getAllColumns()
    .reduce((accu: Record<string, string>, col: CustomColumn<Product, unknown>) => {
      if (col.getCanFilter()) accu[col.id] = col.getHeaderText() ?? "";
      return accu;
    }, {});

  return (
    <div>
      <Modal
        open={filterModalOpen}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            maxWidth: 700,
            width: 700,
            height: 350,
            bgcolor: "background.paper",
            border: "2px solid #000",
            boxShadow: 24,
            p: 4,
          }}
        >
          <Typography
            id="modal-modal-title"
            gutterBottom={true}
            variant="h6"
            component="h2"
            sx={{ textAlign: "center" }}
          >
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
              <Button variant="contained" color="primary" style={{ width: "100%" }}>
                Clear All
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Modal>
    </div>
  );
}
