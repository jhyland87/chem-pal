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
import "./RangeColumnFilter.scss";

export default function RangeColumnFilter({ column }: FilterVariantInputProps) {
  function ValueLabelComponent(props: SliderValueLabelProps) {
    const { children, value } = props;

    return (
      <Tooltip
        enterTouchDelay={0}
        placement="top"
        title={value}
        className="range-column-filter-tooltip no-padding"
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
    <FormControl className="range-column-filter fullwidth">
      <Box className="flex-row">
        <Typography
          variant="body2"
          onClick={() => setColumnFilterRange([MIN, MAX])}
          className="filter-minmax"
        >
          {MIN}
        </Typography>
        <Typography gutterBottom>{column.getHeaderText()}</Typography>
        <Typography
          variant="body2"
          onClick={() => setColumnFilterRange([MIN, MAX])}
          className="filter-minmax"
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
        className="no-padding"
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
