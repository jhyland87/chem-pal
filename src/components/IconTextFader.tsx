import Collapse from "@mui/material/Collapse";
import { ReactNode, useEffect, useState } from "react";

/**
 * Props for the IconTextFader component
 * @param {ReactNode} children - Icon element to display
 * @param {string} text - Text to display when expanded
 * @param {boolean} active - Whether the component is in active state
 */
type IconTextFaderProps = {
  children: ReactNode;
  text: string;
  active: boolean;
};

/**
 * IconTextFader component that smoothly transitions between an icon and text.
 * The text is shown when the component is hovered or active, and the icon is shown otherwise.
 *
 * @component
 *
 * @param {IconTextFaderProps} props - Component props
 * @param {ReactNode} props.children - Icon element to display
 * @param {string} props.text - Text to display when expanded
 * @param {boolean} props.active - Whether the component is in active state
 *
 * @example
 * ```tsx
 * <IconTextFader text="Search" active={isActive}>
 *   <SearchIcon />
 * </IconTextFader>
 * ```
 */
export default function IconTextFader({ children, text, active }: IconTextFaderProps) {
  const [isHovered, setIsHovered] = useState(active);

  useEffect(() => {
    setIsHovered(active);
  }, [active]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(active)}
    >
      <Collapse in={isHovered}>{text}</Collapse>
      <Collapse in={!isHovered}>{children}</Collapse>
    </div>
  );
}
