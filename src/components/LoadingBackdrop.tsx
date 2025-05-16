import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Fade from "@mui/material/Fade";
import BenzeneBlueSpinner from "./icons/BenzeneBlueSpinner";
import "./SearchPanel/SearchPanel.css";

export default function LoadingBackdrop(props: { open: boolean; onClick: () => void }) {
  // @todo: Try to implement a <Suspense/> component instead of a manual loading state
  // @todo: add some timer that shows the Stop Search only after a second or two.
  return (
    <Backdrop open={props.open} style={{ zIndex: 1 }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box sx={{ height: 40 }}>
          <Fade
            in={props.open}
            style={{
              transitionDelay: props.open ? "800ms" : "0ms",
            }}
            unmountOnExit
          >
            <BenzeneBlueSpinner size={100} />
          </Fade>
        </Box>
        <Button
          onClick={props.onClick}
          sx={{ m: 2 }}
          style={{ backgroundColor: "#386181", color: "white", fontWeight: "bold" }}
        >
          {props.open ? "Stop loading" : "Loading"}
        </Button>
      </Box>
    </Backdrop>
  );
}
