import { i18n } from '@/helpers/i18n';
import { useCallback, useState } from 'react';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { alpha, getContrastRatio, type Theme } from '@mui/material/styles';
import { MoleculeSpinner, type MoleculeSpinnerStatus } from './MoleculeSpinner';
import IconSpinner from './IconSpinner';
import styles from './LoadingBackdrop.module.scss';

/**
 * The generic spinning-cubane graphic, shown until (or unless) the query resolves to a
 * real structure. Built once at module scope so its identity is stable: `MoleculeSpinner`
 * is memoized, and a fresh element on every result-count tick would defeat that.
 * @source
 */
const CUBE_FALLBACK = (
  <IconSpinner>
    <img
      src="/static/images/cubane-loader-noh-thick-blue-320px.png"
      width={128}
      height={128}
      alt=""
    />
  </IconSpinner>
);

/**
 * How opaque the panel is over the dimmed backdrop. High enough that the results table
 * behind it doesn't compete with the status line, low enough to still read as an
 * overlay rather than a second page.
 * @source
 */
const PANEL_OPACITY = 0.92;

/**
 * Palette-driven colors for the overlay panel: the theme's primary as a near-opaque
 * background, and whichever of black/white reads better on it. `color` is set here
 * rather than on the status line so it cascades to everything inside the panel.
 *
 * Neither of MUI's own answers works. `primary.contrastText` is a light grey in the
 * dark theme, against a mid-blue primary (#4299e1) — about 2.2:1. `getContrastText`
 * only falls back to black below a 3:1 ratio, and white on that blue scrapes in at
 * 3.05:1, so it stays white. Picking the larger ratio outright gives white on the light
 * theme's navy (10.5:1) and black on the dark theme's blue (6.9:1).
 * @source
 */
const PANEL_SX = {
  backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, PANEL_OPACITY),
  color: (theme: Theme) => {
    const { common, primary } = theme.palette;
    return getContrastRatio(primary.main, common.white) >=
      getContrastRatio(primary.main, common.black)
      ? common.white
      : common.black;
  },
};

/**
 * Edge length of the rendered molecule. Matches the panel's full width so the graphic
 * covers it edge to edge as a background; the panel clips whatever overflows.
 * @source
 */
const MOLECULE_SIZE = 300;

/**
 * Format the results/loading text based on the abort state and number of
 * results accumulated thus far.
 * @param props - The props for the loading backdrop.
 * @returns The formatted results text.
 */
function formatResultsText(props: LoadingBackdropProps): string {
  if (props.isAborting) {
    return i18n('loading_aborting');
  }
  if (!props.resultCount) {
    return i18n('loading_loading');
  }
  if (props.resultCount === 1) {
    return i18n('loading_found_single', [String(props.resultCount)]);
  }
  if (props.supplierResultsCount === 1) {
    return i18n('loading_found_one_supplier', [
      String(props.resultCount),
      String(props.supplierResultsCount),
    ]);
  }
  return i18n('loading_found_many_suppliers', [
    String(props.resultCount),
    String(props.supplierResultsCount),
  ]);
}

/**
 * A full-screen loading overlay component with a stop button, shown while a search runs.
 *
 * The panel shows the query at the top, then the graphic with the status line laid over it.
 * The graphic is the molecule being searched for, fetched from PubChem and slowly rotated
 * (see {@link MoleculeSpinner}), dimmed so it reads as a backdrop to the text. The three
 * graphic states are mutually exclusive, so one is never swapped for another mid-search:
 * while the structure is still resolving the slot is empty and only the status text shows;
 * once drawn, the molecule holds it; and the generic cubane loader appears only for a query
 * PubChem has no structure for.
 *
 * @param props - Component properties containing:
 * - open: Controls the visibility of the backdrop
 * - query: The query being searched for, depicted as a rotating molecule when resolvable
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
  const [noStructure, setNoStructure] = useState(false);

  // Stable identity: MoleculeSpinner is memoized, and this component re-renders on
  // every result-count tick.
  const handleStatusChange = useCallback((status: MoleculeSpinnerStatus) => {
    setNoStructure(status.state === 'unavailable');
  }, []);

  // Derived from the query itself rather than the callback, so a search that will show a
  // molecule never renders a cube frame first. The cube is only for queries that have
  // settled with nothing to draw.
  //
  // Nothing is rendered in the graphic slot while resolving — no `pending` node — so the
  // panel sits tight around the status line and then grows once the structure arrives.
  const query = (props.query ?? '').trim();
  const showCube = query === '' || noStructure;

  const spinnerBoxClass = showCube
    ? styles['spinner-box']
    : `${styles['spinner-box']} ${styles['as-backdrop']}`;

  return (
    <>
      <Backdrop
        open={props.open}
        id="loading-backdrop"
        role="status"
        aria-label={i18n('loading_aria')}
      >
        <Box className={styles['loading-backdrop-box']} sx={PANEL_SX}>
          {query !== '' && (
            <span className={styles['query-text']} title={query}>
              {query}
            </span>
          )}
          <Box className={spinnerBoxClass}>
            <MoleculeSpinner
              query={query}
              size={MOLECULE_SIZE}
              fallback={CUBE_FALLBACK}
              onStatusChange={handleStatusChange}
            />
          </Box>
          <span className={styles['status-text']}>{formatResultsText(props)}</span>
          <Button
            className={styles['abort-button']}
            onClick={props.onClick}
            disabled={props.isAborting}
          >
            {i18n('loading_cancel')}
          </Button>
        </Box>
      </Backdrop>
    </>
  );
}
