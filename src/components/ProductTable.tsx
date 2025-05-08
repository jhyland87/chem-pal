import './ProductTable.css'
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import FilledInput from '@mui/material/FilledInput';
import LinearProgress from '@mui/material/LinearProgress';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import React, { ChangeEvent, useState, useEffect } from 'react';
//import { TableVirtuoso, TableComponents } from 'react-virtuoso';
import Options from './Options';
import { IProduct } from '../types'
import SupplierFactory from '../supplier_factory';
import LoadingBackdrop from './LoadingBackdrop';
import { useSettings } from '../context';
import storageMock from '../chrome_storage_mock'
if (!chrome.storage) {
  window.chrome = {
    storage: storageMock as any,
  } as any;
}

let fetchController: AbortController;

// When the user clicks on a link in the table
const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
  // Stop the form from propagating
  event.preventDefault();
  // Get the target
  const target = event.target as HTMLAnchorElement;
  // Open a new tab to that targets href
  chrome.tabs.create({ url: target.href, active: false });
};

// Callback to display the link of the product in the table
const showLink = (params: GridRenderCellParams<any, any, any>) => {
  return (<Link onClick={handleClick} href={params.row.url}>{params.row.title}</Link>);
};

// Columns of the table
const columns: GridColDef[] = [
  {
    field: 'title', headerName: 'Product', width: 225,
    renderCell: showLink,
  },
  { field: 'supplier', headerName: 'Supplier', width: 125 },
  {
    field: 'price',
    headerName: 'USD',
    type: 'number',
    width: 75,
  },
  {
    field: 'quantity',
    headerName: 'Qty',
    type: 'number',
    description: 'THe quantity for each item',
    width: 75
  },
];

const ProductTable: React.FC = () => {
  const settingsContext = useSettings();
  const [products, setProducts] = useState<IProduct[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 5,
    page: 0,
  });

  //const fetchController = new AbortController();

  // On component load, populate the products from storage if there is any.
  // If there are products to list, then also update the pagination if it
  // is saved
  useEffect(() => {
    chrome.storage.local.get(['products', 'paginationModel'])
      .then(data => {
        const storedProducts = data.products || [];
        const storedPaginationModel = data.paginationModel

        if (!storedProducts) {
          setStatusLabel('Type a product name and hit enter')
          return
        }

        setProducts(Array.isArray(storedProducts) ? storedProducts : []);
        setStatusLabel('')

        if (storedPaginationModel)
          setPaginationModel(storedPaginationModel)
      })
  }, []);

  // Update the table whenever the products update
  useEffect(() => { // Use effect will execute a callback action whenever a dependency changes
    chrome.storage.local.set({ products }) // <-- This is the effect/action
      .then(() => {
        if (!products.length) {
          setStatusLabel(isLoading ? `Searching for ${query}...` : 'Type a product name and hit enter')
          return
        }

        setStatusLabel('')
      })

    chrome.storage.local.set({ paginationModel })
  }, [products, paginationModel]); // <-- this is the dependency

  // When the user hits [enter] to submit a search
  const handleQuerySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    // Stop form from propagating
    e.preventDefault();
    if (!query.trim()) return;
    // Show the progress bar
    setIsLoading(true)
    // Set the status label to "Searching..."
    setStatusLabel("Searching...")
    // Abort controller specific to this query
    fetchController = new AbortController();
    // Create the query instance
    // Note: This does not actually run the HTTP calls or queries...
    const productQueryResults = new SupplierFactory(query, fetchController, settingsContext.settings.suppliers)
    // Clear the products table
    setProducts([])
    // Reset the pagination back to page 0
    setPaginationModel({
      pageSize: 5,
      page: 0,
    })

    const startSearchTime = performance.now();
    let resultCount = 0;
    // Use the async generator to iterate over the products
    // This is where the queries get run, when the iteration starts.
    for await (const result of productQueryResults) {
      resultCount++
      // Data for new row (must align with columns structure)
      const newProduct: IProduct = {
        supplier: result?.supplier,
        title: result?.title,
        price: result?.price,
        quantity: result?.quantity,
        url: result?.url
      };
      // Hide the status label thing
      setStatusLabel('')
      // Add each product to the table.
      setProducts((prevProducts) => [...prevProducts, {
        // Each row needs a unique ID, so use the row count at each insertion
        // as the ID value
        id: prevProducts.length, ...newProduct
      }]);
    }
    const endSearchTime = performance.now();
    const searchTime = endSearchTime - startSearchTime;

    // Clear the query input
    setQuery('');
    // Hide the loading thingy
    setIsLoading(false)

    console.debug(`Found ${resultCount} products in ${searchTime} milliseconds`);
  };

  const handleStopSearch = () => {
    // Stop the form from propagating
    //event.preventDefault();
    console.log('triggering abort..')

    setIsLoading(false)

    fetchController.abort()

    setStatusLabel(products.length === 0 ? 'Search aborted' : '')
  };

  return (
    <>
      <Paper sx={{ minHeight: '369px', width: '100%', padding: '0px' }}>
        <Box
          className="search-input-container fullwidth"
          onSubmit={handleQuerySubmit}
          component="form"
          sx={{ '& > :not(style)': { m: 0 } }}
          noValidate
          autoComplete="off" >
          {isLoading
            ? (<LinearProgress className="search-progress-bar" />)
            : (<FilledInput
              fullWidth
              id="search-input"
              className="fullwidth"
              size="small"
              inputProps={{ 'aria-label': 'description' }}
              value={query}
              placeholder="Search..."
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setQuery(event.target.value);
              }} />
            )
          }
        </Box>
        <LoadingBackdrop open={isLoading} onClick={handleStopSearch} />
        {products && products.length > 0
          ? (<DataGrid
            rows={products}
            columns={columns}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[5, 10]}
            sx={{
              border: 0,
              '& .MuiDataGrid-footerContainer': {
                justifyContent: 'center'
              },
              '& .MuiTablePagination-root': {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }
            }} />)
          : statusLabel}
      </Paper>
      <Options setProducts={setProducts} />
    </>
  );
};

export default ProductTable;