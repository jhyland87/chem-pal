import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";
import { FilterInputProps } from "../../types";

export default function TextFilterInput({ column, ...props }: FilterInputProps) {
  console.log("[RangeFilterInput] column:", column);
  console.log("[RangeFilterInput] props:", props);
  return (
    <div>
      <FormControl variant="standard" sx={{ m: 0, minWidth: 120 }} size="small">
        <TextField
          id="standard-basic"
          size="small"
          placeholder={`Search...`}
          style={{
            colorScheme: "light",
          }}
          //value={props.value}
          variant="standard"
          onChange={props.onChange}
          sx={{
            paddingTop: "0px",
            paddingBottom: "0px",
            paddingLeft: "0px",
            paddingRight: "0px",
            marginTop: "0px",
            marginBottom: "0px",
            marginLeft: "0px",
            marginRight: "0px",
            width: "100%",
            height: "auto",
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
