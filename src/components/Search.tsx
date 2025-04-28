import Box from '@mui/material/Box';
import Input from '@mui/material/Input';
import { ChangeEvent, useState } from "react";
import CarolinaSupplier from '../suppliers/carolina_supplier';

const ariaLabel = { 'aria-label': 'description' };

async function queryProducts(query: string) {
  try {
    return new CarolinaSupplier(query)
  }
  catch (err) {
    console.error('ERROR querying products:', err)
  }
}

export default function Search() {
  const [query, setQuery] = useState('');

  async function formAction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const productQueryResults = await queryProducts(query)
    console.debug('productQueryResults:', { productQueryResults })
  }

  return (
    <Box
      component="form"
      sx={{ '& > :not(style)': { m: 1 } }}
      noValidate
      autoComplete="off"
      onSubmit={formAction}
    >
      <Input
        inputProps={ariaLabel}
        value={query}
        placeholder="Search... [enter]"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setQuery(event.target.value);
        }} />
    </Box>
  );
}