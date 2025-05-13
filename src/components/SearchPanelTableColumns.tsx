import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import IconButton from "@mui/material/IconButton";
import { ColumnDef } from "@tanstack/react-table";
import { Product, ProductRow } from "../types";
import { default as Link } from "./TabLink";

export default function SearchPanelTableColumns(): ColumnDef<Product, unknown>[] {
  return [
    {
      id: "expander",
      header: () => null,
      cell: ({ row }: ProductRow) => {
        return row.getCanExpand() ? (
          <IconButton
            size="small"
            onClick={row.getToggleExpandedHandler()}
            style={{
              borderRadius: "10%",
              padding: "2px",
              cursor: "pointer",
            }}
          >
            {row.getIsExpanded() ? (
              <ArrowDropDownIcon fontSize="small" />
            ) : (
              <ArrowRightIcon fontSize="small" />
            )}
          </IconButton>
        ) : (
          "🔵"
        );
      },
      enableHiding: false,
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false,
      size: 20,
      minSize: 20,
      maxSize: 20,
    },
    {
      accessorKey: "title",
      header: () => <span>Title</span>,
      cell: ({ row }: ProductRow) => {
        return <Link href={row.original.url}>{row.original.title}</Link>;
      },
      enableHiding: false,
      minSize: 100,
      meta: {
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "supplier",
      header: () => <span>Supplier</span>,
      accessorKey: "supplier",
      cell: (info) => info.getValue(),
      meta: {
        filterVariant: "select",
      },
      minSize: 90,
    },
    {
      accessorKey: "description",
      header: "Description",
      meta: {
        filterVariant: "text",
      },
      minSize: 215,
    },
    {
      id: "price",
      header: "Price",
      accessorKey: "price",
      cell: ({ row }: ProductRow) => {
        return row.original.displayPrice;
      },
      meta: {
        filterVariant: "range",
      },
      maxSize: 80,
    },
    {
      id: "quantity",
      header: "Qty",
      accessorKey: "quantity",
      meta: {
        filterVariant: "range",
      },
      cell: ({ row }: ProductRow) => {
        return row.original.displayQuantity;
      },
      maxSize: 50,
    },
    {
      id: "uom",
      header: "Unit",
      accessorKey: "uom",
      meta: {
        filterVariant: "select",
      },
      maxSize: 50,
    },
  ];
}
