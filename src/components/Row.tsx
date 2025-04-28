import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { Fragment } from 'react';

export default function Row(props: { row: ReturnType<any> }) {
  const { row } = props;
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    chrome.tabs.create({ url: row.url });
  };

  return (
    <Fragment>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell component="th" scope="row">{row.supplier}</TableCell>
        <TableCell>
          <a href="#" onClick={handleClick}>{row.title}</a>
        </TableCell>
        <TableCell align="right">{row.price}</TableCell>
        <TableCell align="right">{row.quantity}</TableCell>
      </TableRow>
    </Fragment>
  );
}