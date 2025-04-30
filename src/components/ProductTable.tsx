import './ProductTable.css'
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import FilledInput from '@mui/material/FilledInput';
import React, { ChangeEvent, useState, useEffect } from 'react';
import LinearProgress from '@mui/material/LinearProgress';
import { Product } from '../interfaces'
import CarolinaSupplier from '../suppliers/carolina_supplier';


// Submits the search query and retrieves the results
async function submitQuery(query: string): Promise<any> {
  const supplier = new CarolinaSupplier(query, 8)
  return await supplier.init()
}

// When the user clicks on a link in the table
const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
  // Stop the form from propagating
  event.preventDefault();
  // Get the target
  const target = event.target as HTMLAnchorElement;
  // Open a new tab to that targets href
  chrome.tabs.create({ url: target.href });
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
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [paginationModel, setPaginationModel] = React.useState({
    pageSize: 5,
    page: 0,
  });

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

        if (storedPaginationModel) {
          setPaginationModel(storedPaginationModel)
        }
      })
  }, []);

  // Update the table whenever the products update
  useEffect(() => { // Use effect will execute a callback action whenever a dependency changes
    chrome.storage.local.set({ products }) // <-- This i the effect/action
      .then(() => {
        if (products.length > 0) {
          setStatusLabel('')
        }
        else {
          setStatusLabel('Type a product name and hit enter')
        }
      })

    chrome.storage.local.set({ paginationModel })


    console.log('Updating values:', { products, paginationModel })
  }, [products, paginationModel]); // <-- this is the dependency



  // When the user hits [enter] to submit a search
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    // Stop form from propagating
    e.preventDefault();
    if (!query.trim()) return;

    // Show the progress bar
    setIsLoading(true)

    // Set the status label to "Searching..."
    setStatusLabel("Searching...")

    // Submit query to supplier module
    const productQueryResults = await submitQuery(query)

    // Clear the query input
    setQuery('');

    // Clear the products table
    setProducts([])

    // Did the query return any results?...
    if (!productQueryResults || !Array.isArray(productQueryResults) || productQueryResults.length === 0) {
      // If not, show that message and hide the progress bar
      setIsLoading(false)
      setStatusLabel(`No search results found for ${query}`)
      return
    };

    // Iterate over the results..
    for (let result of productQueryResults) {

      // Data for new row (must align with columns structure)
      const newProduct: Product = {
        supplier: result.supplier,
        title: result.title,
        price: result.price,
        quantity: result.quantity,
        url: result.url
      };

      // Hide the status label thing
      setStatusLabel('')

      // Add each product to the table.
      setProducts((prevProducts) => [...prevProducts, {
        // Each row needs a unique ID, so use the row count at each insertion
        // as the ID value
        id: prevProducts.length, ...newProduct
      }]);
      // Hide the loading progress bar
      setIsLoading(false)
    }
  };

  const handleClearResults = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Stop the form from propagating
    event.preventDefault();
    setProducts([])
  };

  return (
    <>
      <div id="main-container">
        [<Link onClick={handleClearResults} href="#">Clear</Link>]
        <Paper sx={{ height: 400, width: '100%' }}>
          <Box
            className="search-input-container fullwidth"
            onSubmit={handleSubmit}
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
          {products && products.length > 0
            ? (<DataGrid
              rows={products}
              columns={columns}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pageSizeOptions={[5, 10]}
              sx={{ border: 0 }} />)
            : statusLabel}
        </Paper>
      </div>
    </>
  );
};

export default ProductTable;