import { ColumnFiltersState } from "@tanstack/react-table";
import { useState } from "react";
import DetailsContainer from "./DetailsContainer";
import ResultsTable from "./ResultsTable";

export default function SearchPanel() {
  const columnFilterFns = useState<ColumnFiltersState>([]);

  return (
    <>
      <ResultsTable
        columnFilterFns={columnFilterFns}
        getRowCanExpand={() => true}
        renderVariants={DetailsContainer}
      />
    </>
  );
}
