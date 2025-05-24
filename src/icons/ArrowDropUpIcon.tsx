import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/**
 * A Material-UI icon component that renders an upward dropdown arrow icon.
 * This icon is typically used to represent expanding content, showing more options, or upward navigation.
 *
 * @component
 * @param props - The props passed to the underlying SvgIcon component
 * @returns A React component that renders the upward dropdown arrow icon
 */
const ArrowDropUpIcon: React.FC<SvgIconProps> = (props) => {
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
        <path d="M7 14L12 9L17 14H7Z" fill="currentColor" />
      </svg>
    </SvgIcon>
  );
};

export default ArrowDropUpIcon;
