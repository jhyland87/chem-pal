import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HotkeyHelpModal from "../HotkeyHelpModal";
import { getHotkeyConfigs } from "../useHotkeys";

describe("HotkeyHelpModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it("does not render content when closed", () => {
    render(<HotkeyHelpModal open={false} onClose={onClose} />);
    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeInTheDocument();
  });

  it("renders the title and grouped tabs when open", () => {
    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();

    // Every distinct group in config.json should appear as a tab.
    const groups = new Set(getHotkeyConfigs().map((c) => c.group || "General"));
    for (const group of groups) {
      expect(screen.getAllByRole("tab", { name: group }).length).toBeGreaterThan(0);
    }
  });

  it("shows the descriptions for the first group's entries", () => {
    const configs = getHotkeyConfigs();
    const firstGroup = configs[0].group || "General";
    const firstGroupEntries = configs.filter((c) => (c.group || "General") === firstGroup);

    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    for (const entry of firstGroupEntries) {
      expect(screen.getByText(entry.description)).toBeInTheDocument();
    }
  });

  it("switches the visible entries when a different tab is selected", () => {
    const configs = getHotkeyConfigs();
    const groups = Array.from(new Set(configs.map((c) => c.group || "General")));
    // Need at least two groups to exercise the tab switch.
    expect(groups.length).toBeGreaterThan(1);

    const otherGroup = groups[1];
    const otherEntry = configs.find((c) => (c.group || "General") === otherGroup)!;

    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    // Initially the second group's entry is not shown.
    expect(screen.queryByText(otherEntry.description)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: otherGroup }));

    expect(screen.getByText(otherEntry.description)).toBeInTheDocument();
  });

  it("renders formatted key combo chips for entries", () => {
    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    // shift+? in the General group -> chips "⇧" and "?" (non-mac would be "Shift"/"?").
    const modal = screen.getByTestId("hotkey-help-modal");
    // The "?" key label is always present regardless of platform.
    expect(within(modal).getByText("?")).toBeInTheDocument();
  });

  it("calls onClose when the backdrop is clicked", () => {
    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    const backdrop = document.querySelector(".MuiBackdrop-root");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose when clicking inside the modal body", () => {
    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByText("Keyboard Shortcuts"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("resets to the first tab each time it reopens", () => {
    const configs = getHotkeyConfigs();
    const groups = Array.from(new Set(configs.map((c) => c.group || "General")));
    const firstGroup = groups[0];
    const secondGroup = groups[1];
    const firstEntry = configs.find((c) => (c.group || "General") === firstGroup)!;

    const { rerender } = render(<HotkeyHelpModal open={true} onClose={onClose} />);

    // Move to the second tab.
    fireEvent.click(screen.getByRole("tab", { name: secondGroup }));

    // Close and reopen.
    rerender(<HotkeyHelpModal open={false} onClose={onClose} />);
    rerender(<HotkeyHelpModal open={true} onClose={onClose} />);

    // Back on the first group's entries.
    expect(screen.getByText(firstEntry.description)).toBeInTheDocument();
  });
});
