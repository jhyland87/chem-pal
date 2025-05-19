import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/**
 * A Material-UI icon component that renders a tune/settings icon.
 * This icon is typically used to represent settings, filters, or tuning options.
 *
 * @component
 * @param {SvgIconProps} props - The props passed to the underlying SvgIcon component
 * @returns {JSX.Element} A React component that renders the tune icon
 */
const TuneIcon: React.FC<SvgIconProps> = (props) => {
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
          d="M3 17V19H9V17H3ZM3 5V7H13V5H3ZM13 21V19H21V17H13V15H11V21H13ZM7 9V11H3V13H7V15H9V9H7ZM21 13V11H11V13H21ZM15 9H17V7H21V5H17V3H15V9Z"
          fill="currentColor"
        />
      </svg>
    </SvgIcon>
  );
};

export default TuneIcon;
