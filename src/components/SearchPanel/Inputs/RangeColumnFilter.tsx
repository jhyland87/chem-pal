import {
  Box,
  FormControl,
  Slider,
  SliderValueLabelProps,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { FilterVariantInputProps } from "../../../types";

export default function RangeColumnFilter({ column }: FilterVariantInputProps) {
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

  const [MIN, MAX] = column.getFullRange();
  // Trigger the column filter update with a debonce or throttle
  const [columnFilterRange, setColumnFilterRange] = useState<number[]>([MIN, MAX]);

  const handleColumnFilterChange = (event: Event, newValue: number[]) => {
    setColumnFilterRange(newValue);
    column.setFilterValueDebounced(newValue);
  };
  console.log("columnFilterRange", columnFilterRange);
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

  return (
    <FormControl sx={{ m: 0, width: "100%", lineHeight: "1em", fontSize: "1em" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography
          variant="body2"
          onClick={() => setColumnFilterRange([MIN, MAX])}
          sx={{ cursor: "pointer", fontSize: "0.8em" }}
        >
          {MIN}
        </Typography>
        <Typography gutterBottom>{column.getHeaderText()}</Typography>
        <Typography
          variant="body2"
          onClick={() => setColumnFilterRange([MIN, MAX])}
          sx={{ cursor: "pointer", fontSize: "0.8em" }}
        >
          {MAX}
        </Typography>
      </Box>
      <Slider
        marks={marks}
        //step={10}
        value={columnFilterRange}
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
        getAriaLabel={() => `${column.getHeaderText()} range`}
        onChange={handleColumnFilterChange}
        // getAriaValueText={valuetext}
      />
    </FormControl>
  );
}
