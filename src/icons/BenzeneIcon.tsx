/** @internal */
import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/**
 * A React component that renders a benzene molecule icon using SVG.
 * This component extends Material-UI's SvgIcon component.
 *
 * @component
 * @param props - The props from Material-UI's SvgIcon component
 * @returns A benzene molecule icon component
 *
 * @example
 * ```typescript
 * <BenzeneIcon />
 * // With custom props
 * <BenzeneIcon fontSize="large" color="primary" />
 * ```
 */
export default function BenzeneIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <svg
        fill="#000000"
        height="800px"
        width="800px"
        version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
      >
        <g>
          <g>
            <path
              d="M470.495,120.793L265.846,2.639c-6.093-3.518-13.6-3.518-19.692,0L41.505,120.793c-6.093,3.517-9.846,10.018-9.846,17.054
			v236.308c0,7.035,3.753,13.536,9.846,17.054l204.649,118.154c6.093,3.518,13.601,3.518,19.692,0l204.649-118.154
			c6.093-3.517,9.846-10.018,9.846-17.054V137.846C480.341,130.811,476.588,124.31,470.495,120.793z M440.957,362.785L256,469.57
			L71.043,362.785v-213.57L256,42.43l184.957,106.785V362.785z"
            />
          </g>
        </g>
        <g>
          <g>
            <path
              d="M116.992,156.052c-10.875,0-19.692,8.817-19.692,19.692v160.511c0,10.875,8.817,19.692,19.692,19.692
			s19.692-8.817,19.692-19.691V175.745C136.684,164.869,127.867,156.052,116.992,156.052z"
            />
          </g>
        </g>
        <g>
          <g>
            <path
              d="M412.062,326.409c-5.438-9.418-17.481-12.646-26.9-7.207l-139.008,80.257c-9.418,5.438-12.645,17.482-7.207,26.9
			c5.439,9.423,17.485,12.644,26.9,7.207l139.008-80.257C414.272,347.871,417.499,335.827,412.062,326.409z"
            />
          </g>
        </g>
        <g>
          <g>
            <path
              d="M404.854,158.691L265.846,78.434c-9.419-5.44-21.462-2.211-26.9,7.207s-2.211,21.462,7.207,26.9l139.008,80.257
			c9.413,5.436,21.461,2.213,26.9-7.207C417.499,176.173,414.272,164.129,404.854,158.691z"
            />
          </g>
        </g>
      </svg>
    </SvgIcon>
  );
}
