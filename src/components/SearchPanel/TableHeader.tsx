import ArrowDropDownIcon from "@/icons/ArrowDropDownIcon";
import ArrowDropUpIcon from "@/icons/ArrowDropUpIcon";
import type { ColumnMeta } from "@tanstack/react-table";
import { ColumnDef, flexRender, Header, HeaderGroup, Table } from "@tanstack/react-table";
import { useMemo } from "react";
import { ColumnResizer, SortableHeaderContent, TableHeaderCell } from "../StyledComponents";
import "./TableHeader.scss";

/**
 * TableHeader component that renders the header row of the product results table.
 * It handles column resizing, sorting, and filter configuration.
 *
 * @component
 *
 * @example
 * ```tsx
 * <TableHeader table={table} />
 * ```
 */
export default function TableHeader({ table }: { table: Table<Product> }) {
  /**
   * Creates a configuration object for filterable columns based on their metadata.
   * Each filterable column gets an entry with its filter variant and empty arrays for range and unique values.
   *
   * @returns Object mapping column IDs to their filter configurations
   */
  const filterableColumns = useMemo(() => {
    return table.options.columns.reduce<Record<string, ColumnMeta<Product, unknown>>>(
      (accu, column: ColumnDef<Product, unknown>) => {
        const meta = column.meta as ColumnMeta<Product, unknown> | undefined;
        if (meta?.filterVariant === undefined || !column.id) return accu;

        accu[column.id] = {
          filterVariant: meta.filterVariant,
          rangeValues: [],
          uniqueValues: [],
        };
        return accu;
      },
      {},
    );
  }, [table.options.columns]);

  // Process the filterable columns with memoization
  useMemo(() => {
    for (const [colName, { filterVariant }] of Object.entries(filterableColumns)) {
      const col = table.options.columns.find((col) => col.id === colName);
      if (col === undefined) continue;

      if (filterVariant === "range") {
        /**
         * Calculates the range values (min and max) for numeric columns.
         * @returns Array containing [min, max] values
         */
        const rangeValues = table.options.data.reduce(
          (accu, row: Product) => {
            const value = row[colName as keyof Product] as number;
            if (value < accu[0]) {
              accu[0] = value;
            } else if (value > accu[1]) {
              accu[1] = value;
            }
            return accu;
          },
          [0, 0],
        );
        filterableColumns[colName].rangeValues = rangeValues;
        continue;
      }

      /**
       * Collects unique values for non-range columns.
       * @returns Array of unique values
       */
      const uniqueValues = table.options.data.reduce<string[]>((accu, row: Product) => {
        const value = row[colName as keyof Product] as string;
        if (value !== undefined && accu.indexOf(value) === -1) {
          accu.push(value);
        }
        return accu;
      }, []);
      filterableColumns[colName].uniqueValues = uniqueValues;
    }
  }, [filterableColumns, table.options.data, table.options.columns]);

  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup: HeaderGroup<Product>) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header: Header<Product, unknown>) => {
            // If the column has filterable values, populate the unique values for the column
            if (filterableColumns[header.id] !== undefined) {
              const meta = header.column.columnDef.meta as ColumnMeta<Product, unknown>;
              header.column.columnDef.meta = {
                ...meta,
                ...filterableColumns[header.id],
              };
            }

            return (
              <TableHeaderCell
                key={header.id}
                colSpan={header.colSpan}
                headerSize={header.getSize()}
                colSize={header.column.getSize()}
              >
                {header.isPlaceholder ? null : (
                  <>
                    <ColumnResizer
                      isResizing={header.column.getIsResizing()}
                      onDoubleClick={header.column.resetSize}
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`resizer ${header.column.getIsResizing() ? "isResizing" : ""}`}
                    />
                    <SortableHeaderContent
                      canSort={header.column.getCanSort()}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ArrowDropUpIcon className="sort-icon" />,
                        desc: <ArrowDropDownIcon className="sort-icon" />,
                      }[header.column.getIsSorted() as string] ?? null}
                    </SortableHeaderContent>
                  </>
                )}
              </TableHeaderCell>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}
