import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CustomFileIcon from "../CustomFileIcon";

/** Reads the `fill` of the nth `<text>` element (0 = label band, 1 = language badge). */
const textFill = (container: HTMLElement, index = 0): string | null =>
  container.querySelectorAll("text")[index]?.getAttribute("fill") ?? null;

describe("CustomFileIcon", () => {
  it("renders the label text inside the document", () => {
    const { container } = render(<CustomFileIcon label="SPECS" />);
    const label = container.querySelector("text");
    expect(label).toBeInTheDocument();
    expect(label?.textContent).toBe("SPECS");
  });

  it("uses a white viewBox-sized SvgIcon root with custom class support", () => {
    const { container } = render(<CustomFileIcon label="SDS" className="custom-class" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 48 48");
    expect(container.firstChild).toHaveClass("custom-class");
  });

  describe("label contrast color", () => {
    it("chooses black text on a light 6-digit label color", () => {
      const { container } = render(<CustomFileIcon label="X" labelColor="#ffffff" />);
      expect(textFill(container)).toBe("#000000");
    });

    it("chooses white text on a dark 6-digit label color", () => {
      const { container } = render(<CustomFileIcon label="X" labelColor="#000000" />);
      expect(textFill(container)).toBe("#ffffff");
    });

    it("expands and evaluates 3-digit hex label colors", () => {
      const { container } = render(<CustomFileIcon label="X" labelColor="#fff" />);
      expect(textFill(container)).toBe("#000000");
    });

    it("falls back to black text when the label color is not a hex value", () => {
      const { container } = render(<CustomFileIcon label="X" labelColor="currentColor" />);
      expect(textFill(container)).toBe("#000000");
    });

    it("honors an explicit textColor override for both label and badge", () => {
      const { container } = render(
        <CustomFileIcon label="X" language="en" textColor="#123456" labelColor="#ffffff" />,
      );
      expect(textFill(container, 0)).toBe("#123456");
      expect(textFill(container, 1)).toBe("#123456");
    });
  });

  describe("language badge", () => {
    it("omits the badge when no language is provided", () => {
      const { container } = render(<CustomFileIcon label="SDS" />);
      expect(container.querySelectorAll("text")).toHaveLength(1);
    });

    it("renders an uppercased badge when a language is provided", () => {
      const { container } = render(<CustomFileIcon label="SDS" language="en" />);
      const texts = container.querySelectorAll("text");
      expect(texts).toHaveLength(2);
      expect(texts[1].textContent).toBe("EN");
    });
  });

  it("applies document, label, and outline color overrides", () => {
    const { container } = render(
      <CustomFileIcon
        label="X"
        documentColor="#112233"
        labelColor="#445566"
        outlineColor="#778899"
      />,
    );
    expect(container.querySelector("path")).toHaveAttribute("fill", "#112233");
    expect(container.querySelector("rect")).toHaveAttribute("fill", "#445566");
    expect(container.querySelector("g")).toHaveAttribute("stroke", "#778899");
  });
});
