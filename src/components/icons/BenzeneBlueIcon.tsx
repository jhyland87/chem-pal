import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

export default function BenzeneBlueIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <svg
        version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 512 512"
        xmlSpace="preserve"
      >
        <path
          style={{ fill: "#444242" }}
          d="M256,512L34.298,383.999V128L256,0l221.702,128v255.999L256,512z M67.356,364.914L256,473.828
	l188.644-108.914V147.085L256,38.172L67.356,147.085V364.914z"
        />
        <rect x="371.26" y="160.95" style={{ fill: "#528ACF" }} width="33.06" height="190.12" />
        <g>
          <rect
            x="173.353"
            y="46.415"
            transform="matrix(0.5 0.866 -0.866 0.5 217.4529 -93.7094)"
            style={{ fill: "#61A2EF" }}
            width="33.059"
            height="190.106"
          />

          <rect
            x="94.842"
            y="353.986"
            transform="matrix(0.866 0.5 -0.5 0.866 210.7043 -45.3073)"
            style={{ fill: "#61A2EF" }}
            width="190.106"
            height="33.059"
          />
        </g>
        <path
          style={{ fill: "#3A3839" }}
          d="M256,0l221.702,128v255.999L256,512v-38.172l188.644-108.914V147.085L256,38.172V0z"
        />
      </svg>{" "}
    </SvgIcon>
  );
}
