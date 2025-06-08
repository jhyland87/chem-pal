import { Table } from "@tanstack/react-table";
import { useEffect, useRef } from "react";

/**
 * Measures the widest content for each column and updates the table's column sizing state.
 * @param table - The TanStack Table instance
 * @param data - The table data (array of rows)
 */
export function useAutoColumnSizing(table: Table<Product>, data: Product[]) {
  const measureRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (!measureRef.current) return;

    const headerCells = measureRef.current.querySelectorAll("th");
    const bodyRows = measureRef.current.querySelectorAll("tr");

    const colWidths: Record<string, number> = {};

    headerCells.forEach((th, idx) => {
      const colId = table.getAllLeafColumns()[idx]?.id;
      if (!colId) return;
      colWidths[colId] = th.scrollWidth;
    });

    bodyRows.forEach((tr) => {
      tr.querySelectorAll("td").forEach((td, idx) => {
        const colId = table.getAllLeafColumns()[idx]?.id;
        if (!colId) return;
        colWidths[colId] = Math.max(colWidths[colId] || 0, td.scrollWidth);
      });
    });

    table.setColumnSizing(colWidths);
  }, [data, table]);

  // Use the actual TanStack row model for cells
  const rows = table.getRowModel().rows;

  return (
    <table
      ref={measureRef}
      style={{
        visibility: "hidden",
        position: "absolute",
        pointerEvents: "none",
        height: 0,
        overflow: "hidden",
      }}
    >
      <thead>
        <tr>
          {table.getAllLeafColumns().map((col) => (
            <th key={col.id}>
              {typeof col.columnDef.header === "function"
                ? col.id // fallback to col.id for measurement
                : (col.columnDef.header ?? col.id)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {typeof cell.column.columnDef.cell === "function"
                  ? cell.column.columnDef.cell(cell.getContext())
                  : ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
