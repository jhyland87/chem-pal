import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AboutModal from "../AboutModal";

describe("AboutModal", () => {
  const mockSetAboutOpen = vi.fn();

  beforeEach(() => {
    mockSetAboutOpen.mockClear();
  });

  it("renders modal when aboutOpen is true", () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    expect(screen.getByText("About ChemPal")).toBeInTheDocument();
    expect(
      screen.getByText(/Open source project aimed at helping amateur chemistry hobbyists/),
    ).toBeInTheDocument();
    expect(screen.getByText("Contributors")).toBeInTheDocument();
  });

  it("does not render modal when aboutOpen is false", () => {
    render(<AboutModal aboutOpen={false} setAboutOpen={mockSetAboutOpen} />);

    expect(screen.queryByText("About ChemPal")).not.toBeInTheDocument();
  });

  it("calls setAboutOpen when clicking outside the modal", () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    const modal = screen.getByTestId("about-modal");
    fireEvent.click(modal);

    expect(mockSetAboutOpen).toHaveBeenCalledWith(false);
  });

  it("renders all contributor links with correct hrefs", () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    const justinLink = screen.getByText("Justin Hyland").closest("a");
    const mauiLink = screen.getByText("Maui3").closest("a");
    const spousLink = screen.getByText("Spous").closest("a");

    expect(justinLink).toHaveAttribute("href", "https://github.com/jhyland87");
    expect(mauiLink).toHaveAttribute("href", "https://github.com/YourHeatingMantle");
    expect(spousLink).toHaveAttribute("href", "https://github.com/spous");
  });

  it("renders GitHub link with correct attributes", () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    const githubButton = screen.getByTestId("github-button");
    expect(githubButton).toHaveAttribute("href", "https://github.com/justinhyland/chem-pal");
    expect(githubButton).toHaveAttribute("target", "_blank");
    expect(githubButton).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("has correct ARIA attributes", () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    const modal = screen.getByTestId("about-modal");
    expect(modal).toHaveAttribute("aria-labelledby", "application-title");
    expect(modal).toHaveAttribute("aria-describedby", "application-description");
  });
});
