import { useHelpTooltip } from "@/shared/hooks/useHelpTooltip.hook";
import Tooltip from "@mui/material/Tooltip";
import { MouseEvent } from "react";

/**
 * A tooltip component that displays help text with customizable timing and styling.
 *
 * @component
 * @category Components
 * @param props - The component props
 * @returns A tooltip component that displays help text
 *
 * @example
 * ```tsx
 * <HelpTooltip
 *   text="Click here to save your changes"
 *   delay={1000}
 *   duration={3000}
 * >
 *   <Button>Save</Button>
 * </HelpTooltip>
 * ```
 */
export default function HelpTooltip({
  text,
  children,
  delay = 500,
  duration = 2000,
}: HelpTooltipProps) {
  const { showHelp, handleTooltipClose, handleTooltipOpen } = useHelpTooltip(delay, duration);

  // @todo: Fix this. The onClick is actually triggering a click on the
  // child element instead. the preventDefault and stopPropagation are not
  // fixing anything..
  const handleTooltipClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handleTooltipClose();
  };

  return (
    <Tooltip
      title={text}
      placement="left-start"
      sx={{
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "& .MuiTooltip-tooltip": {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: "white",
          fontSize: "12px",
          padding: "4px 8px",
          borderRadius: "4px",
          maxWidth: "200px",
          textAlign: "center",
          fontFamily: "Arial, sans-serif",
          fontWeight: "bold",
          textShadow: "1px 1px 2px rgba(0, 0, 0, 0.5)",
          opacity: 0.8,
          transition: "opacity 0.3s ease-in-out",
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "&:hover": {
            opacity: 1,
          },
        },
      }}
      onClick={handleTooltipClick}
      open={showHelp}
      onClose={handleTooltipClose}
      onOpen={handleTooltipOpen}
    >
      {children}
    </Tooltip>
  );
}
