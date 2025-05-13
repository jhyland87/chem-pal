import { ColumnFiltersState } from "@tanstack/react-table";
import { useState } from "react";
import SearchPanelTable from "./SearchPanelTable";
import SearchResultVariants from "./SearchResultVariants";

export default function SearchPanel() {
  const columnFilterFns = useState<ColumnFiltersState>([]);

  return (
    <>
      <SearchPanelTable
        columnFilterFns={columnFilterFns}
        //columns={SearchPanelTableColumns()}
        getRowCanExpand={() => true}
        renderVariants={SearchResultVariants}
      />
    </>
  );
}
