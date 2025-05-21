import BenzeneIcon from "icons/BenzeneIcon";
import { type IconSpinnerProps } from "types/props";
export default function BenzeneSpinner(props: IconSpinnerProps) {
  const style = {
    width: "200px",
    height: "200px",
  };

  if (typeof props?.size == "number") {
    style.width = `${props.size}px`;
    style.height = `${props.size}px`;
  }
  return (
    <BenzeneIcon
      sx={{
        ...style,
        animation: "spin 2s linear infinite",
        /* eslint-disable */
        "@keyframes spin": {
          "0%": {
            transform: "rotate(360deg)",
          },
          "100%": {
            transform: "rotate(0deg)",
          },
          /* eslint-enable */
        },
      }}
      {...props}
    />
  );
}
