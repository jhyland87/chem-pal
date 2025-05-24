import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/**
 * A Material-UI icon component that renders a double right arrow icon.
 * This icon is typically used to represent fast forward, next page, or skip functionality.
 *
 * @component
 * @param props - The props passed to the underlying SvgIcon component
 * @returns A React component that renders the double right arrow icon
 */
const KeyboardDoubleArrowRightIcon: React.FC<SvgIconProps> = (props) => {
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
          d="M6.41 6L5 7.41L9.58 12L5 16.59L6.41 18L12.41 12L6.41 6ZM12.41 6L11 7.41L15.58 12L11 16.59L12.41 18L18.41 12L12.41 6Z"
          fill="currentColor"
        />
      </svg>
    </SvgIcon>
  );
};

export default KeyboardDoubleArrowRightIcon;
