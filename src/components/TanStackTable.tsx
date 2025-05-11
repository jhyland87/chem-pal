import {
  Fragment,
  MouseEvent,
  useState,
  ChangeEvent,
  ReactElement,
  useReducer
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
  Row
} from '@tanstack/react-table'

import SearchInput from './SearchInput';
import DebouncedInput from './Debounce';
import SearchTablePagination from './SearchTablePagination';
import SearchTableHeader from './SearchTableHeader'
import SearchResultVariants from './SearchResultVariants';
import { ProductTableProps } from '../types';
import { makeData, Person } from '../makeData'
import { useSettings } from '../context';

import SupplierFactory from '../suppliers/supplier_factory';
import LoadingBackdrop from './LoadingBackdrop';

const ITEM_HEIGHT = 48;

function EnhancedTableToolbar({ table }: { table: any }) {
  const settingsContext = useSettings();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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
        <SearchInput />
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
                </div>
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
          </FormGroup>
        </MenuList>
      </Menu>
    </Toolbar>
  );
}

function Table({
  data,
  columns,
  renderVariants,
  getRowCanExpand,
  rerender,
  refreshData,
  columnFilterFns
}: ProductTableProps<Person>): ReactElement {
  const table = useReactTable({
    data,
    columns,
    filterFns: {},
    state: {
      columnFilters: columnFilterFns[0],
    },
    onColumnFiltersChange: columnFilterFns[1],
    getRowCanExpand,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(), //client side filtering
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: true,
    debugHeaders: true,
    debugColumns: false,
  })

  console.debug('Table filters', table.getState().columnFilters);


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
          <EnhancedTableToolbar table={table} />
          <div className="h-4" />
          <table>
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
                          {renderVariants({ row })}
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



function columns(): ColumnDef<Person, any>[] {
  return [
    {
      id: 'expander',
      header: () => null,
      cell: ({ row }) => {
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
      accessorKey: 'firstName',
      cell: info => info.getValue(),
    },
    {
      accessorFn: row => row.lastName,
      id: 'lastName',
      cell: info => info.getValue(),
      header: () => <span>Last Name</span>,
    },
    {
      accessorFn: row => `${row.firstName} ${row.lastName}`,
      id: 'fullName',
      header: 'Full Name',
      cell: info => info.getValue(),
    },
    {
      accessorKey: 'age',
      header: () => 'Age',
      meta: {
        filterVariant: 'range',
      },
    },
    {
      accessorKey: 'visits',
      header: () => <span>Visits</span>,
      meta: {
        filterVariant: 'range',
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      meta: {
        filterVariant: 'select',
      },
    },
    {
      accessorKey: 'progress',
      header: 'Profile Progress',
      meta: {
        filterVariant: 'range',
      },
    },
  ]
}

export default function TanStackTable() {
  const rerender = useReducer(() => ({}), {})[1]

  //const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const columnFilterFns = useState<ColumnFiltersState>([])


  const [data, setData] = useState<Person[]>(() => makeData(5_000))
  const refreshData = () => setData(_old => makeData(50_000)) //stress test

  return (
    <Table
      rerender={rerender}
      columnFilterFns={columnFilterFns}
      refreshData={refreshData}
      data={data}
      columns={columns()}
      getRowCanExpand={() => true}
      renderVariants={SearchResultVariants}
    />
  )
}

function Filter({ column }: { column: Column<any, unknown> }) {
  const columnFilterValue = column.getFilterValue()
  const { filterVariant } = column.columnDef.meta ?? {}

  return filterVariant === 'range' ? (
    <div>
      <div className="flex space-x-2">
        {/* See faceted column filters example for min max values functionality */}
        <DebouncedInput
          type="number"
          value={(columnFilterValue as [number, number])?.[0] ?? ''}
          onChange={value =>
            column.setFilterValue((old: [number, number]) => [value, old?.[1]])
          }
          placeholder={`Min`}
          className="w-24 border shadow rounded"
        />
        <DebouncedInput
          type="number"
          value={(columnFilterValue as [number, number])?.[1] ?? ''}
          onChange={value =>
            column.setFilterValue((old: [number, number]) => [old?.[0], value])
          }
          placeholder={`Max`}
          className="w-24 border shadow rounded"
        />
      </div>
      <div className="h-1" />
    </div>
  ) : filterVariant === 'select' ? (
    <select
      onChange={e => column.setFilterValue(e.target.value)}
      value={columnFilterValue?.toString()}
    >
      {/* See faceted column filters example for dynamic select options */}
      <option value="">All</option>
      <option value="complicated">complicated</option>
      <option value="relationship">relationship</option>
      <option value="single">single</option>
    </select>
  ) : (
    <DebouncedInput
      className="w-36 border shadow rounded"
      onChange={value => column.setFilterValue(value)}
      placeholder={`Search...`}
      type="text"
      value={(columnFilterValue ?? '') as string}
    />
    // See faceted column filters example for datalist search suggestions
  )
}

