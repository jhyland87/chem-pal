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
import { useSettings } from "../context";
import SupplierFactory from "../suppliers/supplier_factory";
import { Product, ProductTableProps } from "../types";
import LoadingBackdrop from "./LoadingBackdrop";
import SearchPanelToolbar from "./SearchPanelToolbar";
import SearchTableHeader from "./SearchTableHeader";
import SearchTablePagination from "./SearchTablePagination";

let fetchController: AbortController;

export default function SearchPanelTable({
  columns,
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

  async function executeSearch(query: string) {
    if (!query.trim()) {
      return;
    }
    setIsLoading(true);

    setSearchResults([]);
    setStatusLabel("Searching...");

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
    columns: columns as ColumnDef<Product, unknown>[],
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
      <Paper sx={{ minHeight: "369px", width: "100%", padding: "0px" }}>
        <Box
          className="search-input-container fullwidth"
          component="form"
          sx={{ "& > :not(style)": { m: 0 } }}
          noValidate
          autoComplete="off"
        />
        <div className="p-2">
          <SearchPanelToolbar
            table={table}
            searchInput={searchInput}
            setSearchInput={setSearchInput}
          />
          <div className="h-4" />
          <table
            style={{
              ...columnSizeVars(),
              width: "100%",
            }}
          >
            <SearchTableHeader table={table} />
            <tbody>
              {table.getRowModel().rows.map((row) => {
                return (
                  <Fragment key={row.id}>
                    <tr>
                      {/*foo*/}
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
                        {/* 2nd row is a custom 1 cell row */}
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
  );
}
