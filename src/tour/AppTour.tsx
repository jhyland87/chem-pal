import { useTheme as useMuiTheme } from "@mui/material/styles";
import { FC } from "react";
import { Joyride } from "react-joyride";
import type { EventHandler, Options, Step, Styles } from "react-joyride";

/** Props for {@link AppTour} — supplied by {@link useAppTour}. */
interface AppTourProps {
  /** Whether the tour is running. */
  run: boolean;
  /** The active step list for the current context. */
  steps: Step[];
  /** Bumped on replay to remount Joyride and restart at step 0. */
  joyrideKey: number;
  /** Joyride event handler. */
  onEvent: EventHandler;
}

/**
 * Renders the react-joyride tour with theme-matched styling. Kept separate from
 * {@link useAppTour} so it can sit inside the app's `ThemeProvider` and read the
 * live MUI palette (the hook is called higher up, above that provider).
 * @param props - Render state from {@link useAppTour}.
 * @returns The Joyride element, or `null` when there are no steps to show.
 * @example
 * ```tsx
 * const { tour } = useAppTour({ setSpeedDialVisible });
 * return <AppTour {...tour} />;
 * ```
 * @source
 */
export const AppTour: FC<AppTourProps> = ({ run, steps, joyrideKey, onEvent }) => {
  const theme = useMuiTheme();

  if (steps.length === 0) return null;

  const options: Partial<Options> = {
    primaryColor: theme.palette?.primary?.main ?? "#2C4060",
    backgroundColor: theme.palette?.background?.paper ?? "#ffffff",
    textColor: theme.palette?.text?.primary ?? "#000000",
    arrowColor: theme.palette?.background?.paper ?? "#ffffff",
    showProgress: true,
    skipBeacon: true,
    zIndex: 10_000,
    buttons: ["back", "skip", "primary"],
    width: 280,
  };

  // Compact typography/padding so the tooltip fits the narrow popup and doesn't
  // get clipped at the top of the viewport.
  const styles: Partial<Styles> = {
    tooltip: { fontSize: 13, padding: 8, borderRadius: 8 },
    tooltipTitle: { fontSize: 14, fontWeight: 600, margin: "0 0 4px" },
    tooltipContent: { fontSize: 12.5, lineHeight: 1.4, padding: "4px 6px" },
    tooltipFooter: { marginTop: 6 },
    buttonPrimary: { fontSize: 12.5, padding: "6px 10px" },
    buttonBack: { fontSize: 12.5 },
    buttonSkip: { fontSize: 12.5 },
  };

  return (
    <Joyride
      key={joyrideKey}
      run={run}
      steps={steps}
      continuous
      initialStepIndex={0}
      scrollToFirstStep={false}
      options={options}
      styles={styles}
      onEvent={onEvent}
    />
  );
};
