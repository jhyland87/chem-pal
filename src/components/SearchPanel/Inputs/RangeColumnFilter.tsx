import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Tooltip from "@mui/material/Tooltip";
import type { SliderValueLabelProps } from "@mui/material/Slider";
import { useState } from "react";
import styles from "./RangeColumnFilter.module.scss";

/**
 * Compact range (slider) filter for header columns. The column header is
 * rendered directly above, so we no longer show a duplicate header and inline
 * MIN / MAX labels — the `valueLabelDisplay="auto"` tooltip surfaces the live
 * values on hover/focus.
 * @component
 * @param props - Component props.
 * @param props.column - A TanStack column with `meta.filterVariant === "range"`
 *                       whose `getFullRange()` returns `[min, max]`.
 * @returns A 32px-tall MUI `Slider` bound to the column's debounced filter.
 * @example
 * ```tsx
 * // Price column — getFullRange() returns [0, 1000] from facet data.
 * <RangeColumnFilter column={priceColumn} />
 * // Initial render: two thumbs at 0 and 1000.
 * // Dragging the right thumb to 250 →
 * //   column.setFilterValueDebounced([0, 250])
 * // which narrows the table to prices ≤ $250 via TanStack's inNumberRange.
 * ```
 * @source
 */
export default function RangeColumnFilter({ column }: FilterVariantInputProps) {
  function ValueLabelComponent(props: SliderValueLabelProps) {
    const { children, value } = props;
    return (
      <Tooltip
        enterTouchDelay={0}
        placement="top"
        title={value}
        className={`${styles["range-column-filter-tooltip"]} no-padding`}
      >
        {children}
      </Tooltip>
    );
  }

  const [MIN, MAX] = column.getFullRange();
  const [columnFilterRange, setColumnFilterRange] = useState<number[]>(
    (column.getFilterValue() as number[]) || [MIN, MAX],
  );

  const handleColumnFilterChange = (_event: Event, newValue: number[]) => {
    setColumnFilterRange(newValue);
    column.setFilterValueDebounced(newValue);
  };

  return (
    <Box
      className={styles["range-column-filter"]}
      // Center the slider vertically in the filter cell and leave a right-side
      // gap so it doesn't kiss the next filter's input.
      sx={{
        m: 0,
        mr: 0.5,
        px: 1,
        display: "flex",
        alignItems: "center",
        height: 32,
      }}
    >
      <Slider
        value={columnFilterRange}
        valueLabelDisplay="auto"
        min={MIN}
        max={MAX}
        size="small"
        onChange={handleColumnFilterChange}
        getAriaLabel={() => `${column.getHeaderText()} range`}
        slots={{ valueLabel: ValueLabelComponent }}
        sx={{ p: 0, m: 0 }}
      />
    </Box>
  );
}
