import { PANEL } from '@/constants/common';
import { useAppContext } from '@/context';
import { i18n } from '@/helpers/i18n';
import {
  matchPercentageSortingFn,
  priceSortingFn,
  puritySortingFn,
  quantitySortingFn,
  unitPriceSortingFn,
} from '@/helpers/sorting';
import { formatTimestamp, generatePageSizes } from '@/helpers/utils';
import { getAllPriceSeries } from '@/utils/idbCache';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import { FormControl, IconButton, Link, MenuItem, TableRow, Typography } from '@mui/material';
import {
  type ColumnDef,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { FC, useEffect, useMemo, useState } from 'react';
import ArrowDropDownIcon from '../../icons/ArrowDropDownIcon';
import ArrowDropUpIcon from '../../icons/ArrowDropUpIcon';
import { formatUsd, PriceTrend } from '../SearchPanel/PriceTrendGraph';
import {
  BackButton,
  EmptyStateCell,
  HeaderCellContent,
  NavigationContainer,
  PageSizeContainer,
  PageSizeSelect,
  PaginationContainer,
  SearchResultsTable,
  SortableTableHeaderCell,
  SortIndicator,
  StyledTableBody,
  StyledTableCell,
  StyledTableHead,
  StyledTableRow,
} from '../StyledComponents';
import styles from './PriceHistoryPanel.module.scss';
import { buildPriceChangeRows, type PriceChangeRow } from './priceHistoryRows';
import { Logger } from '@/utils/Logger';

const logger = new Logger('PriceHistoryPanel');

/**
 * Stand-in for the `multiSelect`/`includeHierarchy`/`inNumberRangeHierarchy`
 * filter ids that `SortingFns`/`FilterFns` (augmented project-wide in
 * `src/types/tanstack.d.ts` for the results table) make required on every
 * `useReactTable()` call. No column in this panel sets a `filterFn` to one of
 * these ids, so it's never actually invoked.
 * @returns Always `true`.
 * @source
 */
const unusedFilterFn: FilterFn<PriceChangeRow> = () => true;

/**
 * Full-panel, sortable log of every price change ChemPal has ever recorded
 * across every supplier and product — one row per change, newest first by
 * default. Only available in advanced mode; wired up the same way as
 * `StatsPanel`: a `PANEL.PRICE_HISTORY` entry in the app's panel switch,
 * reached from the speed-dial menu, hidden the moment advanced mode turns off.
 *
 * Reads the full `price_history` IndexedDB store via {@link getAllPriceSeries}
 * and flattens it with `buildPriceChangeRows` — series with only one
 * recorded price (never changed) contribute no rows, so this view answers
 * "which products actually do have price changes logged".
 * @category Components
 * @example
 * ```tsx
 * <PriceHistoryPanel />
 * ```
 * @source
 */
const PriceHistoryPanel: FC = () => {
  const appContext = useAppContext();
  const [rows, setRows] = useState<PriceChangeRow[]>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'changedAt', desc: true }]);

  useEffect(() => {
    const loadRows = async () => {
      try {
        const entries = await getAllPriceSeries();
        setRows(buildPriceChangeRows(entries));
      } catch (error) {
        logger.warn('Failed to load price history', error);
      }
    };
    void loadRows();
  }, []);

  const userSettings = appContext.userSettings;

  const columns = useMemo<ColumnDef<PriceChangeRow, unknown>[]>(
    () => [
      {
        id: 'changedAt',
        header: i18n('price_history_panel_col_date'),
        accessorFn: (row) => row.changedAt,
        cell: ({ getValue }) => formatTimestamp(getValue<number>()),
        size: 150,
      },
      {
        id: 'supplier',
        header: i18n('column_supplier'),
        accessorKey: 'supplier',
        size: 140,
      },
      {
        id: 'title',
        header: i18n('column_title'),
        accessorKey: 'title',
        cell: ({ row }) =>
          row.original.permalink ? (
            <Link href={row.original.permalink} target="_blank" rel="noopener noreferrer">
              {row.original.title}
            </Link>
          ) : (
            row.original.title
          ),
        size: 260,
      },
      {
        id: 'oldPriceUsd',
        header: i18n('price_history_panel_col_old_price'),
        accessorFn: (row) => row.oldPriceUsd,
        cell: ({ getValue }) => formatUsd(getValue<number>(), userSettings),
        size: 110,
      },
      {
        id: 'newPriceUsd',
        header: i18n('price_history_panel_col_new_price'),
        accessorFn: (row) => row.newPriceUsd,
        cell: ({ getValue }) => formatUsd(getValue<number>(), userSettings),
        size: 110,
      },
      {
        id: 'change',
        header: i18n('column_price_change'),
        accessorFn: (row) => row.pctChange,
        cell: ({ row }) => (
          <PriceTrend
            points={[
              { t: row.original.changedAt - 1, usd: row.original.oldPriceUsd },
              { t: row.original.changedAt, usd: row.original.newPriceUsd },
            ]}
            userSettings={userSettings}
          />
        ),
        size: 150,
      },
    ],
    [userSettings],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
    // Required by the project-wide `SortingFns`/`FilterFns` augmentation (see
    // `unusedFilterFn`); none of these ids are used by this panel's columns.
    sortingFns: {
      matchPercentage: matchPercentageSortingFn,
      priceSortingFn,
      puritySortingFn,
      quantitySortingFn,
      unitPriceSortingFn,
    },
    filterFns: {
      multiSelect: unusedFilterFn,
      includeHierarchy: unusedFilterFn,
      inNumberRangeHierarchy: unusedFilterFn,
    },
  });

  const totalRowCount = rows.length;

  return (
    <div className={styles['price-history-panel']}>
      <div className={styles['price-history-panel__top-header']}>
        <div className={styles['header-left']}>
          {appContext.setPanel && (
            <BackButton
              onClick={() => appContext.setPanel!(PANEL.SEARCH_HOME)}
              size="small"
              aria-label={i18n('common_back_to_search')}
            >
              <ArrowBackIcon />
            </BackButton>
          )}
          <Typography variant="subtitle2">{i18n('price_history_panel_title')}</Typography>
        </div>
      </div>

      <div className={styles['price-history-panel__content']}>
        <SearchResultsTable>
          <StyledTableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <SortableTableHeaderCell
                    key={header.id}
                    canSort={header.column.getCanSort()}
                    cellWidth={header.getSize()}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <HeaderCellContent>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <SortIndicator>
                          {
                            {
                              asc: <ArrowDropUpIcon />,
                              desc: <ArrowDropDownIcon />,
                            }[String(header.column.getIsSorted())]
                          }
                        </SortIndicator>
                      )}
                    </HeaderCellContent>
                  </SortableTableHeaderCell>
                ))}
              </TableRow>
            ))}
          </StyledTableHead>
          <StyledTableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <StyledTableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <StyledTableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </StyledTableCell>
                  ))}
                </StyledTableRow>
              ))
            ) : (
              <TableRow>
                <EmptyStateCell colSpan={columns.length}>
                  {i18n('price_history_panel_empty')}
                </EmptyStateCell>
              </TableRow>
            )}
          </StyledTableBody>
        </SearchResultsTable>

        {totalRowCount > 10 && (
          <PaginationContainer>
            <PageSizeContainer>
              <Typography variant="body2">{i18n('results_show')}:</Typography>
              <FormControl size="small">
                <PageSizeSelect
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                  aria-label={i18n('results_rows_per_page_aria')}
                >
                  {generatePageSizes(totalRowCount, 10, 5).map((pageSize) => (
                    <MenuItem key={pageSize} value={pageSize}>
                      {pageSize === totalRowCount ? i18n('results_all') : pageSize}
                    </MenuItem>
                  ))}
                </PageSizeSelect>
              </FormControl>
              <Typography variant="body2">{i18n('results_rows')}</Typography>
            </PageSizeContainer>

            <Typography variant="body2">
              {i18n('results_page_of_total', [
                String(table.getState().pagination.pageIndex + 1),
                String(table.getPageCount()),
              ])}{' '}
              {i18n('results_total', [String(totalRowCount)])}
            </Typography>

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
      </div>
    </div>
  );
};

export default PriceHistoryPanel;
