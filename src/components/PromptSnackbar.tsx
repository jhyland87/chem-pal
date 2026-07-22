import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import styles from './PromptSnackbar.module.scss';

/**
 * Props for {@link PromptSnackbar}.
 * - `open` - Whether the snackbar is shown.
 * - `message` - The line of copy to display.
 * - `actionLabel` - Text of the primary action button.
 * - `onAction` - Invoked when the primary action is clicked.
 * - `onDismiss` - Invoked when the ✕ is clicked.
 * - `dismissLabel` - Accessible label for the ✕.
 * - `testId` / `actionTestId` / `dismissTestId` - `data-testid`s for the root and
 *   the two controls. Passed explicitly rather than derived, so each caller keeps
 *   the ids its tests already target.
 */
interface PromptSnackbarProps {
  open: boolean;
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
  dismissLabel: string;
  testId: string;
  actionTestId: string;
  dismissTestId: string;
}

/**
 * The bottom-of-screen notice shared by the update prompts: a filled info alert
 * with one action and a ✕.
 *
 * It has no auto-hide timeout — a popup can be open for a second or two, so a
 * timed dismissal would routinely never be seen. It closes only on an explicit
 * action.
 * @component
 * @category Components
 * @param props - The snackbar props (see {@link PromptSnackbarProps}).
 * @returns The rendered snackbar.
 * @example
 * ```tsx
 * <PromptSnackbar
 *   open
 *   message="Chem Pal v1.3.0 is available."
 *   actionLabel="What's new"
 *   onAction={openNotes}
 *   onDismiss={dismiss}
 *   dismissLabel="Dismiss"
 *   testId="update-snackbar"
 * />
 * ```
 * @source
 */
export function PromptSnackbar({
  open,
  message,
  actionLabel,
  onAction,
  onDismiss,
  dismissLabel,
  testId,
  actionTestId,
  dismissTestId,
}: PromptSnackbarProps) {
  return (
    <Snackbar
      data-testid={testId}
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      className={styles['prompt-snackbar']}
    >
      <Alert
        severity="info"
        variant="filled"
        // Alert drops its own close button as soon as `action` is set, so the
        // dismiss control has to be composed in here alongside the CTA.
        action={
          <>
            <Button data-testid={actionTestId} color="inherit" size="small" onClick={onAction}>
              {actionLabel}
            </Button>
            <IconButton
              data-testid={dismissTestId}
              aria-label={dismissLabel}
              color="inherit"
              size="small"
              onClick={onDismiss}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </>
        }
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
