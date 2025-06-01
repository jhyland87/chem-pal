import { SPIN_SPEED } from "@/constants/common";
import { keyframes, styled } from "@mui/material/styles";
import { cloneElement } from "react";
import "./IconSpinner.scss";

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
 */
const IconSpinner: React.FC<IconSpinnerProps> = (props: IconSpinnerProps) => {
  let { speed = 2 } = props;

  if (typeof speed === "string") {
    if (speed.toUpperCase() in SPIN_SPEED) {
      speed = SPIN_SPEED[speed.toUpperCase() as keyof typeof SPIN_SPEED];
    } else {
      speed = SPIN_SPEED.MEDIUM;
    }
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
  const child = cloneElement(props.children as React.ReactElement);
  return <SpinningWrapper>{child}</SpinningWrapper>;
};

export default IconSpinner;
