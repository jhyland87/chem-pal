import Box from "@mui/material/Box";

import { useState } from "react";

import Slider, { SliderValueLabelProps } from "@mui/material/Slider";
import Tooltip from "@mui/material/Tooltip";
import { FilterInputProps } from "../types";

function valuetext(value: number) {
  return `${value}°C`;
}

const ITEM_HEIGHT = 48;

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

export default function SearchPanelRangeFilterInput({
  rangeValues = [],
  column,
  ...props
}: FilterInputProps) {
  console.log("[SearchPanelRangeFilterInput] rangeValues:", rangeValues);
  console.log("[SearchPanelRangeFilterInput] column:", column);
  console.log("[SearchPanelRangeFilterInput] props:", props);
  const [value, setValue] = useState<number[]>([20, 37]);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (event: Event, newValue: number[]) => {
    setValue(newValue);
  };

  return (
    <div>
      <Box
        sx={{
          //width: 300,
          paddingTop: "0px",
          paddingBottom: "0px",
          paddingLeft: "2px",
          paddingRight: "2px",
        }}
      >
        <Slider
          valueLabelDisplay="auto"
          style={{
            paddingTop: "0px",
            paddingBottom: "0px",
            paddingLeft: "0px",
            paddingRight: "0px",
          }}
          slots={{
            valueLabel: ValueLabelComponent,
          }}
          aria-label="custom thumb label Small"
          size="small"
          getAriaLabel={() => "Temperature range"}
          value={value}
          onChange={handleChange}
          getAriaValueText={valuetext}
        />
      </Box>
    </div>
  );
}

/**

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

 */

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
