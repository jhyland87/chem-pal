import { useAppContext } from "@/context";
import SupplierFactory from "@/suppliers/supplierFactory";
import { type Product } from "@/types";
import { type UseSearchProps } from "@/types/props";
import { getColumnFilterConfig } from "../TableColumns";

export function useSearch({ setSearchResults, setStatusLabel, setIsLoading }: UseSearchProps) {
  const appContext = useAppContext();
  let fetchController: AbortController;

  const handleStopSearch = () => {
    console.debug("triggering abort..");
    setIsLoading(false);
    fetchController.abort();
    setStatusLabel("Search aborted");
  };

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

    const searchLimit = appContext.settings.searchLimit ?? 5;
    // Abort controller specific to this query
    fetchController = new AbortController();
    // Create the query instance
    // Note: This does not actually run the HTTP calls or queries...
    const productQueryResults = new SupplierFactory(
      query,
      searchLimit,
      fetchController,
      appContext.settings.suppliers,
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

    const endSearchTime = performance.now();
    const searchTime = endSearchTime - startSearchTime;
    setIsLoading(false);
    console.debug(`Found ${resultCount} products in ${searchTime} milliseconds`);
  }

  return {
    executeSearch,
    handleStopSearch,
  };
}
