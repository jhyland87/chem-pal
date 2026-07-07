import { i18n } from "@/helpers/i18n";
import { BenzeneBlueIcon } from "@/icons";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconSpinner from "./IconSpinner";
import styles from "./LoadingBackdrop.module.scss";

/**
 * Format the results/loading text based on the abort state and number of
 * results accumulated thus far.
 * @param props - The props for the loading backdrop.
 * @returns The formatted results text.
 */
function formatResultsText(props: LoadingBackdropProps): string {
  if (props.isAborting) {
    return i18n("aborting_search");
  }
  if (!props.resultCount) {
    return i18n("loading_search");
  }
  if (props.resultCount === 1) {
    return i18n("found_result_single", [String(props.resultCount)]);
  }
  if (props.supplierResultsCount === 1) {
    return i18n("found_results_one_supplier", [
      String(props.resultCount),
      String(props.supplierResultsCount),
    ]);
  }
  return i18n("found_results_many_suppliers", [
    String(props.resultCount),
    String(props.supplierResultsCount),
  ]);
}

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
  return (
    <>
      <Backdrop open={props.open} id="loading-backdrop" role="status" aria-label="search loading">
        <Box className={styles["loading-backdrop-box"]}>
          <Box className={styles["spinner-box"]}>
            <IconSpinner>
              <BenzeneBlueIcon sx={{ width: 80, height: 80 }} />
            </IconSpinner>
          </Box>
          <span className={styles["status-text"]}>{formatResultsText(props)}</span>
          <Button
            className={styles["abort-button"]}
            onClick={props.onClick}
            disabled={props.isAborting}
          >
            {i18n("cancel_search")}
          </Button>
        </Box>
      </Backdrop>
    </>
  );
}
