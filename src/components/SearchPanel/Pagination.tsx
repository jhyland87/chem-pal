import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import IconButton from "@mui/material/IconButton";
import { Table } from "@tanstack/react-table";
import { Product } from "../../types";
import "./Pagination.scss";

export default function Pagination({ table }: { table: Table<Product> }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1">
        <IconButton
          size="small"
          className="border rounded p-1 pagination-button"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <KeyboardDoubleArrowLeftIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          className="pagination-button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <KeyboardArrowLeftIcon fontSize="small" />
        </IconButton>
        <input
          type="number"
          min="1"
          max={table.getPageCount()}
          defaultValue={table.getState().pagination.pageIndex + 1}
          onChange={(e) => {
            const page = e.target.value ? Number(e.target.value) - 1 : 0;
            table.setPageIndex(page);
          }}
          className="border p-1 rounded w-16 pagination-button"
        />
      </span>
      <select
        value={table.getState().pagination.pageSize}
        onChange={(e) => {
          table.setPageSize(Number(e.target.value));
        }}
      >
        {[10, 20, 30, 40, 50].map((pageSize) => (
          <option key={pageSize} value={pageSize}>
            Show {pageSize}
          </option>
        ))}
      </select>
      <IconButton
        size="small"
        className="pagination-button"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        <KeyboardArrowRightIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        className="border rounded p-1 pagination-button"
        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
        disabled={!table.getCanNextPage()}
      >
        <KeyboardDoubleArrowRightIcon fontSize="small" />
      </IconButton>
    </div>
  );
}
