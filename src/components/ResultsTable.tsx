
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Row, createData } from '../components/Row'

const rows = [
  createData('Sulfuric Acid', 159, 6.0, 'Foobar', 'idk'),
];

export default function ResultsTable() {
  return (
    <TableContainer component={Paper}>
      <Table aria-label="collapsible table" sx={{ minWidth: 650 }} size="small" >
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>Name</TableCell>
            <TableCell align="right">Price</TableCell>
            <TableCell align="right">Quantity</TableCell>
            <TableCell align="right">Supplier</TableCell>
            <TableCell align="right">Manufacturer</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <Row key={row.name} row={row} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}