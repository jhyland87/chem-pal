/** @internal */
import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import React from "react";

/**
 * A Material-UI icon component that renders a HTTP icon.
 * This icon is typically used to represent HTTP requests, HTTP responses, or HTTP status codes.
 *
 * @component
 * @param props - The props passed to the underlying SvgIcon component
 * @returns A React component that renders the HTTP icon
 * @source
 */
const HttpIcon: React.FC<SvgIconProps> = (props) => {
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
          d="M40-360v-240h60v80h80v-80h60v240h-60v-100h-80v100H40Zm300 0v-180h-60v-60h180v60h-60v180h-60Zm220 0v-180h-60v-60h180v60h-60v180h-60Zm160 0v-240h140q24 0 42 18t18 42v40q0 24-18 42t-42 18h-80v80h-60Zm60-140h80v-40h-80v40Z"
          fill="currentColor"
        />
      </svg>
    </SvgIcon>
  );
};

export default HttpIcon;
