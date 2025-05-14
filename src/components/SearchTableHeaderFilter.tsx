import MenuItem from "@mui/material/MenuItem";

import InputBase from "@mui/material/InputBase";
import Select from "@mui/material/Select";
import { styled } from "@mui/material/styles";

import { Column } from "@tanstack/react-table";
import { ColumnMeta, Product } from "../types";
import SearchPanelRangeFilterInput from "./SearchPanelRangeFilterInput";
// Define the column meta type

const BootstrapInput = styled(InputBase)(({ theme }) => ({
  "& .MuiInputBase-input": {
    width: "100%",
    borderRadius: 0,
    position: "relative",
    backgroundColor: (theme.vars ?? theme).palette.background.paper,
    border: 0,
    borderBottom: "1px solid #ced4da",
    fontSize: 10,
    //padding: "10px 26px 10px 12px",
    padding: 0,
    height: 20,
    margin: 0,
    transition: theme.transitions.create(["border-color", "box-shadow"]),
    // Use the system font instead of the default Roboto font.
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(","),
    "&:focus": {
      borderRadius: 0,
      borderColor: "#80bdff",
      boxShadow: "0 0 0 0.2rem rgba(0,123,255,.25)",
    },
  },
}));

export default function SearchTableHeaderFilter({ column }: { column: Column<Product, unknown> }) {
  const columnFilterValue = column.getFilterValue();
  const colDef = column.columnDef;
  const { minSize, maxSize } = colDef;
  const { filterVariant = "text" } = (colDef.meta || {}) as ColumnMeta;

  return filterVariant === "range" ? (
    <SearchPanelRangeFilterInput column={column} rangeValues={[]} />
  ) : filterVariant === "select" ? (
    <Select
      style={{ minWidth: minSize, maxWidth: maxSize, width: "100%", lineHeight: "0.47em" }}
      size="small"
      labelId="demo-customized-select-label"
      id="demo-customized-select"
      variant="standard"
      //value={age}
      //onChange={handleChange}
      input={<BootstrapInput />}
    >
      <MenuItem disabled value="">
        <em>Test</em>
      </MenuItem>
      <MenuItem value="">
        <em>None</em>
      </MenuItem>
      <MenuItem value={10}>Ten</MenuItem>
      <MenuItem value={20}>Twenty</MenuItem>
      <MenuItem value={30}>Thirty</MenuItem>
    </Select>
  ) : (
    <BootstrapInput
      style={{ minWidth: minSize, maxWidth: maxSize, width: "100%", lineHeight: "0.47em" }}
      id="demo-customized-textbox"
      size="small"
      variant="standard"
      placeholder="Foo"
    />

    // See faceted column filters example for datalist search suggestions
  );
}
