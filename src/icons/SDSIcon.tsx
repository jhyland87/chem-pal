/** @internal */
import CustomFileIcon, { type CustomFileIconProps } from '@/icons/CustomFileIcon';
import { FC } from 'react';

/** Props for {@link SDSIcon}: all {@link CustomFileIconProps} except the fixed `label`. */
export type SDSIconProps = Omit<CustomFileIconProps, 'label'>;

/**
 * A Material-UI icon component that renders a Safety Data Sheet (SDS) document.
 * Thin wrapper over {@link CustomFileIcon} with a yellow body and a red "SDS" label; all
 * colors and the optional `language` badge can still be overridden via props.
 *
 * @component
 * @param props - {@link CustomFileIconProps} overrides (colors, `language`, SvgIcon props)
 * @returns A React component that renders the SDS icon
 * @example
 * // Default yellow document, red "SDS" label, with an English badge
 * <SDSIcon fontSize="small" language="EN" />
 * @source
 */
const SDSIcon: FC<SDSIconProps> = (props) => {
  return <CustomFileIcon label="SDS" labelColor="#e8302a" {...props} />;
};

export default SDSIcon;
