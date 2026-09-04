import { i18n } from '@/helpers/i18n';
import { useCallback, useState } from 'react';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
 * Edge length of the rendered molecule. Larger than the 128px cube it replaces — the
 * overlay has the room, and a structure needs it to stay legible.
 * @source
 */
const MOLECULE_SIZE = 168;

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
 * The graphic is the molecule being searched for, fetched from PubChem and slowly rotated
 * (see {@link MoleculeSpinner}). Until it resolves — and for any query PubChem has no
 * structure for — the generic spinning cubane loader is shown instead.
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
  const [hasMolecule, setHasMolecule] = useState(false);

  // Stable identity: MoleculeSpinner is memoized, and this component re-renders on
  // every result-count tick.
  const handleStatusChange = useCallback((status: MoleculeSpinnerStatus) => {
    setHasMolecule(status.state === 'ready');
  }, []);

  const stackClass = hasMolecule
    ? `${styles['spinner-stack']} ${styles['has-molecule']}`
    : styles['spinner-stack'];

  return (
    <>
      <Backdrop
        open={props.open}
        id="loading-backdrop"
        role="status"
        aria-label={i18n('loading_aria')}
      >
        <Box className={styles['loading-backdrop-box']}>
          <Box className={stackClass}>
            <Box className={styles['spinner-box']}>
              <MoleculeSpinner
                query={props.query ?? ''}
                size={MOLECULE_SIZE}
                fallback={CUBE_FALLBACK}
                onStatusChange={handleStatusChange}
              />
            </Box>
            <span className={styles['status-text']}>{formatResultsText(props)}</span>
          </Box>
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
