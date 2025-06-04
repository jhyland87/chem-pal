import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  restoreChromeTabsMock,
  setupChromeTabsMock,
} from "../../__fixtures__/helpers/chrome/tabsMock";
import TabLink from "../TabLink";

describe("TabLink", () => {
  const mockHref = "https://example.com";
  const mockText = "Test Link";

  beforeEach(() => {
    setupChromeTabsMock();
    // Use vi.stubGlobal instead of direct property assignment
    vi.stubGlobal(
      "open",
      vi.fn().mockImplementation(() => ({
        closed: false,
        close: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    restoreChromeTabsMock();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders link with correct href and text", () => {
    render(<TabLink href={mockHref}>{mockText}</TabLink>);

    const link = screen.getByText(mockText);
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", mockHref);
  });

  it("opens link in new tab when clicked in regular browser environment", () => {
    // Remove chrome API to simulate regular browser
    vi.stubGlobal("chrome", undefined);

    render(<TabLink href={mockHref}>{mockText}</TabLink>);

    const link = screen.getByText(mockText);
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    Object.defineProperty(clickEvent, "target", {
      value: link,
      writable: false,
    });

    link.dispatchEvent(clickEvent);

    // The href will include a trailing slash in the actual browser
    expect(window.open).toHaveBeenCalledWith("https://example.com/", "_blank");
  });

  it("opens link in new tab using chrome.tabs.create when in extension environment", async () => {
    render(<TabLink href={mockHref}>{mockText}</TabLink>);

    const link = screen.getByText(mockText);
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    Object.defineProperty(clickEvent, "target", {
      value: link,
      writable: false,
    });

    link.dispatchEvent(clickEvent);

    // The href will include a trailing slash in the actual browser
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://example.com/",
      active: false,
    });
    expect(window.open).not.toHaveBeenCalled();
  });

  it("prevents default link behavior", () => {
    render(<TabLink href={mockHref}>{mockText}</TabLink>);

    const link = screen.getByText(mockText);
    const preventDefault = vi.fn();

    // Create a proper event object with preventDefault
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    Object.defineProperty(clickEvent, "preventDefault", {
      value: preventDefault,
      writable: false,
    });
    Object.defineProperty(clickEvent, "target", {
      value: link,
      writable: false,
    });

    link.dispatchEvent(clickEvent);

    expect(preventDefault).toHaveBeenCalled();
  });

  it("passes additional props to the Link component", () => {
    const testId = "test-link";
    render(
      <TabLink href={mockHref} data-testid={testId}>
        {mockText}
      </TabLink>,
    );

    const link = screen.getByTestId(testId);
    expect(link).toBeInTheDocument();
  });
});
