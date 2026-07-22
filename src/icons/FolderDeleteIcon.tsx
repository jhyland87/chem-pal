/** @internal */
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';
import { FC } from 'react';

/**
 * A Material-UI icon component that renders a folder with a delete badge.
 * This icon is typically used to represent removing or clearing a cached folder/entry.
 *
 * @component
 * @param props - The props passed to the underlying SvgIcon component
 * @returns A React component that renders the folder-delete icon
 * @source
 */
const FolderDeleteIcon: FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="2 2 16 16"
        fill="none"
      >
        <path
          d="M7.38,5.5l2,2h7.12v7h-13v-9H7.38z M3.5,4C2.67,4,2,4.67,2,5.5v9C2,15.33,2.67,16,3.5,16h13c0.83,0,1.5-0.67,1.5-1.5v-7 C18,6.67,17.33,6,16.5,6H10L8,4H3.5z M14,9V8.5h-1.5V9H11v1h0.5v2.5c0,0.55,0.45,1,1,1H14c0.55,0,1-0.45,1-1V10h0.5V9H14z M14,12.5 h-1.5V10H14V12.5z"
          fill="currentColor"
        />
      </svg>
    </SvgIcon>
  );
};

export default FolderDeleteIcon;
