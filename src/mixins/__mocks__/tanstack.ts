import { type Column, type Table } from "@tanstack/react-table";
import { vi } from "vitest";

// Mock data for testing
export const mockData = [
  { id: 1, name: "Alice", age: 25, active: true },
  { id: 2, name: "Bob", age: 30, active: false },
  { id: 3, name: "Charlie", age: 35, active: true },
];

// Mock column and table objects.
// `accessorKey` defaults to `id` so the range / all-value helpers (which read
// `columnDef.accessorKey`) resolve against the matching data field.
export const createMockColumn = (
  id: string,
  header: any,
  accessorKey: string = id,
): Column<any, unknown> =>
  ({
    id,
    columnDef: { header, accessorKey },
    getCanHide: () => true,
    getIsVisible: () => true,
    toggleVisibility: vi.fn(),
  }) as unknown as Column<any, unknown>;

export const createMockTable = (data: any[]): Table<any> =>
  ({
    getRowModel: () => ({
      rows: data.map((row, index) => ({
        index,
        original: row,
        getValue: (columnId: string) => row[columnId],
      })),
    }),
    options: { data },
  }) as unknown as Table<any>;
