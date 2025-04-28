import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import React, { ChangeEvent, useState } from 'react';
import Input from '@mui/material/Input';
import Row from "../components/Row"
import { Product } from '../interfaces'
import CarolinaSupplier from '../suppliers/carolina_supplier';



async function submitQuery(query: string): Promise<any> {
  const supplier = new CarolinaSupplier(query)
  return await supplier.init()
}
const ariaLabel = { 'aria-label': 'description' };

const ProductTable: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query.trim()) return;
    console.log('Query search for:', query)

    const productQueryResults = await submitQuery(query)

    console.debug('productQueryResults:', { productQueryResults })

    if (!productQueryResults) return;

    setProducts([])
    for (let result of productQueryResults) {
      const newProduct: Product = {
        supplier: 'Carolina',
        title: result.title,
        price: result.price,
        quantity: result.quantity,
        url: result.url
      };

      console.log('Adding new product:', newProduct)
      setQuery('');

      setProducts((prevProducts) => [...prevProducts, newProduct]);
    }
  };

  return (
    <div>
      <Box
        onSubmit={handleSubmit}
        component="form"
        sx={{ '& > :not(style)': { m: 1 } }}
        noValidate
        autoComplete="off"
      >
        <Input
          inputProps={ariaLabel}
          value={query}
          placeholder="Search... [enter]"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setQuery(event.target.value);
          }} />
      </Box>
      <TableContainer component={Paper}>
        <Table aria-label="collapsible table" sx={{ minWidth: 650 }} size="small" >
          <TableHead>
            <TableRow>
              <TableCell>Supplier</TableCell>
              <TableCell>Title</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Quantity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((row, index) => (
              <Row key={index} row={row} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default ProductTable;