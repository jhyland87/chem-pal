// Color theme constants
export const lightTheme = {
  text: "#29303b",
  primaryInterface: "#ffffff",
  paperBackground: "#f3f7fa",
  notificationBg: "#4d7df2",
  shadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  lightGray: "#f5f5f5",
  borderLight: "#e0e0e0",
};

export const darkTheme = {
  drawerBackground: "#272e3d",
  expandedBackground: "#19222b",
  activeBackground: "#515864",
  borders: "#1e1e1ef2",
  text: "#ffffff",
  hoverBackground: "#3a4250",
  shadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
};

// Common style functions
export const getBoxShadow = (elevation: "low" | "medium" | "high" = "medium") => {
  const shadows = {
    low: "0 1px 4px rgba(0, 0, 0, 0.08)",
    medium: "0 2px 8px rgba(0, 0, 0, 0.1)",
    high: "0 4px 16px rgba(0, 0, 0, 0.15)",
  };
  return shadows[elevation];
};

export const getBorderRadius = (size: "small" | "medium" | "large" = "medium") => {
  const radii = {
    small: "4px",
    medium: "8px",
    large: "12px",
  };
  return radii[size];
};

// Transition functions
export const getTransition = (property = "all", duration = "0.3s") =>
  `${property} ${duration} cubic-bezier(0.4, 0, 0.2, 1)`;

export const drawerWidth = 400;
export const searchMaxWidth = 600;

/**
 * Categorical color palette used to visually distinguish suppliers in charts and
 * log output. Indexed cyclically, so extra entries just add more distinct colors
 * before the palette repeats.
 */
export const SUPPLIER_COLORS = [
  "#fa938e",
  "#98bf45",
  "#51cbcf",
  "#d397ff",
  "#ffc658",
  "#8884d8",
  "#82ca9d",
  "#8dd1e1",
  "#a4de6c",
  "#ffa07a",
  "#87ceeb",
  "#f0e68c",
  "#e57373",
  "#f06292",
  "#ba68c8",
  "#9575cd",
  "#7986cb",
  "#5c6bc0",
  "#64b5f6",
  "#4fc3f7",
  "#4db6ac",
  "#66bb6a",
  "#c0ca33",
  "#d4e157",
  "#ff7043",
  "#ffb74d",
  "#a1887f",
  "#90a4ae",
  "#ff8a80",
  "#b388ff",
];

/**
 * Hashes a string to a non-negative 32-bit integer using the djb2 algorithm.
 * @param value - The string to hash
 * @returns A non-negative integer hash
 */
const hashString = (value: string): number => {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return hash >>> 0;
};

/**
 * Deterministically picks a color from {@link SUPPLIER_COLORS} for a given key.
 * The same key always maps to the same color, so a supplier keeps a stable color
 * across sessions without having to declare one.
 * @param key - A stable identifier for the supplier (e.g. its class name)
 * @returns A hex color string from {@link SUPPLIER_COLORS}
 * @example
 * getSupplierColor("SupplierAmbeed"); // always the same palette color, e.g. "#4db6ac"
 */
export const getSupplierColor = (key: string): string =>
  SUPPLIER_COLORS[hashString(key) % SUPPLIER_COLORS.length];

/**
 * Parses a 3- or 6-digit hex color into its `[r, g, b]` components (0–255).
 * @param hexColor - A CSS hex color (e.g. "#e8302a", "#fff")
 * @returns The RGB tuple, or undefined when the input isn't a hex color
 */
const parseHexColor = (hexColor: string): [number, number, number] | undefined => {
  const hex = hexColor.replace("#", "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return undefined;
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
};

/**
 * Picks a readable text color (black or white) for a given background, using the
 * perceptual YIQ brightness of the parsed RGB. Falls back to black when the
 * background isn't a hex color (e.g. "currentColor" or a named color).
 * @param background - A CSS hex color, 3- or 6-digit (e.g. "#e8302a", "#fff")
 * @returns "#000000" on light backgrounds, "#ffffff" on dark ones
 * @example
 * getContrastText("#5c6bc0"); // "#ffffff"
 * getContrastText("#f0e68c"); // "#000000"
 */
export const getContrastText = (background: string): string => {
  const rgb = parseHexColor(background);
  if (!rgb) {
    return "#000000";
  }
  const [r, g, b] = rgb;
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? "#000000" : "#ffffff";
};

/**
 * Converts a hex color to an `rgba()` string at the given alpha. Non-hex inputs
 * are returned unchanged so callers can pass them through safely.
 * @param hexColor - A CSS hex color, 3- or 6-digit (e.g. "#4db6ac", "#fff")
 * @param alpha - Opacity from 0 (transparent) to 1 (opaque)
 * @returns An `rgba(r, g, b, alpha)` string, or the input if it isn't hex
 * @example
 * hexToRgba("#4db6ac", 0.5); // "rgba(77, 182, 172, 0.5)"
 */
export const hexToRgba = (hexColor: string, alpha: number): string => {
  const rgb = parseHexColor(hexColor);
  if (!rgb) {
    return hexColor;
  }
  const [r, g, b] = rgb;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
