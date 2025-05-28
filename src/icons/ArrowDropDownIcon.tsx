/** @internal */
import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/**
 * A Material-UI icon component that renders a downward dropdown arrow icon.
 * This icon is typically used to represent collapsing content, showing more options, or downward navigation.
 *
 * @group Icons
 * @param props - The props passed to the underlying SvgIcon component
 * @returns A React component that renders the downward dropdown arrow icon
 * @example
 * ```tsx
 * <ArrowDropDownIcon />
 * ```
 * {@includeCode ./ArrowDropDownIcon.tsx}
 */
const ArrowDropDownIcon: React.FC<SvgIconProps> = (props) => {
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
        <path d="M7 10L12 15L17 10H7Z" fill="currentColor" />
      </svg>
    </SvgIcon>
  );
};

export default ArrowDropDownIcon;
