import { describe, expect, it } from "vitest";
import {
  darkTheme,
  drawerWidth,
  getBorderRadius,
  getBoxShadow,
  getTransition,
  lightTheme,
  searchMaxWidth,
} from "../colors";

describe("theme/colors constants", () => {
  it("exposes the light theme palette", () => {
    expect(lightTheme.text).toBe("#29303b");
    expect(lightTheme.primaryInterface).toBe("#ffffff");
    expect(lightTheme.paperBackground).toBe("#f3f7fa");
    expect(lightTheme.notificationBg).toBe("#4d7df2");
    expect(lightTheme.shadow).toBe("0 2px 8px rgba(0, 0, 0, 0.1)");
    expect(lightTheme.lightGray).toBe("#f5f5f5");
    expect(lightTheme.borderLight).toBe("#e0e0e0");
  });

  it("exposes the dark theme palette", () => {
    expect(darkTheme.drawerBackground).toBe("#272e3d");
    expect(darkTheme.expandedBackground).toBe("#19222b");
    expect(darkTheme.activeBackground).toBe("#515864");
    expect(darkTheme.borders).toBe("#1e1e1ef2");
    expect(darkTheme.text).toBe("#ffffff");
    expect(darkTheme.hoverBackground).toBe("#3a4250");
    expect(darkTheme.shadow).toBe("0 4px 12px rgba(0, 0, 0, 0.3)");
  });

  it("exposes layout dimension constants", () => {
    expect(drawerWidth).toBe(400);
    expect(searchMaxWidth).toBe(600);
  });
});

describe("getBoxShadow", () => {
  it("defaults to the medium elevation", () => {
    expect(getBoxShadow()).toBe("0 2px 8px rgba(0, 0, 0, 0.1)");
  });

  it("returns the low elevation shadow", () => {
    expect(getBoxShadow("low")).toBe("0 1px 4px rgba(0, 0, 0, 0.08)");
  });

  it("returns the medium elevation shadow", () => {
    expect(getBoxShadow("medium")).toBe("0 2px 8px rgba(0, 0, 0, 0.1)");
  });

  it("returns the high elevation shadow", () => {
    expect(getBoxShadow("high")).toBe("0 4px 16px rgba(0, 0, 0, 0.15)");
  });
});

describe("getBorderRadius", () => {
  it("defaults to the medium size", () => {
    expect(getBorderRadius()).toBe("8px");
  });

  it("returns the small radius", () => {
    expect(getBorderRadius("small")).toBe("4px");
  });

  it("returns the medium radius", () => {
    expect(getBorderRadius("medium")).toBe("8px");
  });

  it("returns the large radius", () => {
    expect(getBorderRadius("large")).toBe("12px");
  });
});

describe("getTransition", () => {
  it("uses the default property and duration", () => {
    expect(getTransition()).toBe("all 0.3s cubic-bezier(0.4, 0, 0.2, 1)");
  });

  it("honours a custom property", () => {
    expect(getTransition("opacity")).toBe("opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)");
  });

  it("honours a custom property and duration", () => {
    expect(getTransition("transform", "0.5s")).toBe(
      "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
    );
  });
});
