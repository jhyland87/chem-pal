import { BenzeneBlueIcon } from "@/icons";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconSpinner from "./IconSpinner";
import styles from "./LoadingBackdrop.module.scss";

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
 * @source
 */
export default function LoadingBackdrop(props: LoadingBackdropProps) {
  const supplierCount = props.supplierResultsCount;
  const supplierLabel = supplierCount === 1 ? "supplier" : "suppliers";
  const supplierSuffix = supplierCount > 0 ? ` from ${supplierCount} ${supplierLabel}` : "";

  const statusText = props.isAborting
    ? "Aborting..."
    : props.resultCount === 0
      ? "Loading..."
      : `Found ${props.resultCount} results${supplierSuffix}...`;

  return (
    <>
      <Backdrop open={props.open} id="loading-backdrop" role="status" aria-label="search loading">
        <Box className={styles["loading-backdrop-box"]}>
          <Box className={styles["spinner-box"]}>
            <IconSpinner>
              <BenzeneBlueIcon sx={{ width: 80, height: 80 }} />
            </IconSpinner>
          </Box>
          <span className={styles["status-text"]}>{statusText}</span>
          <Button
            className={styles["abort-button"]}
            onClick={props.onClick}
            disabled={props.isAborting}
          >
            Cancel search
          </Button>
        </Box>
      </Backdrop>
    </>
  );
}
