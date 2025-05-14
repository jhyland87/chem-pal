import BenzeneBlueIcon from "./BenzeneBlueIcon";

interface ComponentProps {
  size?: number;
  [key: string]: unknown; // Optional: To allow additional props
}

export default function BenzeneBlueSpinner(props: ComponentProps) {
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
      fontSize="large"
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
