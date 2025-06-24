import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableHead,
  TableRow,
  IconButton,
  Typography,



  MenuItem,
  FormControl,
  Checkbox,
  FormControlLabel,
  Menu,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  FilterList as FilterListIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ViewColumn as ViewColumnIcon,
} from '@mui/icons-material';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  type ExpandedState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useTheme } from '../themes';
import { ThemeSwitcher } from './ThemeSwitcher';
import { type ProductResult } from '../utils/mockData';
import {
  ResultsContainer,
  ResultsHeader,
  HeaderLeft,
  HeaderSearchField,
  ResultsPaper,
  ResultsTitle,
  StyledTableRow,
  StyledTableCell,
  DescriptionText,
  CompactExpandButton,
  FixedThemeSwitcher,
  HeaderRight,
  ProductCellContainer,
  ProductTypography,
  CellTypography,
  PriceTypography,
  AvailabilityTypography,
  SortableTableHeaderCell,
  FilterTableCell,
  FilterTextField,
  SubRowTableRow,
  EmptyStateCell,
  PaginationContainer,
  PageSizeContainer,
  PageSizeSelect,
  NavigationContainer,
  ColumnMenuItemContainer,
  FilterIconButton,
  ColoredIconButton,
  BackIconButton,
} from './StyledComponents';

interface ResultsPageProps {
  results: ProductResult[];
  searchQuery: string;
  onNewSearch: (query: string) => void;
  onDrawerToggle: () => void;
}

const columnHelper = createColumnHelper<ProductResult>();

const ResultsPage: React.FC<ResultsPageProps> = ({
  results,
  searchQuery,
  onNewSearch,
  onDrawerToggle,
}) => {
  const [query, setQuery] = useState(searchQuery);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    shipping: false,
    country: false,
    quantity: false,
  });
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const navigate = useNavigate();
  const { currentPalette } = useTheme();

  const columns = [
    columnHelper.display({
      id: 'expander',
      header: '',
      cell: ({ row }) => {
        console.log('Row data:', row.original.product, 'Has subRows:', row.subRows?.length > 0, 'Is expanded:', row.getIsExpanded());

        return row.getCanExpand() ? (
          <CompactExpandButton
            onClick={(e) => {
              e.stopPropagation();
              console.log('Expand button clicked for:', row.original.product);
              row.toggleExpanded();
            }}
          >
            {row.getIsExpanded() ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </CompactExpandButton>
        ) : null;
      },
      size: 24,
      enableSorting: false,
    }),
    columnHelper.accessor('product', {
      header: 'Product',
            cell: ({ row, getValue }) => (
        <ProductCellContainer depth={row.depth}>
          <ProductTypography variant="body2">
            {getValue()}
          </ProductTypography>
        </ProductCellContainer>
      ),
      size: 200,
    }),
    columnHelper.accessor('supplier', {
      header: 'Supplier',
      cell: (info) => (
        <CellTypography variant="body2">
          {info.getValue()}
        </CellTypography>
      ),
      size: 150,
    }),
    columnHelper.accessor('price', {
      header: 'Price',
      cell: (info) => (
        <PriceTypography variant="body2">
          {info.getValue()}
        </PriceTypography>
      ),
      size: 100,
    }),
    columnHelper.accessor('availability', {
      header: 'Availability',
      cell: (info) => {
        const value = info.getValue();
        const color = value === 'In Stock' ? 'success.main' :
                     value === 'Limited Stock' ? 'warning.main' : 'error.main';
        return (
          <AvailabilityTypography variant="body2" availabilityColor={color}>
            {value}
          </AvailabilityTypography>
        );
      },
      size: 120,
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: (info) => (
        <DescriptionText variant="body2">
          {info.getValue()}
        </DescriptionText>
      ),
      size: 250,
    }),
    columnHelper.accessor('shipping', {
      header: 'Shipping',
      cell: (info) => (
        <CellTypography variant="body2">
          {info.getValue()}
        </CellTypography>
      ),
      size: 120,
    }),
    columnHelper.accessor('country', {
      header: 'Country',
      cell: (info) => (
        <CellTypography variant="body2">
          {info.getValue()}
        </CellTypography>
      ),
      size: 80,
    }),
    columnHelper.accessor('quantity', {
      header: 'Quantity',
      cell: (info) => (
        <CellTypography variant="body2">
          {info.getValue()}
        </CellTypography>
      ),
      size: 100,
    }),
  ];

  const table = useReactTable({
    data: results,
    columns,
    state: {
      sorting,
      columnFilters,
      pagination,
      expanded,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.subRows,
    enableExpanding: true,
  });

  const handleSearch = () => {
    if (query.trim()) {
      onNewSearch(query.trim());
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  return (
    <ResultsContainer>
      {/* Theme Switcher - Bottom Right */}
      <FixedThemeSwitcher>
        <ThemeSwitcher />
      </FixedThemeSwitcher>

      <ResultsHeader>
        <HeaderLeft>
          <BackIconButton onClick={handleBack} size="small" iconColor={currentPalette.text}>
            <ArrowBackIcon />
          </BackIconButton>
          <HeaderSearchField
            size="small"
            variant="outlined"
            placeholder="Search for products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            InputProps={{
              endAdornment: (
                <IconButton onClick={handleSearch} size="small">
                  <SearchIcon />
                </IconButton>
              ),
            }}
          />
        </HeaderLeft>
        <HeaderRight>
          <FilterIconButton
            onClick={toggleFilters}
            size="small"
            isActive={showFilters}
            activeColor={currentPalette.notificationBg}
            textColor={currentPalette.text}
          >
            <FilterListIcon />
          </FilterIconButton>
          <ColoredIconButton
            onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
            size="small"
            iconColor={currentPalette.text}
          >
            <ViewColumnIcon />
          </ColoredIconButton>
          <ColoredIconButton onClick={onDrawerToggle} size="small" iconColor={currentPalette.text}>
            <SettingsIcon />
          </ColoredIconButton>
        </HeaderRight>
      </ResultsHeader>

      <ResultsTitle variant="h6">
        Search Results for "{searchQuery}" ({results.length} found)
      </ResultsTitle>

      <ResultsPaper>
        <Table>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <SortableTableHeaderCell
                    key={header.id}
                    canSort={header.column.getCanSort()}
                    cellWidth={header.getSize()}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </SortableTableHeaderCell>
                ))}
              </TableRow>
            ))}
            {/* Filter Row */}
            {showFilters && table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={`${headerGroup.id}-filters`}>
                {headerGroup.headers.map((header) => (
                  <FilterTableCell
                    key={`${header.id}-filter`}
                    cellWidth={header.getSize()}
                  >
                    {header.column.getCanFilter() ? (
                                            <FilterTextField
                        size="small"
                        variant="outlined"
                        placeholder={`Search...`}
                        value={(header.column.getFilterValue() as string) ?? ''}
                        onChange={(e) => header.column.setFilterValue(e.target.value)}
                      />
                      ) : null}
                    </FilterTableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <SubRowTableRow
                  key={row.id}
                  isSubRow={row.depth > 0}
                >
                  {row.getVisibleCells().map((cell) => (
                    <StyledTableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </StyledTableCell>
                                      ))}
                </SubRowTableRow>
              ))
            ) : (
              <StyledTableRow>
                <EmptyStateCell
                  colSpan={table.getAllColumns().length}
                >
                  {!searchQuery.trim()
                    ? "No search query"
                    : columnFilters.length > 0
                      ? "No results matching your filter values"
                      : "No results found"
                  }
                </EmptyStateCell>
              </StyledTableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls - Only show if more than 1 page */}
        {table.getPageCount() > 1 && (
          <PaginationContainer>
            {/* Page Size Selector */}
            <PageSizeContainer>
              <Typography variant="body2">Show:</Typography>
              <FormControl size="small">
                <PageSizeSelect
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                >
                  {[5, 10, 20, 50].map((pageSize) => (
                    <MenuItem key={pageSize} value={pageSize}>
                      {pageSize}
                    </MenuItem>
                  ))}
                </PageSizeSelect>
              </FormControl>
              <Typography variant="body2">rows</Typography>
            </PageSizeContainer>

            {/* Page Info */}
            <Typography variant="body2">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              ({table.getFilteredRowModel().rows.length} total results)
            </Typography>

            {/* Navigation Buttons */}
            <NavigationContainer>
              <IconButton
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                size="small"
              >
                <FirstPageIcon />
              </IconButton>
              <IconButton
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                size="small"
              >
                <ChevronLeftIcon />
              </IconButton>
              <IconButton
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                size="small"
              >
                <ChevronRightIcon />
              </IconButton>
              <IconButton
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                size="small"
              >
                <LastPageIcon />
              </IconButton>
            </NavigationContainer>
          </PaginationContainer>
        )}
      </ResultsPaper>

      {/* Column Visibility Menu */}
      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={() => setColumnMenuAnchor(null)}
      >
        {table.getAllLeafColumns()
          .filter(column => column.getCanHide())
          .map(column => (
            <ColumnMenuItemContainer key={column.id}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                  />
                }
                label={
                  <ListItemText
                    primary={column.columnDef.header as string || column.id}
                  />
                }
              />
            </ColumnMenuItemContainer>
          ))}
      </Menu>
    </ResultsContainer>
  );
};

export default ResultsPage;