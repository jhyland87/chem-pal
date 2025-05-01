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
  const [paginationModel, setPaginationModel] = useState({
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
    chrome.storage.local.set({ products }) // <-- This is the effect/action
      .then(() => {
        if (!products.length) {
          if (isLoading) {
            setStatusLabel(`Searching for ${query}...`)
          }
          else {
            setStatusLabel('Type a product name and hit enter')
          }
        }
        else {
          setStatusLabel('')
        }
      })

    chrome.storage.local.set({ paginationModel })
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

    const productQueryResults = new CarolinaSupplier<Product>(query, 5);

    // Initialize the supplier to fetch and prepare query results
    await productQueryResults.init();

    // Submit query to supplier module
    //const productQueryResults = await submitQuery(query)

    // Clear the products table
    setProducts([])

    // Reset the pagination back to page 0
    setPaginationModel({
      pageSize: 5,
      page: 0,
    })

    // Use the async generator to iterate over the products
    for await (const result of productQueryResults) {
      console.log('Product:', result);

      // Data for new row (must align with columns structure)
      const newProduct: Product = {
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
    // Clear the query input
    setQuery('');

    // Hide the loading thingy
    setIsLoading(false)
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