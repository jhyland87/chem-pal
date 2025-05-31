import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, test } from "vitest";
import ArrowDropDownIcon from "../ArrowDropDownIcon";
import ArrowDropUpIcon from "../ArrowDropUpIcon";
import ArrowRightIcon from "../ArrowRightIcon";
import AutoDeleteIcon from "../AutoDeleteIcon";
import BenzeneBlueIcon from "../BenzeneBlueIcon";
import BenzeneIcon from "../BenzeneIcon";
import BookmarkIcon from "../BookmarkIcon";
import ClearIcon from "../ClearIcon";
import ContrastIcon from "../ContrastIcon";
import GitHubIcon from "../GitHubIcon";
import HistoryIcon from "../HistoryIcon";
import InfoOutlineIcon from "../InfoOutlineIcon";
import KeyboardArrowLeftIcon from "../KeyboardArrowLeftIcon";
import KeyboardArrowRightIcon from "../KeyboardArrowRightIcon";
import KeyboardDoubleArrowLeftIcon from "../KeyboardDoubleArrowLeftIcon";
import KeyboardDoubleArrowRightIcon from "../KeyboardDoubleArrowRightIcon";
import MenuIcon from "../MenuIcon";
import ScienceIcon from "../ScienceIcon";
import SearchIcon from "../SearchIcon";
import SettingsIcon from "../SettingsIcon";
import StoreIcon from "../StoreIcon";
import TuneIcon from "../TuneIcon";

// Array of all icons and their components for testing
const icons = [
  { name: "ArrowDropDown", component: ArrowDropDownIcon },
  { name: "ArrowDropUp", component: ArrowDropUpIcon },
  { name: "ArrowRight", component: ArrowRightIcon },
  { name: "AutoDelete", component: AutoDeleteIcon },
  { name: "BenzeneBlue", component: BenzeneBlueIcon },
  { name: "Benzene", component: BenzeneIcon },
  { name: "Bookmark", component: BookmarkIcon },
  { name: "Clear", component: ClearIcon },
  { name: "Contrast", component: ContrastIcon },
  { name: "GitHub", component: GitHubIcon },
  { name: "History", component: HistoryIcon },
  { name: "InfoOutline", component: InfoOutlineIcon },
  { name: "KeyboardArrowLeft", component: KeyboardArrowLeftIcon },
  { name: "KeyboardArrowRight", component: KeyboardArrowRightIcon },
  { name: "KeyboardDoubleArrowLeft", component: KeyboardDoubleArrowLeftIcon },
  { name: "KeyboardDoubleArrowRight", component: KeyboardDoubleArrowRightIcon },
  { name: "Menu", component: MenuIcon },
  { name: "Science", component: ScienceIcon },
  { name: "Search", component: SearchIcon },
  { name: "Settings", component: SettingsIcon },
  { name: "Store", component: StoreIcon },
  { name: "Tune", component: TuneIcon },
];

describe("Icon Components", () => {
  // Test that each icon renders without crashing
  test.each(icons)(
    "$name icon renders without crashing",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ({ component: IconComponent }) => {
      const { container } = render(<IconComponent />);
      expect(container.firstChild).toBeInTheDocument();
    },
  );

  // Test that each icon accepts and applies custom props
  test.each(icons)(
    "$name icon accepts custom props",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ({ component: IconComponent }) => {
      const customProps = {
        fontSize: "large" as const,
        color: "primary" as const,
        className: "custom-class",
      };

      const { container } = render(<IconComponent {...customProps} />);
      const iconElement = container.firstChild as HTMLElement;

      // Check that our custom class is applied
      expect(iconElement).toHaveClass("custom-class");

      // Verify the SVG element exists and has content
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg?.children.length).toBeGreaterThan(0);
    },
  );

  // Test that each icon maintains aspect ratio
  test.each(icons)(
    "$name icon maintains aspect ratio",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ({ component: IconComponent }) => {
      const { container } = render(<IconComponent />);
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("viewBox");
    },
  );

  // Test that each icon has proper ARIA attributes
  test.each(icons)(
    "$name icon has proper ARIA attributes",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ({ component: IconComponent }) => {
      // Test with aria-label
      const { container: labelContainer } = render(<IconComponent aria-label="test icon" />);
      const labeledIcon = labelContainer.firstChild;
      expect(labeledIcon).toHaveAttribute("aria-label", "test icon");
      expect(labeledIcon).toHaveAttribute("aria-hidden", "true"); // Hidden when label is present

      // Test without aria-label
      const { container: noLabelContainer } = render(<IconComponent />);
      const unlabeledIcon = noLabelContainer.firstChild;
      expect(unlabeledIcon).not.toHaveAttribute("aria-label");
      expect(unlabeledIcon).toHaveAttribute("aria-hidden", "true"); // Icons are decorative by default
    },
  );
});
