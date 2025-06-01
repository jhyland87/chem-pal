import { SliderValueLabelProps } from "@mui/material";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import Slider from "@mui/material/Slider";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import "./RangeColumnFilter.scss";

/**
 * RangeColumnFilter component that provides a slider-based range filter for numeric columns.
 * It allows users to filter data based on a minimum and maximum value range.
 *
 * @component
 * @category Components
 * @subcategory SearchPanel
 * {@link FilterVariantInputProps}
 * @param props - Component props
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
   * @param  props - Props for the value label component
   * @returns Tooltip-wrapped value label
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
  // Initialize with existing filter value or full range
  const [columnFilterRange, setColumnFilterRange] = useState<number[]>(
    (column.getFilterValue() as number[]) || [MIN, MAX],
  );

  /**
   * Handles changes to the range filter slider.
   * Updates the local state and triggers the column filter update with debouncing.
   *
   * @param  event - The change event
   * @param newValue - The new range values [min, max]
   */
  const handleColumnFilterChange = (event: Event, newValue: number[]) => {
    setColumnFilterRange(newValue);
    column.setFilterValueDebounced(newValue);
  };

  /**
   * Resets the range filter to the full range.
   * Updates both local state and triggers the column filter update.
   */
  const handleResetRange = () => {
    const fullRange = [MIN, MAX];
    setColumnFilterRange(fullRange);
    column.setFilterValueDebounced(fullRange);
  };

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
        <Typography variant="body2" onClick={handleResetRange} className="filter-minmax">
          {MIN}
        </Typography>
        <Typography gutterBottom>{column.getHeaderText()}</Typography>
        <Typography variant="body2" onClick={handleResetRange} className="filter-minmax">
          {MAX}
        </Typography>
      </Box>
      <Slider
        marks={marks}
        value={columnFilterRange}
        valueLabelDisplay="auto"
        min={MIN}
        max={MAX}
        aria-label="custom thumb label"
        className="no-padding"
        slots={{
          valueLabel: ValueLabelComponent,
        }}
        size="small"
        getAriaLabel={() => `${column.getHeaderText()} range`}
        onChange={handleColumnFilterChange}
      />
    </FormControl>
  );
}
