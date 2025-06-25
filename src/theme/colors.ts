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
