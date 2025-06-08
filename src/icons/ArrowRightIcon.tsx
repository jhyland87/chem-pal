/** @internal */
import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import React from "react";

/**
 * A Material-UI icon component that renders a right arrow icon.
 * This icon is typically used to represent forward navigation, next step, or right direction.
 *
 * @group Icons
 * @param props - The props passed to the underlying SvgIcon component
 * @returns A React component that renders the right arrow icon
 * @example
 * ```tsx
 * <ArrowRightIcon />
 * ```
 * {@includeCode ./ArrowRightIcon.tsx}
 */
const ArrowRightIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props}>
      <svg
        {...props}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M10 17l5-5-5-5v10z" fill="currentColor" />
      </svg>
    </SvgIcon>
  );
};

export default ArrowRightIcon;
