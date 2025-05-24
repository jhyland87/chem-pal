import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import React from "react";

/**
 * A Material-UI icon component that renders a contrast icon.
 * This icon is typically used to represent contrast settings, theme switching, or visual adjustments.
 *
 * @component
 * @param {SvgIconProps} props - The props passed to the underlying SvgIcon component
 * @returns {JSX.Element} A React component that renders the contrast icon
 */
const ContrastIcon: React.FC<SvgIconProps> = (props) => {
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
          d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM12 20V4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20Z"
          fill="currentColor"
        />
      </svg>
    </SvgIcon>
  );
};

export default ContrastIcon;
