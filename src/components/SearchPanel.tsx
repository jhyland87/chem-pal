import {
  Fragment,
  MouseEvent,
  useState,
  ChangeEvent,
  ReactElement,
  useEffect
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
} from '@mui/material';

import {
  Search as SearchIcon,
  SearchOff as SearchOffIcon,
  Checklist as ChecklistIcon,
  Done as DoneIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
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
  EnhancedTableToolbarProps,
  ProductRow
} from '../types';

import SearchInput from './SearchInput';
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
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
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

  const handleToggleColumnFilterVisibility = (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked = typeof settingsContext.settings.showColumnFilters === 'boolean'
      ? settingsContext.settings.showColumnFilters
      : event.target.checked

    settingsContext.setSettings({
      ...settingsContext.settings,
      showColumnFilters: !isChecked
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
        <MenuList dense sx={{ paddingTop: '2px' }}>
          <FormGroup>
            <MenuItem dense>
              <FormControlLabel
                sx={{ width: '100%', marginLeft: '0px', marginRight: '0px' }}
                control={<Checkbox
                  size='small'
                  onChange={handleToggleColumnFilterVisibility}
                  aria-label='Show column filters'
                  sx={{ margin: 0, padding: 0 }}
                  icon={<SearchIcon fontSize='small' />}
                  checkedIcon={<SearchOffIcon fontSize='small' />}
                />}
                label={settingsContext.settings.showAllColumns ? 'Hide Filters' : 'Show Filters'}
              />
            </MenuItem>
            <Divider sx={{ marginTop: '4px', marginBottom: '4px' }} />
            {table.getAllLeafColumns().map((column: Column<any>) => {
              return (
                <div key={column.id} className="px-1" style={{ width: '100%' }}>
                  <FormControlLabel
                    sx={{ width: '100%', marginLeft: '0px', marginRight: '0px' }}
                    control={<Checkbox
                      sx={{ margin: 0, padding: '0 1px 0 20px' }}
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                      disabled={!column.getCanHide()}
                    />}
                    label={column.id}
                  />
                </div >
              )
            })}
            <Divider sx={{ marginTop: '4px', marginBottom: '4px' }} />
            <MenuItem dense>
              <FormControlLabel
                sx={{ width: '100%', marginLeft: '0px', marginRight: '0px' }}
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
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  async function executeSearch(query: string) {
    if (!query.trim()) {
      return
    }
    setSearchResults([])

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

  // Stuff to do when the component mounts
  useEffect(() => {
    // Hide the columns that are in the hideColumns array if there are any
    if (settingsContext.settings.hideColumns.length === 0) return;
    table.getAllLeafColumns().map((column: Column<any>) => {
      if (settingsContext.settings.hideColumns.includes(column.id))
        column.toggleVisibility(false)
    })
  }, [])

  function columnSizeVars() {
    const headers = table.getFlatHeaders()
    const colSizes: { [key: string]: number } = {}
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!
      colSizes[`--header-${header.id}-size`] = header.getSize()
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize()
    }
    return colSizes
  }

  return (
    <>
      <Paper sx={{ minHeight: '369px', width: '100%', padding: '0px' }}>
        <Box
          className='search-input-container fullwidth'
          component='form'
          sx={{ '& > :not(style)': { m: 0 } }}
          noValidate
          autoComplete='off' />
        <div className="p-2">
          <EnhancedTableToolbar table={table} searchInput={searchInput} setSearchInput={setSearchInput} />
          <div className="h-4" />
          <table style={{
            ...columnSizeVars(),
            width: '100%'
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
                          <td
                            key={cell.id}
                            // @todo: Find a more sensible solution to this. Should be able to add custom properties
                            // to the meta object.
                            style={(cell.column.columnDef.meta as { style?: React.CSSProperties })?.style}
                          >
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
          {/*JSON.stringify(
            {
              columnSizing: table.getState().columnSizing,
            },
            null,
            2
          )*/}
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
        return row.original.title
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
    <Table
      columnFilterFns={columnFilterFns}
      columns={columns()}
      getRowCanExpand={() => true}
      renderVariants={SearchResultVariants}
    />
  )
}
