import {
  Fragment,
  MouseEvent,
  useState,
  ChangeEvent,
  ReactElement,
  useReducer,
  useEffect,
  Dispatch,
  SetStateAction,
  useMemo
} from 'react'

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
  TableBody,
  TableCell,
  TableSortLabel,
  ListItemIcon,
  ListItemText,
  Collapse,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

import {
  Checklist as ChecklistIcon,
  Done as DoneIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  CheckBox as CheckBoxIcon,
  Clear as ClearIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  ArrowDropUp as ArrowDropUpIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Checklist,
} from '@mui/icons-material';

import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  RowData,
  flexRender,
  getExpandedRowModel,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  OnChangeFn,
  Row,
  filterFns
} from '@tanstack/react-table'

import {
  ProductTableProps,
  Product,
  EnhancedTableToolbarProps,
  ProductRow
} from '../types';

import SearchInput from './SearchInput';
import DebouncedInput from './Debounce';
import SearchTablePagination from './SearchTablePagination';
import SearchTableHeader from './SearchTableHeader'
import SearchResultVariants from './SearchResultVariants';
import { useSettings } from '../context';

import SupplierFactory from '../suppliers/supplier_factory';
import LoadingBackdrop from './LoadingBackdrop';

let fetchController: AbortController;

const ITEM_HEIGHT = 48;


function EnhancedTableToolbar({ table, searchInput, setSearchInput }: EnhancedTableToolbarProps) {
  const settingsContext = useSettings();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  //const [searchInput, setSearchInput] = useState<string>('');
  //const [searchResults, setSearchResults] = useState<Product[]>([]);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    console.debug('[handleClick] event.target', event.target);
    console.debug('[handleClick] settingsContext', settingsContext.settings);
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleToggleAllColumns = (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked = typeof settingsContext.settings.showAllColumns === 'boolean'
      ? settingsContext.settings.showAllColumns
      : event.target.checked

    settingsContext.setSettings({
      ...settingsContext.settings,
      showAllColumns: !isChecked
    });
  };

  return (
    <Toolbar
      sx={[
        {
          pl: { sm: 2 },
          pr: { xs: 1, sm: 1 },
        }
      ]}>
      <Typography
        sx={{ flex: '1 1 100%' }}
        //variant='h6'
        id='tableTitle'
        component='div'
      >
        <SearchInput searchInput={searchInput} setSearchInput={setSearchInput} />
      </Typography>
      <Tooltip title='Filter list'>
        <IconButton
          size='small'
          aria-label='more'
          id='filter-button'
          aria-controls={open ? 'long-menu' : undefined}
          aria-expanded={open ? 'true' : undefined}
          aria-haspopup='true'
          onClick={handleClick}>
          <ChecklistIcon fontSize='small' />
        </IconButton>
      </Tooltip>
      <Menu
        id='long-menu'
        sx={{
          '& .MuiPaper-root': {
            maxHeight: ITEM_HEIGHT * 4.5,
            width: '20ch',
          },
        }}
        aria-labelledby='long-button'
        //</Toolbar>MenuListProps={{'aria-labelledby': 'long-button', }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        variant='selectedMenu'
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            style: {
              maxHeight: ITEM_HEIGHT * 4.5,
              width: '20ch',
            },
          },
        }}>
        <MenuList dense>
          <FormGroup>
            {table.getAllLeafColumns().map((column: Column<any>) => {
              return (
                <div key={column.id} className="px-1" style={{ width: '100%' }}>
                  <FormControlLabel
                    sx={{ width: '100%' }}
                    control={<Checkbox
                      sx={{ margin: 0, padding: '0 1px 0 20px' }}
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                    />}
                    label={column.id}
                  />
                  {/*
                  <label style={{ width: '100%', display: 'block' }}>
                    <input
                      {...{
                        type: 'checkbox',
                        checked: column.getIsVisible(),
                        onChange: column.getToggleVisibilityHandler(),
                      }}
                    />
                    {column.id}
                  </label>
                  */}
                </div >
              )
            })}
            {/*
            {headCells.map((headCell) => (
              columnVisibilityCheckbox(headCell)
            ))}
            */}
            <Divider />
            <MenuItem dense>
              <FormControlLabel
                sx={{ width: '100%' }}
                control={<Checkbox
                  size='small'
                  onChange={handleToggleAllColumns}
                  aria-label='Toggle All Columns'
                  sx={{ margin: 0, padding: 0 }}
                  icon={<CloseIcon fontSize='small' />}
                  checkedIcon={<DoneIcon fontSize='small' />}
                />}
                label={settingsContext.settings.showAllColumns ? 'Hide all' : 'Show all'}
              />
            </MenuItem>
          </FormGroup >
        </MenuList >
      </Menu >
    </Toolbar >
  );
}

function Table({
  columns,
  renderVariants,
  getRowCanExpand,
  columnFilterFns
}: ProductTableProps<Product>): ReactElement {
  const settingsContext = useSettings();
  //const [data, setData] = useState<Product[]>([]);
  //const refreshData = () => setData(_old => makeData(50_000)) //stress test
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  async function executeSearch(query: string) {
    //return Promise.resolve([])
    if (!query.trim()) {
      //setSearchResults(searchResults)
      return
    }
    console.debug('[executeSearch] query', query);
    setSearchResults([])

    //return Promise.resolve([])
    // Abort controller specific to this query
    fetchController = new AbortController();
    // Create the query instance
    // Note: This does not actually run the HTTP calls or queries...
    const productQueryResults = new SupplierFactory(query, fetchController, settingsContext.settings.suppliers)
    // Clear the products table
    setSearchResults([])

    const startSearchTime = performance.now();
    let resultCount = 0;
    // Use the async generator to iterate over the products
    // This is where the queries get run, when the iteration starts.
    for await (const result of productQueryResults) {
      resultCount++
      // Data for new row (must align with columns structure)

      // Hide the status label thing
      // Add each product to the table.
      console.debug('newProduct:', result)

      setSearchResults((prevProducts) => [...prevProducts, {
        // Each row needs a unique ID, so use the row count at each insertion
        // as the ID value
        id: prevProducts.length, ...result as Product
      }]);
    }
    const endSearchTime = performance.now();
    const searchTime = endSearchTime - startSearchTime;

    console.debug(`Found ${resultCount} products in ${searchTime} milliseconds`);

    return searchResults
  }

  useEffect(() => {
    executeSearch(searchInput).then(console.log).catch(console.error);
  }, [searchInput]);

  const table = useReactTable({
    data: searchResults,
    enableColumnResizing: true,
    defaultColumn: {
      minSize: 60,
      maxSize: 800,
    },
    columnResizeMode: 'onChange',
    columns: columns as ColumnDef<Product, any>[],
    filterFns: {},
    state: {
      columnFilters: columnFilterFns[0],
    },
    onColumnFiltersChange: columnFilterFns[1],
    getRowCanExpand: (row: Row<Product>) => getRowCanExpand(row),
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(), //client side filtering
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: true,
    debugHeaders: true,
    debugColumns: false,
  })

  // Need to un-memoize this since memo is obsolete in React 19
  /*
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders()
    const colSizes: { [key: string]: number } = {}
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!
      colSizes[`--header-${header.id}-size`] = header.getSize()
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize()
    }
    return colSizes
  }, [table.getState().columnSizingInfo, table.getState().columnSizing])
  */

  function columnSizeVars() {
    const headers = table.getFlatHeaders()
    const colSizes: { [key: string]: number } = {}
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!
      colSizes[`--header-${header.id}-size`] = header.getSize()
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize()
    }
    console.log('[columnSizeVars] colSizes', colSizes)
    return colSizes
  }

  return (
    <>
      <Paper sx={{ minHeight: '369px', width: '100%', padding: '0px' }}>
        <Box
          className='search-input-container fullwidth'
          //onSubmit={handleQuerySubmit}
          component='form'
          sx={{ '& > :not(style)': { m: 0 } }}
          noValidate
          autoComplete='off' />
        <div className="p-2">
          <EnhancedTableToolbar table={table} searchInput={searchInput} setSearchInput={setSearchInput} />
          <div className="h-4" />
          <table style={{
            ...columnSizeVars()
          }}>
            <SearchTableHeader table={table} />
            <tbody>
              {table.getRowModel().rows.map(row => {
                return (
                  <Fragment key={row.id}>
                    <tr>
                      {/*foo*/}
                      {row.getVisibleCells().map(cell => {
                        return (
                          <td key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    {row.getIsExpanded() && (
                      <tr>
                        {/* 2nd row is a custom 1 cell row */}
                        <td colSpan={row.getVisibleCells().length}>
                          {renderVariants({ row: row as Row<Product> })}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <div className="h-2" />
          <SearchTablePagination table={table} />
          {/*
          <pre>
            {JSON.stringify(
              { columnFilters: table.getState().columnFilters },
              null,
              2
            )}
          </pre>
          */}
        </div>
      </Paper>
    </>
  )
}

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
              ? <ExpandMoreIcon fontSize='small' />
              : <ExpandLessIcon fontSize='small' />}
          </IconButton>
        ) : (
          '🔵'
        )
      },
    },
    {
      accessorKey: 'title',
      header: () => <span>Title</span>,
      cell: ({ row }: ProductRow) => {
        //console.log('[cell] row', row);
        return row.original.title
      },
      meta: {
        filterVariant: 'text',
      },
      maxSize: 200,
    },
    {
      id: 'supplier',
      header: () => <span>Supplier</span>,
      accessorKey: 'supplier',
      //accessorFn: row => row.supplier,
      cell: info => info.getValue(),
      meta: {
        filterVariant: 'text',
      },
      maxSize: 150
    },
    {
      accessorKey: 'description',
      header: 'Description',
      meta: {
        filterVariant: 'text',
      },
      maxSize: 200
    },
    {
      id: 'price',
      header: 'Price',
      accessorKey: 'price',
      //accessorFn: row => `${row.currencySymbol} ${row.price}`,
      //cell: info => info.getValue(),
      meta: {
        filterVariant: 'text',
      },
      maxSize: 80,
    },
    {
      id: 'quantity',
      header: 'Qty',
      accessorKey: 'quantity',
      //header: () => 'Qty',
      meta: {
        filterVariant: 'range',
      },
      maxSize: 50,
    },
    {
      id: 'uom',
      header: 'uom',
      accessorKey: 'uom',
      //header: () => <span>Visits</span>,
      meta: {
        filterVariant: 'select',
      },
      maxSize: 50,
    }
  ]
}

export default function TanStackTable() {
  //const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const columnFilterFns = useState<ColumnFiltersState>([])

  return (
    <Table
      columnFilterFns={columnFilterFns}
      //refreshData={refreshData}
      //data={data}
      columns={columns()}
      getRowCanExpand={() => true}
      renderVariants={SearchResultVariants}
    />
  )
}
