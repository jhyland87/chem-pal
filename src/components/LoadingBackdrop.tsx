import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Fade from "@mui/material/Fade";
import BenzeneBlueSpinner from "./icons/BenzeneBlueSpinner";
import "./LoadingBackdrop.scss";

/**
 * Props for the LoadingBackdrop component
 * @param {boolean} open - Whether the backdrop is visible
 * @param {Function} onClick - Function to call when the stop button is clicked
 */
type LoadingBackdropProps = {
  open: boolean;
  onClick: () => void;
};

/**
 * LoadingBackdrop component that displays a full-screen loading overlay with a spinner and stop button.
 * The spinner fades in with a delay when the backdrop is opened.
 *
 * @component
 *
 * @param {LoadingBackdropProps} props - Component props
 * @param {boolean} props.open - Whether the backdrop is visible
 * @param {Function} props.onClick - Function to call when the stop button is clicked
 *
 * @example
 * ```tsx
 * <LoadingBackdrop open={isLoading} onClick={handleStopLoading} />
 * ```
 *
 * @todo Try to implement a <Suspense/> component instead of a manual loading state
 * @todo Add some timer that shows the Stop Search only after a second or two
 */
export default function LoadingBackdrop(props: LoadingBackdropProps) {
  // @todo: Try to implement a <Suspense/> component instead of a manual loading state
  // @todo: add some timer that shows the Stop Search only after a second or two.
  return (
    <Backdrop open={props.open} id="loading-backdrop">
      <Box className="loading-backdrop-box">
        <Box className="spinner-box">
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
        <Button className="status-button" onClick={props.onClick}>
          {props.open ? "Stop loading" : "Loading"}
        </Button>
      </Box>
    </Backdrop>
  );
}
