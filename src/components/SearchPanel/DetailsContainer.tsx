import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { gen, sample } from "testcheck";
import { ProductRow } from "../../types";
import "./DetailsContainer.scss";

const detailsGen = gen.object({
  title: gen.alphaNumString,
  description: gen.alphaNumString,
  price: gen.int,
  quantity: gen.int,
});

const details = sample(detailsGen);

export default function DetailsContainer({ row }: ProductRow) {
  console.log("row", { row });
  return (
    <TableContainer component={Paper} className="fullwidth search-result-details-container">
      <Table size="small" aria-label="a dense table" className="fullwidth result-details-table">
        <TableHead sx={{ bgcolor: "background.default" }}>
          <TableRow>
            <TableCell>Title</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Price</TableCell>
            <TableCell>Quantity</TableCell>
          </TableRow>
        </TableHead>
        <TableBody sx={{ bgcolor: "background.paper" }}>
          {details.map((detail) => (
            <TableRow key={detail.title}>
              <TableCell component="th" scope="row" className="title">
                {detail.title}
              </TableCell>
              <TableCell className="description">{detail.description}</TableCell>
              <TableCell className="price">{detail.price}</TableCell>
              <TableCell className="quantity">{detail.quantity}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
