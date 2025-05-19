import React from "react";

interface HistoryIconProps {
  className?: string;
}

const HistoryIcon: React.FC<HistoryIconProps> = ({ className }) => (
  <svg
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13 3C8.03 3 4 7.03 4 12H1L4.89 15.89L4.96 16.03L9 12H6C6 7.58 9.58 4 14 4C18.42 4 22 7.58 22 12C22 16.42 18.42 20 14 20C11.24 20 8.88 18.36 7.84 16H6.26C7.44 18.95 10.42 21 14 21C19.05 21 23 17.05 23 12C23 6.95 19.05 3 14 3V3ZM12 8V13L16.28 15.54L17 14.33L13.5 12.25V8H12Z"
      fill="currentColor"
    />
  </svg>
);

export default HistoryIcon;
