import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";

import Select, { SelectChangeEvent } from "@mui/material/Select";
import { ComponentType, useState } from "react";

import { Checkbox, Chip, ListItemText, MenuItem, OutlinedInput, Typography } from "@mui/material";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import Paper from "@mui/material/Paper";
import { styled } from "@mui/material/styles";

import { SliderValueLabelProps } from "@mui/material/Slider";
import Tooltip from "@mui/material/Tooltip";

import { Table } from "@tanstack/react-table";
import { CustomColumn, FilterVariantInputProps, Product } from "../../types";
import { RangeColumnFilter } from "./RangeColumnFilter";
import { SelectColumnFilter } from "./SelectColumnFilter";
import { TextColumnFilter } from "./TextColumnFilter";

const filterComponentMap: Record<string, ComponentType<FilterVariantInputProps>> = {
  text: TextColumnFilter,
  range: RangeColumnFilter,
  select: SelectColumnFilter,
};

function FilterVariantComponent({
  filterVariant = "text",
  columnConfig,
}: {
  filterVariant: string | undefined;
  columnConfig: CustomColumn<Product, unknown>;
}) {
  const ComponentToRender = filterComponentMap[filterVariant ?? "text"];

  if (!ComponentToRender) {
    return <div>Filter Component not found: {filterVariant}</div>;
  }

  return <ComponentToRender columnConfig={columnConfig} />;
}

function valuetext(value: number) {
  return `${value}°C`;
}

function ValueLabelComponent(props: SliderValueLabelProps) {
  const { children, value } = props;

  return (
    <Tooltip
      enterTouchDelay={0}
      placement="top"
      title={value}
      style={{
        paddingTop: "0px",
        paddingBottom: "0px",
        paddingLeft: "0px",
        paddingRight: "0px",
        margin: 0,
      }}
    >
      {children}
    </Tooltip>
  );
}

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color: (theme as any).vars?.palette?.text?.secondary ?? theme.palette.text.secondary,
  flexGrow: 1,
  ...theme.applyStyles("dark", {
    backgroundColor: "#1A2027",
  }),
}));

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

const names = ["Product Name", "Supplier", "Description", "Price", "Quantity", "CAS", "etc"];

const style = {
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
};
/*
function getUniqueValues(table: Table<Product>) {
  return table.options.data.reduce((accu: Record<string, (string | number)[]>, row: Product) => {
    for (const [col, val] of Object.entries(row)) {
      if (!Array.isArray(accu[col])) accu[col] = [];
      if (!accu[col].includes(val)) {
        accu[col].push(val);
        if (typeof val === "number") {
          accu[col]?.sort((a, b) => {
            if (typeof a === "number" && typeof b === "number") {
              return a - b;
            }
            return 0;
          });
        }
      }
    }
    return accu;
  }, {});
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
  //const [open, setOpen] = React.useState(false);
  //const handleOpen = () => setFilterModalOpen(true);
  const handleClose = () => setFilterModalOpen(false);

  console.log("table.getAllLeafColumns():", table.getAllLeafColumns());

  const [columnVisibility, setColumnVisibility] = useState<string[]>([]);
  //const [productNameFilter, setProductNameFilter] = useState<string>("");
  //const [suppliersFilter, setSuppliersFilter] = useState<string[]>([]);

  const handleColumnVisibilityChange = (event: SelectChangeEvent<typeof columnVisibility>) => {
    const {
      target: { value },
    } = event;
    setColumnVisibility(
      // On autofill we get a stringified value.
      typeof value === "string" ? value.split(",") : value,
    );
  };

  //const handleProductNameFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
  //  const {
  //    target: { value },
  //  } = event;
  //  setProductNameFilter(value);
  //};

  //const handleSuppliersFilterChange = (event: SelectChangeEvent<typeof suppliersFilter>) => {
  //  const {
  //    target: { value },
  //  } = event;
  //  setSuppliersFilter(
  // On autofill we get a stringified value.
  //    typeof value === "string" ? value.split(",") : value,
  //  );
  //};

  //const [quantityRange, setQuantityRange] = useState<number[]>([20, 37]);
  //const handleQuantityChange = (event: Event, newValue: number[]) => {
  //  setQuantityRange(newValue);
  //};
  //const MAX = 100;
  //const MIN = 0;
  //const marks = [
  //  {
  //    value: MIN,
  //    label: "",
  //  },
  //  {
  //    value: MAX,
  //    label: "",
  //  },
  //];
  //const [priceRange, setPriceRange] = useState<number[]>([20, 37]);
  //const handlePriceChange = (event: Event, newValue: number[]) => {
  //  setPriceRange(newValue);
  //};
  /*
  const [rangeValue, setRangeValue] = React.useState<number[]>([MIN, MAX]);
  const handleQuantityChange = (_: Event, newValue: number[]) => {
    setRangeValue(newValue);
  };
  */
  // Example usage of getUniqueValues

  return (
    <div>
      <Modal
        open={filterModalOpen}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
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
              <FormControl sx={{ m: 0, width: "100%", lineHeight: "1em", fontSize: "1em" }}>
                <InputLabel
                  id="search-result-column-visibility-label"
                  sx={{ lineHeight: "1em", fontSize: "1em" }}
                >
                  Column Visibility
                </InputLabel>
                <Select
                  style={{ lineHeight: "1em" }}
                  labelId="search-result-column-visibility-label"
                  id="search-result-column-visibility"
                  size="small"
                  multiple
                  value={columnVisibility}
                  onChange={handleColumnVisibilityChange}
                  input={<OutlinedInput label="Column Visibility" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} />
                      ))}
                    </Box>
                  )}
                  MenuProps={MenuProps}
                >
                  {names.map((name) => (
                    <MenuItem key={name} value={name}>
                      <Checkbox checked={columnVisibility.includes(name)} />
                      <ListItemText primary={name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {table.getAllColumns().map((column: CustomColumn<Product, unknown>) => {
              if (!column.getCanFilter()) return;
              return (
                <Grid size={6} key={column.id}>
                  <FilterVariantComponent
                    filterVariant={column.columnDef?.meta?.filterVariant}
                    columnConfig={column}
                  />
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Modal>
    </div>
  );
}
