import {
  Fragment,
  MouseEvent,
  useState,
  ChangeEvent,
  ReactElement,
  CSSProperties,
  useEffect
} from 'react'

import {
  ArrowDropDown as ArrowDropDownIcon,
  ArrowRight as ArrowRightIcon,
} from '@mui/icons-material';

import {
  Box,
  IconButton,
  Divider,
  MenuList,
  Toolbar,
  Tooltip,
  Typography,
  Paper,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Menu,
  MenuItem,
  Link,
} from '@mui/material';

import {
  Search as SearchIcon,
  SearchOff as SearchOffIcon,
  Checklist as ChecklistIcon,
  Done as DoneIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getExpandedRowModel,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Row,
} from '@tanstack/react-table'

import {
  ProductTableProps,
  Product,
  SearchPanelToolbarProps,
  ProductRow
} from '../types';


import { isEmpty } from 'lodash';

import SearchInput from './SearchInput';
import SearchTablePagination from './SearchTablePagination';
import SearchTableHeader from './SearchTableHeader'
import SearchResultVariants from './SearchResultVariants';
import { useSettings } from '../context';
import SupplierFactory from '../suppliers/supplier_factory';
import SpeedDialMenu from './SpeedDialMenu';
import LoadingBackdrop from './LoadingBackdrop';
import SearchPanelToolbar from './SearchPanelToolbar';
import SearchPanelTable from './SearchPanelTable';

let fetchController: AbortController;

const ITEM_HEIGHT = 48;



// When the user clicks on a link in the table
const handleResultClick = (event: MouseEvent<HTMLAnchorElement>) => {
  // Stop the form from propagating
  event.preventDefault();
  // Get the target
  const target = event.target as HTMLAnchorElement;
  // Open a new tab to that targets href
  chrome.tabs.create({ url: target.href, active: false });
};

function columns(): ColumnDef<Product, any>[] {
  return [
    {
      id: 'expander',
      header: () => null,
      cell: ({ row }: ProductRow) => {
        return row.getCanExpand() ? (
          <IconButton
            size='small'
            onClick={row.getToggleExpandedHandler()}
            style={{
              borderRadius: '10%',
              padding: '2px',
              cursor: 'pointer'
            }}
          >
            {row.getIsExpanded()
              ? <ArrowDropDownIcon fontSize='small' />
              : <ArrowRightIcon fontSize='small' />}
          </IconButton>
        ) : (
          '🔵'
        )
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
      accessorKey: 'title',
      header: () => <span>Title</span>,
      cell: ({ row }: ProductRow) => {
        return (<Link onClick={handleResultClick} href={row.original.url}>{row.original.title}</Link>)
      },
      enableHiding: false,
      minSize: 100,
      meta: {
        filterVariant: 'text',
        style: {
          textAlign: 'left',
        },
      },
    },
    {
      id: 'supplier',
      header: () => <span>Supplier</span>,
      accessorKey: 'supplier',
      cell: info => info.getValue(),
      meta: {
        filterVariant: 'select',
      },
      minSize: 90
    },
    {
      accessorKey: 'description',
      header: 'Description',
      meta: {
        filterVariant: 'text',
      },
      minSize: 215
    },
    {
      id: 'price',
      header: 'Price',
      accessorKey: 'price',
      cell: ({ row }: ProductRow) => {
        return row.original.displayPrice
      },
      meta: {
        filterVariant: 'text',
      },
      maxSize: 80,
    },
    {
      id: 'quantity',
      header: 'Qty',
      accessorKey: 'quantity',
      meta: {
        filterVariant: 'range',
      },
      cell: ({ row }: ProductRow) => {
        return row.original.displayQuantity
      },
      maxSize: 50,
    },
    {
      id: 'uom',
      header: 'Unit',
      accessorKey: 'uom',
      meta: {
        filterVariant: 'select',
      },
      maxSize: 50,
    }
  ]
}

export default function SearchPanel() {
  const columnFilterFns = useState<ColumnFiltersState>([])

  return (
    <>

      <SearchPanelTable
        columnFilterFns={columnFilterFns}
        columns={columns()}
        getRowCanExpand={() => true}
        renderVariants={SearchResultVariants}
      />
    </>
  )
}
