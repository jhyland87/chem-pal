import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import "./LoadingBackdrop.scss";

/**
 * A full-screen loading overlay component with a spinning benzene molecule and stop button.
 * The spinner has a delayed fade-in animation when the backdrop is opened.
 *
 * @param props - Component properties containing:
 * - open: Controls the visibility of the backdrop
 * - onClick: Callback function triggered when the stop button is clicked
 * @returns A loading backdrop component
 *
 * @example
 * ```typescript
 * <LoadingBackdrop
 *   open={isLoading}
 *   onClick={handleStopLoading}
 * />
 * ```
 *
 * Future improvements:
 * - Implement a Suspense component instead of manual loading state
 * - Add a timer to show the Stop Search button after a delay
 */
export default function LoadingBackdrop(props: LoadingBackdropProps) {
  return (
    <>
      <Backdrop open={props.open} id="loading-backdrop">
        <Box className="loading-backdrop-box">
          {/*<Box className="spinner-box">
            <IconSpinner>
              <BlueBenzeneIcon sx={{ width: 100, height: 100 }} />
            </IconSpinner>
          </Box>*/}
          <Button className="status-button" onClick={props.onClick}>
            {props.resultCount === 0 ? "Loading..." : `Found ${props.resultCount} results..`}
          </Button>
        </Box>
      </Backdrop>
    </>
  );
}
