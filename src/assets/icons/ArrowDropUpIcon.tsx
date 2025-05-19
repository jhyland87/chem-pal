import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

interface ArrowDropUpIconProps extends SvgIconProps {
  className?: string;
}

const ArrowDropUpIcon: React.FC<ArrowDropUpIconProps> = (props) => {
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
