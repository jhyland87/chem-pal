import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import React from "react";

/**
 * A Material-UI icon component that renders a clear/close icon.
 * This icon is typically used to represent clearing content, closing dialogs, or removing items.
 *
 * @component
 * @param {SvgIconProps} props - The props passed to the underlying SvgIcon component
 * @returns {JSX.Element} A React component that renders the clear icon
 */
const ClearIcon: React.FC<SvgIconProps> = (props) => {
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
          d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
          fill="currentColor"
        />
      </svg>
    </SvgIcon>
  );
};

export default ClearIcon;
