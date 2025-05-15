import {
  Box,
  FormControl,
  Slider,
  SliderValueLabelProps,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { FilterVariantInputProps } from "../../types";

export function RangeColumnFilter({ columnConfig }: FilterVariantInputProps) {
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

  const columnUniqueValues = columnConfig.getUniqueValues();
  const columnHeader = columnConfig.getHeaderText();

  const [columnFilterRange, setColumnFilterRange] = useState<number[]>([
    columnUniqueValues[0] as number,
    columnUniqueValues[columnUniqueValues.length - 1] as number,
  ]);

  const handleColumnFilterChange = (event: Event, newValue: number[]) => {
    setColumnFilterRange(newValue);
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

  return (
    <FormControl sx={{ m: 0, width: "100%", lineHeight: "1em", fontSize: "1em" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography
          variant="body2"
          onClick={() => setColumnFilterRange([MIN, MAX])}
          sx={{ cursor: "pointer", fontSize: "0.8em" }}
        >
          ${MIN}
        </Typography>
        <Typography gutterBottom>{columnHeader}</Typography>
        <Typography
          variant="body2"
          onClick={() => setColumnFilterRange([MIN, MAX])}
          sx={{ cursor: "pointer", fontSize: "0.8em" }}
        >
          ${MAX}
        </Typography>
      </Box>
      <Slider
        marks={marks}
        step={10}
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
        getAriaLabel={() => `${columnHeader} range`}
        onChange={handleColumnFilterChange}
        // getAriaValueText={valuetext}
      />
    </FormControl>
  );
}
