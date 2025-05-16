import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { gen, sample } from "testcheck";
import { ProductRow } from "../../types";

const detailsGen = gen.object({
  title: gen.alphaNumString,
  description: gen.alphaNumString,
  price: gen.int,
  quantity: gen.int,
});

const rows = sample(detailsGen);

export default function DetailsContainer({ row }: ProductRow) {
  return (
    <TableContainer component={Paper}>
      <Table sx={{ width: "100%" }} size="small" aria-label="a dense table">
        <TableHead sx={{ bgcolor: "background.default" }}>
          <TableRow>
            <TableCell align="center">Title</TableCell>
            <TableCell align="center">Description</TableCell>
            <TableCell align="center">Price</TableCell>
            <TableCell align="center">Quantity</TableCell>
          </TableRow>
        </TableHead>
        <TableBody sx={{ bgcolor: "background.paper" }}>
          {rows.map((row) => (
            <TableRow key={row.title} sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
              <TableCell component="th" scope="row" align="left">
                {row.title}
              </TableCell>
              <TableCell align="left">{row.description}</TableCell>
              <TableCell align="center">{row.price}</TableCell>
              <TableCell align="center">{row.quantity}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
