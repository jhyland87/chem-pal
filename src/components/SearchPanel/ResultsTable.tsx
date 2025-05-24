import { useAppContext } from "@/context";
import { implementCustomMethods } from "@/mixins/tanstack";
import { type Product } from "@/types";
import { type ProductTableProps } from "@/types/props";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { type Column, flexRender, type Row } from "@tanstack/react-table";
import { isEmpty } from "lodash";
import { CSSProperties, Fragment, ReactElement, useEffect, useState } from "react";
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
  const [statusLabel, setStatusLabel] = useState<string | boolean>(false);
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
    chrome.storage.session.get(["searchResults"]).then((data) => {
      if (Array.isArray(data.searchResults)) setShowSearchResults(data.searchResults);
    });
  }, [appContext.settings.searchResultUpdateTs]);

  /**
   * Executes the search when the search input changes.
   */
  useEffect(() => {
    executeSearch(searchInput);
  }, [searchInput]);

  /**
   * Updates the search results in storage and updates the timestamp when results change.
   */
  useEffect(() => {
    console.log(searchResults.length + " search results");
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
  }, [searchResults]);

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
          noValidate
          autoComplete="off"
        />
        <div className="p-2" style={{ minHeight: "369px" }}>
          <TableOptions table={table} searchInput={searchInput} setSearchInput={setSearchInput} />
          <div className="h-4" />
          {Array.isArray(showSearchResults) && showSearchResults.length > 0 && (
            <>
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
                                style={
                                  (cell.column.columnDef.meta as { style?: CSSProperties })?.style
                                }
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
            </>
          )}
          {((!isLoading && !Array.isArray(showSearchResults)) ||
            showSearchResults.length === 0) && (
            <div className="text-center p-4">
              <p>{statusLabel || "No results found. Try a different search term."}</p>
            </div>
          )}
        </div>
      </Paper>
    </>
  );
}
