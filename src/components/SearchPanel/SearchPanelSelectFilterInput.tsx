import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { FilterInputProps } from "../../types";

export default function SelectFilterInput({ column, children, ...props }: FilterInputProps) {
  return (
    <div>
      <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }} size="small">
        <Select
          labelId="demo-simple-select-standard-label"
          id="demo-simple-select-standard"
          size="small"
          style={{
            colorScheme: "light",
          }}
          sx={{
            width: "100%",
            height: "20px",
          }}
          {...props}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {children}
        </Select>
      </FormControl>
    </div>
  );
}
