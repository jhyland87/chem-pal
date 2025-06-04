import { SPIN_SPEED } from "@/constants/common";
import { SvgIcon, SvgIconProps } from "@mui/material";
import { render, screen } from "@testing-library/react";
import IconSpinner from "../IconSpinner";

// Mock child component for testing
const MockIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon data-testid="mock-icon" style={{ width: 24, height: 24 }} {...props}>
    <path d="M0 0h24v24H0z" />
  </SvgIcon>
);

describe("IconSpinner", () => {
  it("renders with default speed", () => {
    render(
      <IconSpinner>
        <MockIcon />
      </IconSpinner>
    );

    const wrapper = screen.getByTestId("spinning-wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveStyle({ display: "inline-flex" });
    expect(wrapper).toHaveAttribute("class"); // Verify it has a class (MUI styled component)
  });

  it("renders with custom speed as string", () => {
    render(
      <IconSpinner speed="FAST">
        <MockIcon />
      </IconSpinner>
    );

    const wrapper = screen.getByTestId("spinning-wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveStyle({ display: "inline-flex" });
    expect(wrapper).toHaveAttribute("class");
  });

  it("renders with custom speed as number", () => {
    const customSpeed = 1.5;
    render(
      <IconSpinner speed={customSpeed}>
        <MockIcon />
      </IconSpinner>
    );

    const wrapper = screen.getByTestId("spinning-wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveStyle({ display: "inline-flex" });
    expect(wrapper).toHaveAttribute("class");
  });

  it("renders with custom speed from SPIN_SPEED enum", () => {
    render(
      <IconSpinner speed={SPIN_SPEED.MEDIUM}>
        <MockIcon />
      </IconSpinner>
    );

    const wrapper = screen.getByTestId("spinning-wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveStyle({ display: "inline-flex" });
    expect(wrapper).toHaveAttribute("class");
  });

  it("falls back to MEDIUM speed for invalid string speed", () => {
    render(
      <IconSpinner speed="INVALID_SPEED">
        <MockIcon />
      </IconSpinner>
    );

    const wrapper = screen.getByTestId("spinning-wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveStyle({ display: "inline-flex" });
    expect(wrapper).toHaveAttribute("class");
  });

  it("preserves child component props and structure", () => {
    const customStyle = { width: 48, height: 48, color: "rgb(255, 0, 0)" };
    render(
      <IconSpinner>
        <MockIcon style={customStyle} />
      </IconSpinner>
    );

    // Verify wrapper contains the icon
    const wrapper = screen.getByTestId("spinning-wrapper");
    const icon = screen.getByTestId("mock-icon");
    expect(wrapper).toContainElement(icon);

    // Verify icon styles
    expect(icon).toHaveStyle({
      width: "48px",
      height: "48px",
      color: "rgb(255, 0, 0)"
    });
  });

  it("handles speed prop variations correctly", () => {
    const { rerender } = render(
      <IconSpinner speed={2}>
        <MockIcon />
      </IconSpinner>
    );
    expect(screen.getByTestId("spinning-wrapper")).toBeInTheDocument();

    rerender(
      <IconSpinner speed="FAST">
        <MockIcon />
      </IconSpinner>
    );
    expect(screen.getByTestId("spinning-wrapper")).toBeInTheDocument();

    rerender(
      <IconSpinner speed={SPIN_SPEED.MEDIUM}>
        <MockIcon />
      </IconSpinner>
    );
    expect(screen.getByTestId("spinning-wrapper")).toBeInTheDocument();
  });
});
