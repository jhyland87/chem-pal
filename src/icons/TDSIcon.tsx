/** @internal */
import CustomFileIcon, { type CustomFileIconProps } from '@/icons/CustomFileIcon';
import { FC } from 'react';

/** Props for {@link TDSIcon}: all {@link CustomFileIconProps} except the fixed `label`. */
export type TDSIconProps = Omit<CustomFileIconProps, 'label'>;

/**
 * A Material-UI icon component that renders a Technical Data Sheet (TDS) document.
 * Thin wrapper over {@link CustomFileIcon} with a white body and a blue "TDS" label; all
 * colors and the optional `language` badge can still be overridden via props.
 *
 * @component
 * @param props - {@link CustomFileIconProps} overrides (colors, `language`, SvgIcon props)
 * @returns A React component that renders the TDS icon
 * @example
 * // Default white document, blue "TDS" label, with an English badge
 * <TDSIcon fontSize="small" language="EN" />
 * @source
 */
const TDSIcon: FC<TDSIconProps> = (props) => {
  return <CustomFileIcon label="TDS" labelColor="#2f6fed" {...props} />;
};

export default TDSIcon;
