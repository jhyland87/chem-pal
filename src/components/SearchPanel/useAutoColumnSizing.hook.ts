import { Table } from "@tanstack/react-table";
import { useEffect, useRef } from "react";

/**
 * Hook to manage automatic column sizing for TanStack Table.
 * Co-located with ResultsTable.tsx since it's only used by that component.
 *
 * This hook measures the content width of table headers and cells to automatically
 * calculate optimal column widths. It uses a hidden measurement table to determine
 * the required space for each column without affecting the visible table layout.
 *
 * @param table - The TanStack Table instance to apply sizing to
 * @param data - The table data array used to measure cell content
 * @returns Object containing measureRef and helper functions for the measurement table
 *
 * @example
 * ```tsx
 * const { getMeasurementTableProps } = useAutoColumnSizing(table, data);
 *
 * // Render hidden measurement table
 * <table {...getMeasurementTableProps()}>
 *   // table content for measurement
 * </table>
 * ```
 */
export function useAutoColumnSizing(table: Table<Product>, data: Product[]) {
  const measureRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (!measureRef.current || !data.length) return;

    const headerCells = measureRef.current.querySelectorAll("th");
    const bodyRows = measureRef.current.querySelectorAll("tbody tr");

    const colWidths: Record<string, number> = {};

    // Measure headers
    headerCells.forEach((th, idx) => {
      const colId = table.getAllLeafColumns()[idx]?.id;
      if (!colId) return;
      colWidths[colId] = Math.max(colWidths[colId] || 0, th.scrollWidth + 20);
    });

    // Measure body cells
    bodyRows.forEach((tr) => {
      tr.querySelectorAll("td").forEach((td, idx) => {
        const colId = table.getAllLeafColumns()[idx]?.id;
        if (!colId) return;
        colWidths[colId] = Math.max(colWidths[colId] || 0, td.scrollWidth + 20);
      });
    });

    // Apply the measured widths
    if (Object.keys(colWidths).length > 0) {
      table.setColumnSizing(colWidths);
    }
  }, [data, table]);

  return {
    /** Ref object for the hidden measurement table element */
    measureRef,
    /**
     * Helper function that returns props for the measurement table.
     * The returned object includes a ref and styles to make the table invisible
     * and positioned for measurement without affecting layout.
     *
     * @returns Props object with ref and style properties for the measurement table
     */
    getMeasurementTableProps: () => ({
      ref: measureRef,
      style: {
        visibility: "hidden" as const,
        position: "absolute" as const,
        pointerEvents: "none" as const,
        height: 0,
        overflow: "hidden" as const,
        zIndex: -1,
      },
    }),
  };
}
