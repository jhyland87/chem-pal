import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { Column, flexRender, Row } from "@tanstack/react-table";
import { isEmpty } from "lodash";
import { CSSProperties, Fragment, ReactElement, useEffect, useState } from "react";
import { type ProductTableProps } from "types/props";
import { type Product } from "types/types";
import { useAppContext } from "../../context";
import { implementCustomMethods } from "../../utils/tanstack";
import LoadingBackdrop from "../LoadingBackdrop";
import { useResultsTable } from "./hooks/useResultsTable";
import { useSearch } from "./hooks/useSearch";
import Pagination from "./Pagination";
import "./ResultsTable.scss";
import TableHeader from "./TableHeader";
import TableOptions from "./TableOptions";

/**
 * ResultsTable component that displays search results in a table format with filtering,
 * sorting, and pagination capabilities. It also handles the search execution and
 * manages the loading state.
 *
 * @component
 *
 * @example
 * ```tsx
 * <ResultsTable
 *   renderVariants={DetailsContainer}
 *   getRowCanExpand={() => true}
 *   columnFilterFns={[filters, setFilters]}
 * />
 * ```
 */
export default function ResultsTable({
  renderVariants,
  getRowCanExpand,
  columnFilterFns,
}: ProductTableProps<Product>): ReactElement {
  const appContext = useAppContext();
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearchResults, setShowSearchResults] = useState<Product[]>([]);
  const [, setStatusLabel] = useState<string | boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { executeSearch, handleStopSearch } = useSearch({
    setSearchResults,
    setStatusLabel,
    setIsLoading,
  });

  /**
   * Initializes the table by loading saved search results and column visibility settings.
   */
  useEffect(() => {
    if (!isEmpty(appContext.settings.hideColumns)) {
      table.getAllLeafColumns().map((column: Column<Product>) => {
        if (appContext.settings.hideColumns.includes(column.id)) column.toggleVisibility(false);
      });
    }
    chrome.storage.session.get(["searchResults", "paginationModel"]).then((data) => {
      const storedSearchResults = data.searchResults || [];

      if (!storedSearchResults) {
        setStatusLabel("Type a product name and hit enter");
        return;
      }

      setSearchResults(Array.isArray(storedSearchResults) ? storedSearchResults : []);
      setStatusLabel("");
    });
  }, []);

  /**
   * Updates the displayed search results when the search result timestamp changes.
   */
  useEffect(() => {
    //console.log("Search result timestamp was updated", appContext.settings.searchResultUpdateTs);

    chrome.storage.session.get(["searchResults"]).then((data) => {
      //console.log("New search results", data.searchResults);
      setShowSearchResults(data.searchResults as Product[]);
    });
  }, [appContext.settings.searchResultUpdateTs]);

  /**
   * Executes the search when the search input changes.
   */
  useEffect(() => {
    executeSearch(searchInput); //.then(console.log).catch(console.error);
  }, [searchInput]);

  /**
   * Updates the search results in storage and updates the timestamp when results change.
   */
  useEffect(() => {
    console.log(searchResults.length + " search results");
    // Not sure i'm happy with how I'm handling the search result update sequence.
    // May need to refactor later.
    chrome.storage.session.set({ searchResults }).then(() => {
      if (!searchResults.length) {
        setStatusLabel(
          isLoading ? `Searching for ${searchInput}...` : "Type a product name and hit enter",
        );
        return;
      }

      appContext.setSettings({
        ...appContext.settings,
        searchResultUpdateTs: new Date().toISOString(),
      });
    });
  }, [searchResults]); // <-- this is the dependency

  /**
   * Logs search results updates for debugging.

  useEffect(() => {
    console.debug("searchResults UPDATED:", searchResults);
  }, [searchResults]);
 */
  const table = useResultsTable({
    showSearchResults,
    columnFilterFns,
    getRowCanExpand,
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
      <LoadingBackdrop
        open={isLoading}
        resultCount={searchResults.length}
        onClick={handleStopSearch}
      />
      <Paper id="search-results-table-container">
        <Box
          className="search-input-container fullwidth"
          component="form"
          //sx={{ "& > :not(style)": { m: 0 } }}
          noValidate
          autoComplete="off"
        />
        <div className="p-2" style={{ minHeight: "369px" }}>
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
