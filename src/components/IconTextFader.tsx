import Collapse from "@mui/material/Collapse";
import { ReactNode, useEffect, useState } from "react";

type IconTextFaderProps = {
  children: ReactNode;
  text: string;
  active: boolean;
};

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
