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
import { useAppContext } from "../../context";
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

const getProductsTest = async (query: string) => {
  const response = await fetch("https://www.biofuranchem.com?scope=wix-one-app", {
    method: "HEAD",
    credentials: "include", // or 'same-origin'
  });

  for (const p of response.headers) {
    console.log("HEADER:", p);
  }

  /*

  const data = await fetch(
    "https://www.biofuranchem.com/_api/wix-ecommerce-storefront-web/api?o=getFilteredProducts&s=WixStoresWebClient&q=query,getFilteredProductsWithHasDiscount($mainCollectionId:String!,$filters:ProductFilters,$sort:ProductSort,$offset:Int,$limit:Int,$withOptions:Boolean,=,false,$withPriceRange:Boolean,=,false){catalog{category(categoryId:$mainCollectionId){numOfProducts,productsWithMetaData(filters:$filters,limit:$limit,sort:$sort,offset:$offset,onlyVisible:true){totalCount,list{id,options{id,key,title,@include(if:$withOptions),optionType,@include(if:$withOptions),selections,@include(if:$withOptions){id,value,description,key,inStock,visible,linkedMediaItems{url,fullUrl,thumbnailFullUrl:fullUrl(width:50,height:50),mediaType,width,height,index,title,videoFiles{url,width,height,format,quality}}}}productItems,@include(if:$withOptions){id,optionsSelections,price,comparePrice,formattedPrice,formattedComparePrice,hasDiscount,availableForPreOrder,isTrackingInventory,inventory{status,quantity}isVisible,pricePerUnit,formattedPricePerUnit,preOrderInfo{limit,message}}customTextFields(limit:1){title}productType,ribbon,price,comparePrice,sku,isInStock,urlPart,formattedComparePrice,formattedPrice,pricePerUnit,formattedPricePerUnit,pricePerUnitData{baseQuantity,baseMeasurementUnit}itemDiscount{discountRuleName,priceAfterDiscount}digitalProductFileItems{fileType}name,media{url,fullUrl,index,width,mediaType,altText,title,height}isManageProductItems,productItemsPreOrderAvailability,isTrackingInventory,inventory{status,quantity,availableForPreOrder,preOrderInfoView{limit}}subscriptionPlans{list{id,visible}}priceRange(withSubscriptionPriceRange:true),@include(if:$withPriceRange){fromPriceFormatted}discount{mode,value}}}}}}&v=%7B%22mainCollectionId%22%3A%2200000000-000000-000000-000000000001%22%2C%22offset%22%3A0%2C%22limit%22%3A" +
      10 +
      "%2C%22sort%22%3Anull%2C%22filters%22%3Anull%2C%22withOptions%22%3Atrue%2C%22withPriceRange%22%3Afalse%7D",
    {
      headers: {
        Referer: "https://www.biofuranchem.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );

  const productsJson = await data.json();
  console.log("productsJson:", productsJson);
  */

  const tokens = await fetch("https://www.biofuranchem.com/_api/v1/access-tokens", {
    method: "GET",
    credentials: "include", // or 'same-origin'
  });

  const tokenResponse = await tokens.json();

  console.log("tokenResponse:", tokenResponse);
  console.log(
    "Token instance:",
    tokenResponse.apps["1380b703-ce81-ff05-f115-39571d94dfcd"].instance,
  );

  const url = new URL("https://www.biofuranchem.com/_api/wix-ecommerce-storefront-web/api");

  url.searchParams.append("o", "getFilteredProducts");
  url.searchParams.append("s", "WixStoresWebClient");
  url.searchParams.append(
    "q",
    "query,getFilteredProductsWithHasDiscount($mainCollectionId:String!,$filters:ProductFilters,$sort:ProductSort,$offset:Int,$limit:Int,$withOptions:Boolean,=,false,$withPriceRange:Boolean,=,false){catalog{category(categoryId:$mainCollectionId){numOfProducts,productsWithMetaData(filters:$filters,limit:$limit,sort:$sort,offset:$offset,onlyVisible:true){totalCount,list{id,options{id,key,title,@include(if:$withOptions),optionType,@include(if:$withOptions),selections,@include(if:$withOptions){id,value,description,key,inStock}}productItems,@include(if:$withOptions){id,optionsSelections,price,formattedPrice}productType,price,sku,isInStock,urlPart,formattedPrice,name,description,brand,priceRange(withSubscriptionPriceRange:true),@include(if:$withPriceRange){fromPriceFormatted}}}}}}",
  );
  url.searchParams.append(
    "v",
    `{"mainCollectionId":"00000000-000000-000000-000000000001","offset":0,"limit":10,"sort":null,"filters":{"term":{"field":"name","op":"CONTAINS","values":["*acid*"]}},"withOptions":true,"withPriceRange":false}`,
  );

  console.log("URL:", url.toString());
  const productReq = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: tokenResponse.apps["1380b703-ce81-ff05-f115-39571d94dfcd"].instance,
    },
  });

  const productResponse = await productReq.json();

  console.log("productResponse:", productResponse);
};
/**
 * ResultsTable component that displays search results in a table format with filtering,
 * sorting, and pagination capabilities. It also handles the search execution and
 * manages the loading state.
 *
 * @component
 *
 * @param {ProductTableProps<Product>} props - Component props
 * @param {Function} props.renderVariants - Function to render variant details
 * @param {Function} props.getRowCanExpand - Function to determine if a row can be expanded
 * @param {[ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>]} props.columnFilterFns - Column filter state and setter
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
    console.log("Search result timestamp was updated", appContext.settings.searchResultUpdateTs);

    chrome.storage.session.get(["searchResults"]).then((data) => {
      console.log("New search results", data.searchResults);
      setShowSearchResults(data.searchResults);
    });
  }, [appContext.settings.searchResultUpdateTs]);

  /**
   * Handles stopping the current search operation.
   */
  const handleStopSearch = () => {
    console.debug("triggering abort..");
    setIsLoading(false);
    fetchController.abort();
    setStatusLabel(searchResults.length === 0 ? "Search aborted" : "");
  };

  /**
   * Executes a search query and processes the results.
   * @param {string} query - The search query to execute
   * @returns {Promise<Product[]>} The search results
   */
  async function executeSearch(query: string) {
    if (!query.trim()) {
      return;
    }
    getProductsTest(query);
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
    return searchResults;
  }

  /**
   * Executes the search when the search input changes.
   */
  useEffect(() => {
    executeSearch(searchInput).then(console.log).catch(console.error);
  }, [searchInput]);

  /**
   * Updates the search results in storage and updates the timestamp when results change.
   */
  useEffect(() => {
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
   */
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
