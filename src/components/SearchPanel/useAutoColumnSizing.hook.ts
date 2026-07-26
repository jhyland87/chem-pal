import { Table } from '@tanstack/react-table';
import { useCallback, useEffect, useRef } from 'react';

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
 * @source
 */
export function useAutoColumnSizing(table: Table<Product>, data: Product[]) {
  const measureRef = useRef<HTMLTableElement>(null);

  /**
   * Measures the hidden measurement table and applies the result as the column
   * sizing. Each column is fit to its natural content width — the larger of its
   * header text and its widest sampled cell — then clamped to the optional
   * `meta.autoSizeMax` (never below the header, so headers can't wrap). Short
   * columns shrink to their content; long ones (title, description) settle at
   * their cap. Called on data change and by the resizer's double-click handler
   * to reset any manual resizes back to this fit.
   * @source
   */
  const autoSizeColumns = useCallback(() => {
    if (!measureRef.current) return;

    const headerCells = measureRef.current.querySelectorAll('th');
    const bodyRows = measureRef.current.querySelectorAll('tbody tr');
    const leafColumns = table.getAllLeafColumns();

    const colWidths: Record<string, number> = {};
    // Header text width per column, kept separate so it stays a hard minimum:
    // a column never shrinks below its header, even under a small auto-size cap.
    const headerWidths: Record<string, number> = {};

    // Measure headers. `th > span` is a nowrap span sized to the header text
    // itself (independent of the column width), so the header sets the column's
    // minimum width and can never wrap or clip.
    headerCells.forEach((th, idx) => {
      const colId = leafColumns[idx]?.id;
      if (!colId) return;
      const headerContent = th.querySelector('span');
      const width = (headerContent?.scrollWidth ?? th.scrollWidth) + 20;
      headerWidths[colId] = Math.max(headerWidths[colId] || 0, width);
      colWidths[colId] = Math.max(colWidths[colId] || 0, width);
    });

    // Measure body cells (natural single-line width)
    bodyRows.forEach((tr) => {
      tr.querySelectorAll('td').forEach((td, idx) => {
        const colId = leafColumns[idx]?.id;
        if (!colId) return;
        colWidths[colId] = Math.max(colWidths[colId] || 0, td.scrollWidth + 20);
      });
    });

    // Clamp each column to its optional auto-size cap, but never below the
    // header width. Long-content columns (title, description) settle at their
    // cap; everything else stays content-fit.
    for (const column of leafColumns) {
      const width = colWidths[column.id];
      if (width === undefined) continue;
      const cap = column.columnDef.meta?.autoSizeMax;
      const capped = cap !== undefined ? Math.min(width, cap) : width;
      colWidths[column.id] = Math.max(capped, headerWidths[column.id] ?? 0);
    }

    // Apply the measured widths
    if (Object.keys(colWidths).length > 0) {
      table.setColumnSizing(colWidths);
    }
  }, [table]);

  useEffect(() => {
    if (!data.length) return;
    autoSizeColumns();
  }, [data, autoSizeColumns]);

  return {
    /** Ref object for the hidden measurement table element */
    measureRef,
    /** Re-measures and best-fits every column to its natural content width. */
    autoSizeColumns,
    /**
     * Helper function that returns props for the measurement table.
     * The returned object includes a ref and styles to make the table invisible
     * and positioned for measurement without affecting layout.
     *
     * @returns Props object with ref and style properties for the measurement table
     * @source
     */
    getMeasurementTableProps: () => ({
      ref: measureRef,
      style: {
        visibility: 'hidden' as const,
        position: 'absolute' as const,
        pointerEvents: 'none' as const,
        height: 0,
        overflow: 'hidden' as const,
        zIndex: -1,
      },
    }),
  };
}
