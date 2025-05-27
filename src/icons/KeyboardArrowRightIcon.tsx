/** @internal */
import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/**
 * A Material-UI icon component that renders a single right arrow icon.
 * This icon is typically used to represent forward, next, or right navigation.
 *
 * @component
 * @param props - The props passed to the underlying SvgIcon component
 * @returns A React component that renders the right arrow icon
 */
const KeyboardArrowRightIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M8.59 16.59L10 18L16 12L10 6L8.59 7.41L13.17 12L8.59 16.59Z" fill="currentColor" />
      </svg>
    </SvgIcon>
  );
};

export default KeyboardArrowRightIcon;
