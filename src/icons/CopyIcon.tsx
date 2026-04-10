/** @internal */
import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import React from "react";

/**
 * A Material-UI icon component that renders a copy icon.
 * This icon is typically used to represent copying content, copying URLs, or copying product information.
 *
 * @component
 * @param props - The props passed to the underlying SvgIcon component
 * @returns A React component that renders the copy icon
 * @source
 */
const CopyIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props}>
      <svg
        {...props}
        width="24"
        height="24"
        viewBox="0 -960 960 960"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M120-220v-80h80v80h-80Zm0-140v-80h80v80h-80Zm0-140v-80h80v80h-80ZM260-80v-80h80v80h-80Zm100-160q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480Zm40 240v-80h80v80h-80Zm-200 0q-33 0-56.5-23.5T120-160h80v80Zm340 0v-80h80q0 33-23.5 56.5T540-80ZM120-640q0-33 23.5-56.5T200-720v80h-80Zm420 80Z"
          fill="currentColor"
        />
      </svg>
    </SvgIcon>
  );
};

export default CopyIcon;
