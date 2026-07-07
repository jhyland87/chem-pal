import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { FC } from "react";

/** Props for {@link TourWelcomeDialog}. */
interface TourWelcomeDialogProps {
  /** Whether the prompt is shown. */
  open: boolean;
  /** Called when the user chooses to start the tour. */
  onStart: () => void;
  /** Called when the user dismisses the prompt ("Maybe later"). */
  onDismiss: () => void;
}

/**
 * First-run opt-in prompt. A single-step Joyride can't show two labelled
 * buttons (its skip button is hidden on the last step), so the welcome uses a
 * plain MUI dialog: "Start tour" launches the pointed steps, "Maybe later"
 * snoozes it.
 * @param props - Open state and the start/dismiss callbacks.
 * @returns The welcome dialog element.
 * @example
 * ```tsx
 * const { welcome } = useAppTour({ setSpeedDialVisible });
 * return <TourWelcomeDialog {...welcome} />;
 * ```
 * @source
 */
export const TourWelcomeDialog: FC<TourWelcomeDialogProps> = ({ open, onStart, onDismiss }) => {
  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      aria-labelledby="tour-welcome-title"
      aria-describedby="tour-welcome-description"
      sx={{ zIndex: 10_000 }}
    >
      <DialogTitle id="tour-welcome-title">Welcome to ChemPal!</DialogTitle>
      <DialogContent>
        <DialogContentText id="tour-welcome-description">
          Want a quick tour of the main features?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onDismiss} color="inherit">
          Maybe later
        </Button>
        <Button onClick={onStart} variant="contained" autoFocus>
          Start tour
        </Button>
      </DialogActions>
    </Dialog>
  );
};
