import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";
import { FilterInputProps } from "../types";

export default function SearchPanelTextFilterInput({ column, ...props }: FilterInputProps) {
  console.log("[SearchPanelRangeFilterInput] column:", column);
  console.log("[SearchPanelRangeFilterInput] props:", props);
  return (
    <div>
      <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }} size="small">
        <TextField
          id="standard-basic"
          size="small"
          placeholder={`Search...`}
          style={{
            colorScheme: "light",
          }}
          //value={props.value}
          variant="standard"
          //onChange={props.onChange}
          sx={{
            width: "100%",
            height: "20px",
          }}
          {...props}
        />
      </FormControl>
    </div>
  );
}

/**
    <DebouncedInput
      className="w-36 border shadow rounded full-width-input"
      color="secondary.light"
      onChange={(value) => column.setFilterValue(value)}
      placeholder={`Search...`}
      type="text"
      style={baseInputStyle}
      value={(columnFilterValue ?? "") as string}
    />
 */
