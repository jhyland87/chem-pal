import { IconSpinnerProps } from "../../types";
import BenzeneBlueIcon from "./BenzeneBlueIcon";

export default function BenzeneBlueSpinner(props: IconSpinnerProps) {
  const style = {
    width: "200px",
    height: "200px",
  };

  if (typeof props?.size == "number") {
    style.width = `${props.size}px`;
    style.height = `${props.size}px`;
  }
  return (
    <BenzeneBlueIcon
      sx={{
        ...style,
        animation: "spin 2s linear infinite",
        "@keyframes spin": {
          "0%": {
            transform: "rotate(360deg)",
          },
          "100%": {
            transform: "rotate(0deg)",
          },
        },
      }}
      {...props}
    />
  );
}
