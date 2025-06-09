import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import CryptoPaymentIcon, { CryptoType } from "../CryptoPaymentIcon";

const types: CryptoType[] = ["bitcoin", "ethereum", "tether", "litecoin"];

describe("CryptoPaymentIcon", () => {
  test.each(types)("renders %s icon without crashing", (type) => {
    const { container } = render(<CryptoPaymentIcon type={type} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  test.each(types)("applies custom props for %s", (type) => {
    const { container } = render(
      <CryptoPaymentIcon
        type={type}
        data-testid="crypto-icon"
        width={42}
        className="custom-class"
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "42");
    expect(svg).toHaveClass("custom-class");
  });

  test.each(types)("shows tooltip for %s", async (type) => {
    render(<CryptoPaymentIcon type={type} />);
    const icon = screen.getByTestId(`crypto-icon-${type}`);
    await userEvent.hover(icon);
    expect(await screen.findByText(type)).toBeInTheDocument();
  });

  test("renders correct SVG content for each type", () => {
    types.forEach((type) => {
      const { container, unmount } = render(<CryptoPaymentIcon type={type} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      // Each icon type should have a unique color or shape
      if (type === "bitcoin") {
        expect(svg?.innerHTML).toContain("#F7931A");
      } else if (type === "ethereum") {
        expect(svg?.innerHTML).toContain("#627EEA");
      } else if (type === "tether") {
        expect(svg?.innerHTML).toContain("₮");
      } else if (type === "litecoin") {
        expect(svg?.innerHTML).toContain("Ł");
      }
      unmount();
    });
  });
});
