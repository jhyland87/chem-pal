import { useAppContext } from "@/context";
import { delayAction } from "@/helpers/utils";
import { useEffect, useState } from "react";

/**
 * Hook to manage help tooltip visibility with customizable timing.
 * Consolidates the help tooltip logic used across multiple components.
 *
 * @param delay - Delay before showing tooltip (default: 500ms)
 * @param duration - Duration to show tooltip (default: 2000ms)
 * @returns Tooltip state and handlers
 *
 * @example
 * ```tsx
 * const { showHelp, handleTooltipClose, handleTooltipOpen } = useHelpTooltip(1000, 3000);
 *
 * <Tooltip
 *   open={showHelp}
 *   onClose={handleTooltipClose}
 *   onOpen={handleTooltipOpen}
 * >
 *   <Button>Help Button</Button>
 * </Tooltip>
 * ```
 */
export function useHelpTooltip(delay = 500, duration = 2000) {
  const appContext = useAppContext();
  const [showHelp, setShowHelp] = useState(false);

  /**
   * Effect hook to show and hide help tooltip based on settings.
   * Shows help tooltip after delay and hides it after duration if showHelp is enabled.
   */
  useEffect(() => {
    if (appContext.userSettings.showHelp === false) return;

    delayAction(delay, () => setShowHelp(true));
    delayAction(duration, () => setShowHelp(false));
  }, [delay, duration, appContext.userSettings.showHelp]);

  const handleTooltipClose = () => {
    setShowHelp(false);
  };

  const handleTooltipOpen = () => {
    setShowHelp(true);
  };

  return {
    showHelp,
    setShowHelp,
    handleTooltipClose,
    handleTooltipOpen,
  };
}
