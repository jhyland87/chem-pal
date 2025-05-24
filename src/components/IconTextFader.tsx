import type { IconTextFaderProps } from "@/types/props";
import Collapse from "@mui/material/Collapse";
import { useEffect, useState } from "react";

/**
 * IconTextFader component that smoothly transitions between an icon and text.
 * The text is shown when the component is hovered or active, and the icon is shown otherwise.
 *
 * @component
 * @category Component
 * @param props - Component props
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
