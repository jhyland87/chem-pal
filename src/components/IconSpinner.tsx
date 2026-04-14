import { SPIN_SPEED } from "@/constants/common";
import { isSpinSpeed } from "@/utils/typeGuards/common";
import { keyframes, styled } from "@mui/material/styles";
import { cloneElement, isValidElement } from "react";

/**
 * A component that adds a spinning animation to any icon component passed as a child.
 * The component preserves any existing styles while adding the spinning animation.
 *
 * @component
 * @param props - The props from Material-UI's SvgIcon component
 * @returns An animated version of the provided icon
 *
 * @example
 * ```typescript
 * // Simple icon with default size and speed
 * <IconSpinner>
 *   <MyIcon />
 * </IconSpinner>
 *
 * // Icon with custom size, default speed
 * <IconSpinner>
 *   <MyIcon style={{ width: 100, height: 100 }} />
 * </IconSpinner>
 *
 * // Icon with custom speed (as string)
 * <IconSpinner speed={"fast"}>
 *   <MyIcon style={{ width: 100, height: 100 }} />
 * </IconSpinner>
 *
 * // Icon with custom speed (as number)
 * <IconSpinner speed={2}>
 *   <MyIcon style={{ width: 100, height: 100 }} />
 * </IconSpinner>
 *
 * // Icon with custom speed from SpinSpeeds enum
 * <IconSpinner speed={SpinSpeeds.MEDIUM}>
 *   <MyIcon style={{ width: 100, height: 100 }} />
 * </IconSpinner>
 * ```
 * @source
 */
const IconSpinner: React.FC<IconSpinnerProps> = (props: IconSpinnerProps) => {
  let { speed = 2 } = props;

  if (typeof speed === "string") {
    const key = speed.toUpperCase();
    speed = isSpinSpeed(key) ? SPIN_SPEED[key] : SPIN_SPEED.MEDIUM;
  }

  const spin = keyframes`
  from {
    transform: rotate(360deg);
  }
  to {
    transform: rotate(0deg);
  }
`;

  const SpinningWrapper = styled("div")({
    display: "inline-flex",
    animation: `${spin} ${speed}s linear infinite`,
  });
  // Clone the child element to preserve its props
  if (!isValidElement(props.children)) {
    return null;
  }
  const child = cloneElement(props.children);
  return <SpinningWrapper data-testid="spinning-wrapper">{child}</SpinningWrapper>;
};

export default IconSpinner;
