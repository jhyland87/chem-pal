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
      onMouseOver={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseOut={() => setIsHovered(false)}
    >
      <span
        style={{
          opacity: Number(!isHovered),
          display: isHovered ? "none" : "block",
          //transform: "scale(1,0)",
          transition: "opacity 0.3s linear",
          animation: "fadeinout 4s linear forwards",
          fontSize: "24px", // Adjust as needed
        }}
      >
        {icon}
      </span>
      <span
        style={{
          opacity: Number(isHovered),
          display: isHovered ? "block" : "none",
          //transform: "scale(0,1)",
          transition: "opacity 0.3s linear",
          animation: "fadeinout 4s linear forwards",
          marginLeft: "8px", // Adjust spacing
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </div>
  );
}
