import { type ColumnFiltersState } from "@tanstack/react-table";
import { useState } from "react";
import DetailsContainer from "./DetailsContainer";
import ResultsTableV19 from "./ResultsTableV19";

/**
 * SearchPanel component that serves as the main container for search functionality.
 * It manages the search results table and details container, handling column filtering
 * and row expansion.
 *
 * @component
 * @example
 * ```tsx
 * <SearchPanel />
 * ```
 */
export default function SearchPanel() {
  const columnFilterFns = useState<ColumnFiltersState>([]);

  return (
    <>
      <ResultsTableV19
        columnFilterFns={columnFilterFns}
        getRowCanExpand={() => true}
        renderVariants={DetailsContainer}
      />
    </>
  );
}
