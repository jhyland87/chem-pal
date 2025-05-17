import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import {
  Column,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  useReactTable,
} from "@tanstack/react-table";
import { isEmpty } from "lodash";
import { CSSProperties, Fragment, ReactElement, useEffect, useState } from "react";
import { useSettings } from "../../context";
import SupplierFactory from "../../suppliers/SupplierFactory";
import { Product, ProductTableProps } from "../../types";
import { implementCustomMethods } from "../../utils/tanstack";
import LoadingBackdrop from "../LoadingBackdrop";
import Pagination from "./Pagination";
import "./ResultsTable.scss";
import TableColumns, { getColumnFilterConfig } from "./TableColumns";
import TableHeader from "./TableHeader";
import TableOptions from "./TableOptions";
let fetchController: AbortController;

export default function ResultsTable({
  renderVariants,
  getRowCanExpand,
  columnFilterFns,
}: ProductTableProps<Product>): ReactElement {
  const settingsContext = useSettings();
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearchResults, setShowSearchResults] = useState<Product[]>([]);
  const [, setStatusLabel] = useState<string | boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isEmpty(settingsContext.settings.hideColumns)) {
      table.getAllLeafColumns().map((column: Column<Product>) => {
        if (settingsContext.settings.hideColumns.includes(column.id))
          column.toggleVisibility(false);
      });
    }
    chrome.storage.local.get(["searchResults", "paginationModel"]).then((data) => {
      const storedSearchResults = data.searchResults || [];

      if (!storedSearchResults) {
        setStatusLabel("Type a product name and hit enter");
        return;
      }

      setSearchResults(Array.isArray(storedSearchResults) ? storedSearchResults : []);
      setStatusLabel("");
    });
  }, []);

  useEffect(() => {
    console.log(
      "Search result timestamp was updated",
      settingsContext.settings.searchResultUpdateTs,
    );

    chrome.storage.local.get(["searchResults"]).then((data) => {
      console.log("New search results", data.searchResults);
      setShowSearchResults(data.searchResults);
    });
  }, [settingsContext.settings.searchResultUpdateTs]);

  const handleStopSearch = () => {
    // Stop the form from propagating
    //event.preventDefault();
    console.debug("triggering abort..");
    setIsLoading(false);
    fetchController.abort();
    setStatusLabel(searchResults.length === 0 ? "Search aborted" : "");
  };

  /*
  function getColumnFilterConfig() {
    const filterableColumns = table.options.columns.reduce<
      Record<string, { filterVariant: string; filterData: unknown[] }>
    >((accu, column: ColumnDef<Product, unknown>) => {
      const meta = column.meta as ColumnMeta | undefined;
      if (meta?.filterVariant === undefined || !column.id) return accu;

      accu[column.id] = {
        filterVariant: meta.filterVariant,
        filterData: [],
      };
      return accu;
    }, {});

    return filterableColumns;
  }
    */

  async function executeSearch(query: string) {
    if (!query.trim()) {
      return;
    }
    setIsLoading(true);

    setSearchResults([]);
    setStatusLabel("Searching...");

    // This stores what type of filter each column has. Well build this object
    // up as we iterate over the columns.
    const columnFilterConfig = getColumnFilterConfig();

    // Abort controller specific to this query
    fetchController = new AbortController();
    // Create the query instance
    // Note: This does not actually run the HTTP calls or queries...
    const productQueryResults = new SupplierFactory(
      query,
      fetchController,
      settingsContext.settings.suppliers,
    );

    // Clear the products table
    setSearchResults([]);

    const startSearchTime = performance.now();
    let resultCount = 0;
    // Use the async generator to iterate over the products
    // This is where the queries get run, when the iteration starts.
    for await (const result of productQueryResults) {
      resultCount++;
      // Data for new row (must align with columns structure)

      // Hide the status label thing
      // Add each product to the table.
      console.debug("newProduct:", result);

      for (const [columnName, columnValue] of Object.entries(result)) {
        if (columnName in columnFilterConfig === false) continue;

        if (columnFilterConfig[columnName].filterVariant === "range") {
          // For range filters, we only want the highest and lowest. So compare the columnValue
          // with the first and second values in the filterData array (being lowest and highest
          // values respectively), updating the values if they are lower or higher.
          if (typeof columnValue !== "number") continue;

          // Skip values that are less than the min value
          if (
            typeof columnFilterConfig[columnName].filterData[0] !== "number" ||
            columnValue < columnFilterConfig[columnName].filterData[0]
          ) {
            columnFilterConfig[columnName].filterData[0] = columnValue;
          } else if (
            typeof columnFilterConfig[columnName].filterData[1] !== "number" ||
            columnValue < columnFilterConfig[columnName].filterData[1]
          ) {
            columnFilterConfig[columnName].filterData[1] = columnValue;
          }
          // TODO: Implement range filter
        } else if (columnFilterConfig[columnName].filterVariant === "select") {
          // For select filters, we only want the unique values, so we verify  the columnValue
          // is not already in the filterData array before adding it.
          if (!columnFilterConfig[columnName].filterData.includes(columnValue)) {
            columnFilterConfig[columnName].filterData.push(columnValue);
          }
        } else if (columnFilterConfig[columnName].filterVariant === "text") {
          // Not sure what the best filter for text values are, but we can just add the unique
          // values for now, maybe we cna use it for an autocomplete feature?..
          if (!columnFilterConfig[columnName].filterData.includes(columnValue)) {
            columnFilterConfig[columnName].filterData.push(columnValue);
          }
        }
      }

      // Hide the status label thing
      setStatusLabel(false);

      setSearchResults((prevProducts) => [
        ...prevProducts,
        {
          // Each row needs a unique ID, so use the row count at each insertion
          // as the ID value
          id: prevProducts.length,
          ...(result as Product),
        },
      ]);
    }

    // Now columnFilterConfig can be used for filtering the results based off of column data.
    //console.log("columnFilterConfig:", columnFilterConfig);

    const endSearchTime = performance.now();
    const searchTime = endSearchTime - startSearchTime;

    setIsLoading(false);

    console.debug(`Found ${resultCount} products in ${searchTime} milliseconds`);

    return searchResults;
  }

  useEffect(() => {
    executeSearch(searchInput).then(console.log).catch(console.error);
  }, [searchInput]);

  useEffect(() => {
    // Not sure i'm happy with how I'm handling the search result update sequence.
    // May need to refactor later.
    chrome.storage.local
      .set({ searchResults }) // <-- This is the effect/action
      .then(() => {
        if (!searchResults.length) {
          setStatusLabel(
            isLoading ? `Searching for ${searchInput}...` : "Type a product name and hit enter",
          );
          return;
        }

        settingsContext.setSettings({
          ...settingsContext.settings,
          searchResultUpdateTs: new Date().toISOString(),
        });
      });
  }, [searchResults]); // <-- this is the dependency

  useEffect(() => {
    console.debug("searchResults UPDATED:", searchResults);
  }, [searchResults]);

  const table = useReactTable({
    data: showSearchResults,
    enableColumnResizing: true,
    defaultColumn: {
      minSize: 60,
      maxSize: 800,
    },
    columnResizeMode: "onChange",
    columns: TableColumns() as ColumnDef<Product, unknown>[],
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
    debugTable: false,
    debugHeaders: false,
    debugColumns: false,
  });

  // Extend columns with getUniqueVisibleValues method
  implementCustomMethods(table);

  function columnSizeVars() {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
  }

  return (
    <>
      <LoadingBackdrop open={isLoading} onClick={handleStopSearch} />
      <Paper id="search-results-table-container">
        <Box
          className="search-input-container fullwidth"
          component="form"
          //sx={{ "& > :not(style)": { m: 0 } }}
          noValidate
          autoComplete="off"
        />
        <div className="p-2">
          <TableOptions table={table} searchInput={searchInput} setSearchInput={setSearchInput} />
          <div className="h-4" />
          <table
            className="search-results"
            style={{
              ...columnSizeVars(),
            }}
          >
            <TableHeader table={table} />
            <tbody>
              {table.getRowModel().rows.map((row) => {
                return (
                  <Fragment key={row.id}>
                    <tr>
                      {row.getVisibleCells().map((cell) => {
                        return (
                          <td
                            key={cell.id}
                            // @todo: Find a more sensible solution to this. Should be able to add custom properties
                            // to the meta object.
                            style={(cell.column.columnDef.meta as { style?: CSSProperties })?.style}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                    {row.getIsExpanded() && (
                      <tr>
                        <td colSpan={row.getVisibleCells().length}>
                          {renderVariants({ row: row as Row<Product> })}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="h-2" />
          <Pagination table={table} />
        </div>
      </Paper>
    </>
  );
}
