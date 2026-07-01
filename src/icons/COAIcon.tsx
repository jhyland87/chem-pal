/** @internal */
import CustomFileIcon, { type CustomFileIconProps } from "@/icons/CustomFileIcon";
import { FC } from "react";

/** Props for {@link COAIcon}: all {@link CustomFileIconProps} except the fixed `label`. */
export type COAIconProps = Omit<CustomFileIconProps, "label">;

/**
 * A Material-UI icon component that renders a Certificate of Analysis (COA) document.
 * Thin wrapper over {@link CustomFileIcon} with a black "COA" label on a gold badge; all
 * colors and the optional `language` badge can still be overridden via props.
 *
 * @component
 * @param props - {@link CustomFileIconProps} overrides (colors, `language`, SvgIcon props)
 * @returns A React component that renders the COA icon
 * @example
 * // Default document with a "COA" label and an English badge
 * <COAIcon fontSize="small" language="EN" />
 * @source
 */
const COAIcon: FC<COAIconProps> = (props) => {
  return <CustomFileIcon label="COA" textColor="#000000" labelColor="#d3c32a" {...props} />;
};

export default COAIcon;
