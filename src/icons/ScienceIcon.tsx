/** @internal */
import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import React from "react";

/**
 * A Material-UI icon component that renders a science/laboratory icon.
 * This icon is typically used to represent scientific research, laboratory work, or chemical analysis.
 *
 * @component
 * @param props - The props passed to the underlying SvgIcon component
 * @returns A React component that renders the science icon
 */
const ScienceIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M19.8 18.4L14 10.67V6.5L15.6 3.9C15.8 3.6 16 3.28 16 3C16 2.45 15.55 2 15 2C14.45 2 14 2.45 14 3C14 3.28 14.2 3.6 14.4 3.9L16 6.5V10.67L6.8 18.4C6.4 18.8 6.2 19.4 6.2 20C6.2 21.1 7.1 22 8.2 22H19.8C20.9 22 21.8 21.1 21.8 20C21.8 19.4 21.6 18.8 21.2 18.4H19.8Z"
          fill="currentColor"
        />
      </svg>
    </SvgIcon>
  );
};

export default ScienceIcon;
