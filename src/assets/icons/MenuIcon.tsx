import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import React from "react";

/**
 * A Material-UI icon component that renders a menu/hamburger icon.
 * This icon is typically used to represent a navigation menu or list of options.
 *
 * @component
 * @param {SvgIconProps} props - The props passed to the underlying SvgIcon component
 * @returns {JSX.Element} A React component that renders the menu icon
 */
const MenuIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M3 18H21V16H3V18ZM3 13H21V11H3V13ZM3 6V8H21V6H3Z" fill="currentColor" />
      </svg>
    </SvgIcon>
  );
};

export default MenuIcon;
