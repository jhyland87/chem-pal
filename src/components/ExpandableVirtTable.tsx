import * as React from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import TableSortLabel from '@mui/material/TableSortLabel';
import Paper from '@mui/material/Paper';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import FilterListIcon from '@mui/icons-material/FilterList';
import Check from '@mui/icons-material/Check';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChecklistIcon from '@mui/icons-material/Checklist';
import LibraryAddCheckIcon from '@mui/icons-material/LibraryAddCheck';
import RemoveDoneIcon from '@mui/icons-material/RemoveDone';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DoneIcon from '@mui/icons-material/Done';
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';

import { visuallyHidden } from '@mui/utils';
import OptionsMenu from './OptionsMenu';
import { Divider, ListItemIcon, ListItemText, MenuList, Toolbar, Tooltip } from '@mui/material';
import SearchInput from './SearchInput';
import { Product } from '../types'
//import { alpha } from '@mui/material/styles';
import { useSettings } from '../context';

interface Data {
  id: number;
  name: string;
  supplier: string;
  price: number;
  quantity: number;
  usd: number;
}

type Order = 'asc' | 'desc';

interface HeadCell {
  align?: 'left' | 'right';
  disablePadding: boolean;
  id: keyof Data;
  label: string;
  numeric: boolean;
}

const options = [
  'None',
  'Atria',
  'Callisto',
  'Dione',
  'Ganymede',
  'Hangouts Call',
  'Luna',
  'Oberon',
  'Phobos',
  'Pyxis',
  'Sedna',
  'Titania',
  'Triton',
  'Umbriel',
];

const headCells: readonly HeadCell[] = [
  {
    id: 'name',
    numeric: false,
    disablePadding: true,
    label: 'Name',
    align: 'left',
  },
  {
    id: 'supplier',
    numeric: false,
    disablePadding: false,
    label: 'Supplier',
    align: 'left',
  },
  {
    id: 'price',
    numeric: true,
    disablePadding: false,
    label: 'Price',
  },
  {
    id: 'usd',
    numeric: true,
    disablePadding: false,
    label: 'USD',
  },
  {
    id: 'quantity',
    numeric: true,
    disablePadding: false,
    label: 'Quantity',
  },
];
const ITEM_HEIGHT = 48;

function createData(
  id: number,
  name: string,
  supplier: string,
  price: number,
  currencyCode: string,
  currencySymbol: string,
  usd: number,
  quantity: number,
  unit: string,
) {
  return {
    id,
    name,
    supplier,
    price,
    currencyCode,
    currencySymbol,
    usd,
    quantity,
    unit,
    variants: [
      {
        date: '2020-01-05',
        customerId: '11091700',
        amount: 3,
      },
      {
        date: '2020-01-02',
        customerId: 'Anonymous',
        amount: 1,
      },
    ],
  };
}

function Row(props: { row: ReturnType<typeof createData> }) {
  const { row } = props;
  console.log('row', row);
  const [open, setOpen] = React.useState(false);
  const getHeader = (name: string) => headCells.find(hc => hc.id == name);
  const getAlign = (name: string) => getHeader(name)?.align ? getHeader(name)?.align : getHeader(name)?.numeric ? 'right' : 'left';
  return (
    <React.Fragment>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell >
          <IconButton
            aria-label='expand row'
            size='small'
            onClick={() => setOpen(!open)}
          >
            {open
              ? <KeyboardArrowUpIcon fontSize='inherit' />
              : <KeyboardArrowDownIcon fontSize='inherit' />}
          </IconButton>
        </TableCell>
        <TableCell component='th' scope='row'>
          {row.name}
        </TableCell>
        <TableCell align={getAlign(row.name)}>{row.supplier}</TableCell>
        <TableCell align={getAlign(row.name)}>{row.currencySymbol}{row.price}</TableCell>
        <TableCell align={getAlign(row.name)}>${row.usd}</TableCell>
        <TableCell align={getAlign(row.name)}>{row.quantity} {row.unit}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ padding: '0' }} colSpan={6}>
          <Collapse in={open} timeout='auto' unmountOnExit>
            <Box sx={{ margin: 1, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
              <Typography variant='h6' gutterBottom component='div'>
                Variants
              </Typography>
              <Table aria-label='purchases' size='small' sx={{ bgcolor: 'primary.light', color: 'primary.contrastText', padding: 0 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>Date</TableCell>
                    <TableCell sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>Customer</TableCell>
                    <TableCell sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }} align='right'>Amount</TableCell>
                    <TableCell sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }} align='right'>Total price ($)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                  {row.variants.map((variantRow) => (
                    <TableRow key={variantRow.date} sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                      <TableCell component='th' scope='row' sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                        {variantRow.date}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>{variantRow.customerId}</TableCell>
                      <TableCell align='right' sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>{variantRow.amount}</TableCell>
                      <TableCell align='right' sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                        {Math.round(variantRow.amount * row.price * 100) / 100}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
}
function randPrice(): number {
  return parseFloat(Number(Math.random() * 100).toFixed(2))
}

function randNum(): number {
  return parseInt(Number(Math.random() * 1000 / 20).toFixed(1))
}

const rows = [
  createData(1, 'Sodium Borohydride', 'Carolina', randPrice(), 'USD', '$', randPrice(), randNum(), 'kg'),
  createData(1, 'Sodium triacetoxyborohydride', 'Carolina', randPrice(), 'USD', '$', randPrice(), randNum(), 'kg'),
  createData(1, 'Sodium Metal', 'Carolina', randPrice(), 'USD', '$', randPrice(), randNum(), 'kg'),
  createData(1, 'Sodium Hydroxide', 'Carolina', randPrice(), 'USD', '$', randPrice(), randNum(), 'kg'),
  createData(2, 'Sodium Carbonate', 'Carolina', randPrice(), 'USD', '$', randPrice(), randNum(), 'kg'),
  createData(3, 'Sodium bicarbonate', 'Carolina', randPrice(), 'USD', '$', randPrice(), randNum(), 'kg'),
  createData(4, 'Sodium Cyanide', 'Carolina', randPrice(), 'USD', '$', randPrice(), randNum(), 'kg'),
];

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key,
): (
  a: { [key in Key]: number | string },
  b: { [key in Key]: number | string },
) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}


function EnhancedTableToolbar() {
  const settingsContext = useSettings();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    console.debug('[handleClick] event.target', event.target);
    console.debug('[handleClick] settingsContext', settingsContext.settings);
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleToggleColumn = (label: string, isChecked: boolean) => {
    console.debug('[handleToggleColumn] Toggling column', { label, isChecked });

    console.debug('[handleToggleColumn] BEFORE settingsContext.settings.showColumns', settingsContext.settings.showColumns);
    const newShowColumns = settingsContext.settings.showColumns.includes(label)
      ? settingsContext.settings.showColumns.filter(column => column !== label)
      : [...settingsContext.settings.showColumns, label];

    settingsContext.setSettings({
      ...settingsContext.settings,
      showColumns: newShowColumns
    });

    console.debug('[handleToggleColumn] AFTER settingsContext.settings.showColumns', settingsContext.settings.showColumns);
  }
  const columnVisibilityCheckbox = (column: HeadCell) => {
    return (
      <MenuItem sx={{ margin: 0, padding: 0 }} key={column.id} dense>
        <Checkbox
          disabled={settingsContext.settings.showAllColumns}
          checked={settingsContext.settings.showAllColumns === true
            || settingsContext.settings.showColumns
            && settingsContext.settings.showColumns.includes(column.id)}
          onChange={(event) => handleToggleColumn(column.id, event.target.checked)}
          aria-label={`${column.label} column visibility`}
          icon={<CheckBoxOutlineBlankIcon fontSize='small' />}
          checkedIcon={<CheckBoxIcon fontSize='small' />}
        />
        {column.label}
      </MenuItem>
    )
    /*return (
      <FormControlLabel
        control={<Checkbox defaultChecked />}
        label={label}
        sx={{ margin: 0, padding: 0 }} />
    )
    return (
      <MenuItem sx={{ margin: 0 }} dense>
        <ListItemIcon >
          {isChecked && <Check fontSize='small' />}
        </ListItemIcon>
        {label}
      </MenuItem>
    )*/
  }

  const handleToggleAllColumns = (event: React.ChangeEvent<HTMLInputElement>) => {
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
          aria-haspopup="true"
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
            {headCells.map((headCell) => (
              columnVisibilityCheckbox(headCell)
            ))}
          </FormGroup>
          <Divider />
          <MenuItem sx={{ margin: 0, padding: 0 }} dense>
            <Checkbox
              onChange={handleToggleAllColumns}
              aria-label='Checkbox demo'
              icon={<CloseIcon fontSize='small' />}
              checkedIcon={<DoneIcon fontSize='small' />}
            />
            {settingsContext.settings.showAllColumns ? 'Hide all' : 'Show all'}
          </MenuItem>
        </MenuList>
      </Menu>
    </Toolbar>
  );
}

function EnhancedTableHead(props: any) {
  const { order, orderBy, numSelected, rowCount, onRequestSort } = props;
  const createSortHandler =
    (property: keyof Data) => (event: React.MouseEvent<unknown>) => {
      onRequestSort(event, property);
    };

  return (
    <TableHead>
      <TableRow>
        <TableCell />
        {headCells.map((headCell) => (
          <TableCell
            key={headCell.id}
            align={headCell.align ? headCell.align : headCell.numeric ? 'right' : 'left'}
            padding={headCell.disablePadding ? 'none' : 'normal'}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            {headCell.label}
            <TableSortLabel
              hideSortIcon={false}
              IconComponent={KeyboardArrowDownIcon}
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : 'asc'}
              onClick={createSortHandler(headCell.id)}>
              {orderBy === headCell.id ? (
                <Box component='span' sx={visuallyHidden}>
                  {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                </Box>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}

      </TableRow>
    </TableHead>
  );
}

export default function CollapsibleTable() {
  const [order, setOrder] = React.useState<Order>('asc');
  const [orderBy, setOrderBy] = React.useState<keyof Data>('price');
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(100);
  const [products, setProducts] = React.useState<Product[]>([]);


  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: keyof Data,
  ) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 100));
    setPage(0);
  };


  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0;

  const visibleRows = React.useMemo(
    () =>
      [...rows]
        .sort(getComparator(order, orderBy))
        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [order, orderBy, page, rowsPerPage],
  );

  return (
    <>
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <EnhancedTableToolbar />
        <TableContainer sx={{ maxHeight: 440 }}>
          <Table stickyHeader aria-label='collapsible table' size='small'>
            <EnhancedTableHead
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
              rowCount={rows.length}
            />
            <TableBody>
              {visibleRows.map((row) => (
                <Row key={row.name} row={row} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <OptionsMenu setProducts={setProducts} />
    </>
  );
}