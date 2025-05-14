import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";

import Select, { SelectChangeEvent } from "@mui/material/Select";
import { ChangeEvent, useState } from "react";

import { Chip, ListItemText, TextField, Typography } from "@mui/material";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Paper from "@mui/material/Paper";
import { styled } from "@mui/material/styles";

import Slider, { SliderValueLabelProps } from "@mui/material/Slider";
import Tooltip from "@mui/material/Tooltip";

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
const suppliers = ["Supplier 1", "Supplier 2", "Supplier 3", "Supplier 4", "Supplier 5"];

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

export default function FilterModal({
  filterModalOpen,
  setFilterModalOpen,
}: {
  filterModalOpen: boolean;
  setFilterModalOpen: (open: boolean) => void;
}) {
  //const [open, setOpen] = React.useState(false);
  const handleOpen = () => setFilterModalOpen(true);
  const handleClose = () => setFilterModalOpen(false);

  const [columnVisibility, setColumnVisibility] = useState<string[]>([]);
  const [productNameFilter, setProductNameFilter] = useState<string>("");
  const [suppliersFilter, setSuppliersFilter] = useState<string[]>([]);

  const handleColumnVisibilityChange = (event: SelectChangeEvent<typeof columnVisibility>) => {
    const {
      target: { value },
    } = event;
    setColumnVisibility(
      // On autofill we get a stringified value.
      typeof value === "string" ? value.split(",") : value,
    );
  };

  const handleProductNameFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {
      target: { value },
    } = event;
    setProductNameFilter(value);
  };

  const handleSuppliersFilterChange = (event: SelectChangeEvent<typeof suppliersFilter>) => {
    const {
      target: { value },
    } = event;
    setSuppliersFilter(
      // On autofill we get a stringified value.
      typeof value === "string" ? value.split(",") : value,
    );
  };

  const [quantityRange, setQuantityRange] = useState<number[]>([20, 37]);
  const handleQuantityChange = (event: Event, newValue: number[]) => {
    setQuantityRange(newValue);
  };
  const MAX = 100;
  const MIN = 0;
  const marks = [
    {
      value: MIN,
      label: "",
    },
    {
      value: MAX,
      label: "",
    },
  ];
  const [priceRange, setPriceRange] = useState<number[]>([20, 37]);
  const handlePriceChange = (event: Event, newValue: number[]) => {
    setPriceRange(newValue);
  };
  /*
  const [rangeValue, setRangeValue] = React.useState<number[]>([MIN, MAX]);
  const handleQuantityChange = (_: Event, newValue: number[]) => {
    setRangeValue(newValue);
  };
  */

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
            <Grid size={6}>
              <FormControl sx={{ m: 0, width: "100%", lineHeight: "1em", fontSize: "1em" }}>
                <TextField
                  label="Product Name"
                  style={{ lineHeight: "1em" }}
                  id="search-result-product-name-filter"
                  size="small"
                  value={productNameFilter}
                  onChange={handleProductNameFilterChange}
                />
              </FormControl>
            </Grid>

            <Grid size={6}>
              <FormControl sx={{ m: 0, width: "100%", lineHeight: "1em", fontSize: "1em" }}>
                <InputLabel
                  id="search-result-supplier-filter-label"
                  sx={{ lineHeight: "1em", fontSize: "1em" }}
                >
                  Suppliers
                </InputLabel>
                <Select
                  style={{ lineHeight: "1em" }}
                  labelId="search-result-supplier-filter-label"
                  id="search-result-supplier-filter"
                  size="small"
                  multiple
                  value={suppliersFilter}
                  onChange={handleSuppliersFilterChange}
                  input={<OutlinedInput label="Suppliers" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} />
                      ))}
                    </Box>
                  )}
                  MenuProps={MenuProps}
                >
                  {suppliers.map((name) => (
                    <MenuItem key={name} value={name}>
                      <Checkbox checked={suppliersFilter.includes(name)} />
                      <ListItemText primary={name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={6}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography
                  variant="body2"
                  onClick={() => setQuantityRange([MIN, MAX])}
                  sx={{ cursor: "pointer", fontSize: "0.8em" }}
                >
                  ${MIN}
                </Typography>
                <Typography gutterBottom>Price Range</Typography>
                <Typography
                  variant="body2"
                  onClick={() => setQuantityRange([MIN, MAX])}
                  sx={{ cursor: "pointer", fontSize: "0.8em" }}
                >
                  ${MAX}
                </Typography>
              </Box>
              <Slider
                marks={marks}
                step={10}
                value={quantityRange}
                valueLabelDisplay="auto"
                min={MIN}
                max={MAX}
                aria-label="custom thumb label"
                style={{
                  paddingTop: "0px",
                  paddingBottom: "0px",
                  paddingLeft: "0px",
                  paddingRight: "0px",
                }}
                slots={{
                  valueLabel: ValueLabelComponent,
                }}
                //aria-label="custom thumb label Small"
                size="small"
                getAriaLabel={() => "Price range"}
                onChange={handleQuantityChange}
                getAriaValueText={valuetext}
              />
            </Grid>
            <Grid size={6}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography
                  variant="body2"
                  onClick={() => setPriceRange([MIN, MAX])}
                  sx={{ cursor: "pointer", fontSize: "0.8em" }}
                >
                  ${MIN}
                </Typography>
                <Typography gutterBottom>Quantity Range</Typography>
                <Typography
                  variant="body2"
                  onClick={() => setPriceRange([MIN, MAX])}
                  sx={{ cursor: "pointer", fontSize: "0.8em" }}
                >
                  ${MAX}
                </Typography>
              </Box>
              <Slider
                marks={marks}
                step={10}
                value={priceRange}
                valueLabelDisplay="auto"
                min={MIN}
                max={MAX}
                aria-label="custom thumb label"
                style={{
                  paddingTop: "0px",
                  paddingBottom: "0px",
                  paddingLeft: "0px",
                  paddingRight: "0px",
                }}
                slots={{
                  valueLabel: ValueLabelComponent,
                }}
                //aria-label="custom thumb label Small"
                size="small"
                getAriaLabel={() => "Quantity range"}
                onChange={handlePriceChange}
                getAriaValueText={valuetext}
              />
            </Grid>
          </Grid>
        </Box>
      </Modal>
    </div>
  );
}
