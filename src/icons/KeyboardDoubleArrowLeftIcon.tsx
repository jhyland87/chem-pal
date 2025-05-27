/** @internal */
import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/**
 * A Material-UI icon component that renders a double left arrow icon.
 * This icon is typically used to represent rewind, previous page, or skip back functionality.
 *
 * @component
 * @param props - The props passed to the underlying SvgIcon component
 * @returns  A React component that renders the double left arrow icon
 */
const KeyboardDoubleArrowLeftIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M17.59 18L19 16.59L14.42 12L19 7.41L17.59 6L11.59 12L17.59 18ZM11.59 18L13 16.59L8.42 12L13 7.41L11.59 6L5.59 12L11.59 18Z"
          fill="currentColor"
        />
      </svg>
    </SvgIcon>
  );
};

export default KeyboardDoubleArrowLeftIcon;
