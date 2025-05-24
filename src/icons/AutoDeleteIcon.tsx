import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import React from "react";

/**
 * A Material-UI icon component that renders an auto-delete icon.
 * This icon is typically used to represent automatic deletion, cleanup, or scheduled removal of items.
 *
 * @component
 * @param props - The props passed to the underlying SvgIcon component
 * @returns A React component that renders the auto-delete icon
 */
const AutoDeleteIcon: React.FC<SvgIconProps> = (props) => {
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
        <path
          d="M15 16H19V18H15V16ZM15 8H22V10H15V8ZM15 12H21V14H15V12ZM3 18C3 19.1 3.9 20 5 20H11C12.1 20 13 19.1 13 18V8H3V18ZM14 5H11L10 4H6L5 5H2V7H14V5Z"
          fill="currentColor"
        />
      </svg>
    </SvgIcon>
  );
};

export default AutoDeleteIcon;
