import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import IconButton from "@mui/material/IconButton";
import { Table } from "@tanstack/react-table";
import { Product } from "../../types";

const paginationButtonStyle = {
  padding: "1px 5px",
  borderRadius: "3px",
  margin: "0px 2px",
};

export default function Pagination({ table }: { table: Table<Product> }) {
  return (
    <div className="flex items-center gap-2">
      {/*
      <button
        className="border rounded p-1"
        onClick={() => table.setPageIndex(0)}
        disabled={!table.getCanPreviousPage()}
      >
        {'<<'}
      </button>
      <button
        className="border rounded p-1"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        {'<'}
      </button>
      <button
        className="border rounded p-1"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        {'>'}
      </button>
      <button
        className="border rounded p-1"
        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
        disabled={!table.getCanNextPage()}
      >
        {'>>'}
      </button>

      <span className="flex items-center gap-1">

        <div>Page</div>
        <strong>
          {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </strong>
      </span>
      */}
      <span className="flex items-center gap-1">
        <IconButton
          size="small"
          className="border rounded p-1"
          style={paginationButtonStyle}
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <KeyboardDoubleArrowLeftIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          style={paginationButtonStyle}
          className="border rounded p-1"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <KeyboardArrowLeftIcon fontSize="small" />
        </IconButton>
        <input
          type="number"
          min="1"
          style={paginationButtonStyle}
          max={table.getPageCount()}
          defaultValue={table.getState().pagination.pageIndex + 1}
          onChange={(e) => {
            const page = e.target.value ? Number(e.target.value) - 1 : 0;
            table.setPageIndex(page);
          }}
          className="border p-1 rounded w-16"
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
        style={paginationButtonStyle}
        className="border rounded p-1"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        <KeyboardArrowRightIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        style={paginationButtonStyle}
        className="border rounded p-1"
        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
        disabled={!table.getCanNextPage()}
      >
        <KeyboardDoubleArrowRightIcon fontSize="small" />
      </IconButton>
    </div>
  );
}
