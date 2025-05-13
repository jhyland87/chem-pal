import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { FilterInputProps } from "../types";

export default function SearchPanelRangeFilterInput({
  rangeValues = [],
  column,
  ...props
}: FilterInputProps) {
  console.log("[SearchPanelRangeFilterInput] rangeValues:", rangeValues);
  console.log("[SearchPanelRangeFilterInput] column:", column);
  console.log("[SearchPanelRangeFilterInput] props:", props);
  return (
    <div>
      <Select
        labelId="demo-simple-select-standard-label"
        id="demo-simple-select-standard"
        size="small"
        style={{
          colorScheme: "light",
        }}
        //value={age}
        //onChange={handleChange}
        //label={name}
        sx={{
          width: "100%",
          height: "20px",
        }}
        {...props}
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        <option key={0} value={0}>
          test
        </option>
      </Select>
    </div>
  );
}

/*

<div>
      <div className="flex space-x-2">
        <DebouncedInput
          type="number"
          color="secondary.light"
          value={(columnFilterValue as [number, number])?.[0] ?? ""}
          onChange={(value) => column.setFilterValue((old: [number, number]) => [value, old?.[1]])}
          placeholder={`Min`}
          className="w-24 border shadow rounded half-width-input"
          style={{
            ...baseInputStyle,
          }}
        />
        <DebouncedInput
          type="number"
          color="secondary.light"
          value={(columnFilterValue as [number, number])?.[1] ?? ""}
          onChange={(value) => column.setFilterValue((old: [number, number]) => [old?.[0], value])}
          placeholder={`Max`}
          className="w-24 border shadow rounded half-width-input"
          style={{
            ...baseInputStyle,
          }}
        />
      </div>
      <div className="h-1" />
    </div>
*/
