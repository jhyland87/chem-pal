import './ProductTable.css'
import CancelIcon from '@mui/icons-material/Cancel';
import Stack from '@mui/material/Stack';
import Backdrop from '@mui/material/Backdrop';


export default function LoadingBackdrop(props: { open: boolean, onClick: () => void }) {
  // @todo: Try to implement a <Suspense/> component instead of a manual loading state
  return (
    <Backdrop open={props.open} style={{ zIndex: 1 }}>
      <Stack style={{ textAlign: 'center' }}>
        <CancelIcon onClick={props.onClick} sx={{ fontSize: 40 }} style={{ cursor: 'pointer' }} />
      </Stack>
    </Backdrop>
  );
}