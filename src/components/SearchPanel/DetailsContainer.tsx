import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { gen, sample } from "testcheck";
import styles from "./DetailsContainer.module.scss";

/**
 * Generator for creating sample product details with random values.
 * Used for testing and development purposes.
 *
 * @source
 */
const detailsGen = gen.object({
  title: gen.alphaNumString,
  description: gen.alphaNumString,
  price: gen.int,
  quantity: gen.int,
});

/**
 * Sample product details generated using the detailsGen generator.
 * Used for testing and development purposes.
 *
 * @source
 */
const details = sample(detailsGen);

/**
 * DetailsContainer component that displays detailed information about a product row.
 * Currently uses sample data for testing purposes.
 *
 * @component
 * @param props - Component props
 * @example
 * ```tsx
 * <DetailsContainer row={row} />
 * ```
 * @todo Replace sample data with actual product details from the row data
 * @source
 */
export default function DetailsContainer({ row }: ProductRow) {
  console.log("row", { row });
  return (
    <TableContainer component={Paper} className={`${styles.fullwidth} ${styles['search-result-details-container']}`}>
      <Table size="small" aria-label="a dense table" className={`${styles.fullwidth} ${styles['result-details-table']}`}>
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
              <TableCell component="th" scope="row" className={styles.title}>
                {detail.title}
              </TableCell>
              <TableCell className={styles.description}>{detail.description}</TableCell>
              <TableCell className={styles.price}>{detail.price}</TableCell>
              <TableCell className={styles.quantity}>{detail.quantity}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
