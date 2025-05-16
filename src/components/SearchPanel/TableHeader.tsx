import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import { ColumnDef, flexRender, Header, HeaderGroup, Table } from "@tanstack/react-table";
import { CSSProperties } from "react";
import { ColumnMeta, Product } from "../../types";

export default function TableHeader({ table }: { table: Table<Product> }) {
  // Get the type of columns filterVariant, and create an object for storing the
  // necessary filter data to show in the table column filters
  const filterableColumns = table.options.columns.reduce<Record<string, ColumnMeta>>(
    (accu, column: ColumnDef<Product, unknown>) => {
      const meta = column.meta as ColumnMeta | undefined;
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

  // Now parse teh results to get the filterable values.
  // @todo: This runs every time there's a row updated or added. It would be better to save
  // this data as the rows are outputted from the factory method, then set the column filter
  // values once its finished.
  for (const [colName, { filterVariant }] of Object.entries(filterableColumns)) {
    const col = table.options.columns.find((col) => col.id === colName);
    if (col === undefined) continue;

    if (filterVariant === "range") {
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

    const uniqueValues = table.options.data.reduce<string[]>((accu, row: Product) => {
      const value = row[colName as keyof Product] as string;
      if (value !== undefined && accu.indexOf(value) === -1) {
        accu.push(value);
      }
      return accu;
    }, []);
    filterableColumns[colName].uniqueValues = uniqueValues;
  }

  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup: HeaderGroup<Product>) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header: Header<Product, unknown>) => {
            // If the column has filterable values, populate the unique values for the column
            if (filterableColumns[header.id] !== undefined) {
              const meta = header.column.columnDef.meta as ColumnMeta;
              header.column.columnDef.meta = {
                ...meta,
                ...filterableColumns[header.id],
              };
            }

            return (
              <th
                key={header.id}
                colSpan={header.colSpan}
                style={
                  {
                    width: `calc(var(--header-${header?.id}-size) * 1px)`,
                    "--header-size": `${header.getSize()}px`,
                    "--col-size": `${header.column.getSize()}px`,
                  } as CSSProperties
                }
              >
                {header.isPlaceholder ? null : (
                  <>
                    <div
                      style={{ cursor: "col-resize" }}
                      onDoubleClick={header.column.resetSize}
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`resizer ${header.column.getIsResizing() ? "isResizing" : ""}`}
                    />
                    <div
                      className={`${header.column.getCanSort() ? "cursor-pointer select-none" : ""}`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: (
                          <ArrowDropUpIcon
                            fontSize="small"
                            style={{
                              fontSize: "1rem",
                              position: "absolute",
                            }}
                          />
                        ),
                        desc: (
                          <ArrowDropDownIcon
                            fontSize="small"
                            style={{
                              fontSize: "1rem",
                              position: "absolute",
                            }}
                          />
                        ),
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </>
                )}
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}
