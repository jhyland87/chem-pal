import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

interface ArrowDropDownIconProps extends SvgIconProps {
  className?: string;
}

const ArrowDropDownIcon: React.FC<ArrowDropDownIconProps> = (props) => {
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
