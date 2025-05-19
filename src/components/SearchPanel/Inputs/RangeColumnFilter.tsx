import {
  Box,
  FormControl,
  Slider,
  SliderValueLabelProps,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { FilterVariantInputProps } from "types";
import "./RangeColumnFilter.scss";

/**
 * RangeColumnFilter component that provides a slider-based range filter for numeric columns.
 * It allows users to filter data based on a minimum and maximum value range.
 *
 * @component
 *
 * @param {FilterVariantInputProps} props - Component props
 * @param {CustomColumn<Product, unknown>} props.column - The column configuration
 *
 * @example
 * ```tsx
 * <RangeColumnFilter column={column} />
 * ```
 */
export default function RangeColumnFilter({ column }: FilterVariantInputProps) {
  /**
   * Custom value label component for the slider that displays the current value in a tooltip.
   *
   * @component
   *
   * @param {SliderValueLabelProps} props - Props for the value label component
   * @param {React.ReactNode} props.children - Child elements
   * @param {number} props.value - Current slider value
   *
   * @returns {JSX.Element} Tooltip-wrapped value label
   */
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
  // Trigger the column filter update with a debounce or throttle
  const [columnFilterRange, setColumnFilterRange] = useState<number[]>([MIN, MAX]);

  /**
   * Handles changes to the range filter slider.
   * Updates the local state and triggers the column filter update with debouncing.
   *
   * @param {Event} event - The change event
   * @param {number[]} newValue - The new range values [min, max]
   */
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
