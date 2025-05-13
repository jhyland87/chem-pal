import { ReactNode, useState } from "react";

export default function IconTextFader({ icon, text }: { icon: ReactNode; text: string }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        transition: "opacity 0.3s ease",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        style={{
          opacity: isHovered ? 0 : 1,
          transition: "opacity 0.3s ease",
          fontSize: "24px", // Adjust as needed
        }}
      >
        {icon}
      </span>
      <span
        style={{
          opacity: isHovered ? 1 : 0,
          transition: "opacity 0.3s ease",
          marginLeft: "8px", // Adjust spacing
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </div>
  );
}
