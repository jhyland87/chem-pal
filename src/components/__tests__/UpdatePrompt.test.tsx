import { UpdatePrompt } from "@/components/UpdatePrompt";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import type { UpdateNotice } from "@/hooks/useUpdateAvailable";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const NOTES = [{ title: "Added", items: ["Options page", "Advanced mode"] }];

/** A manual-install notice, with no release notes unless overridden. */
const MANUAL: UpdateNotice = {
  version: "1.3.0",
  source: "manual",
  releaseUrl: "https://example.com/v1.3.0",
  notes: [],
};
const WEBSTORE: UpdateNotice = { version: "1.3.0", source: "webstore", notes: [] };

describe("UpdatePrompt", () => {
  it("renders nothing when there is no update", () => {
    render(<UpdatePrompt notice={undefined} onDismiss={vi.fn()} onApply={vi.fn()} />);
    expect(screen.queryByTestId("update-snackbar")).not.toBeInTheDocument();
  });

  // Asserts the version reaches the message, not the exact wording — the copy
  // lives in _locales and is free to change.
  it("shows the version in the message", () => {
    render(<UpdatePrompt notice={MANUAL} onDismiss={vi.fn()} onApply={vi.fn()} />);
    expect(screen.getByTestId("update-snackbar")).toHaveTextContent("1.3.0");
  });

  it("offers the release page for manual installs", () => {
    render(<UpdatePrompt notice={MANUAL} onDismiss={vi.fn()} onApply={vi.fn()} />);
    expect(screen.getByTestId("update-apply")).toHaveTextContent("View release");
  });

  it("offers a reload for web store installs", () => {
    render(<UpdatePrompt notice={WEBSTORE} onDismiss={vi.fn()} onApply={vi.fn()} />);
    expect(screen.getByTestId("update-apply")).toHaveTextContent("Reload now");
  });

  it("calls onApply when the action is clicked", () => {
    const onApply = vi.fn();
    render(<UpdatePrompt notice={MANUAL} onDismiss={vi.fn()} onApply={onApply} />);
    fireEvent.click(screen.getByTestId("update-apply"));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  // The dismiss control has to be composed into `action`, since MUI's Alert
  // drops its built-in close button as soon as `action` is set.
  it("calls onDismiss when the close button is clicked", () => {
    const onDismiss = vi.fn();
    render(<UpdatePrompt notice={MANUAL} onDismiss={onDismiss} onApply={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  describe("with release notes", () => {
    const withNotes: UpdateNotice = { ...MANUAL, notes: NOTES };

    it("offers What's new instead of the direct action", () => {
      render(<UpdatePrompt notice={withNotes} onDismiss={vi.fn()} onApply={vi.fn()} />);
      expect(screen.getByTestId("update-apply")).toHaveTextContent("What's new");
    });

    it("opens the modal with the notes rather than applying immediately", () => {
      const onApply = vi.fn();
      render(<UpdatePrompt notice={withNotes} onDismiss={vi.fn()} onApply={onApply} />);

      expect(screen.queryByTestId("whats-new-modal")).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId("update-apply"));

      expect(screen.getByTestId("whats-new-modal")).toBeInTheDocument();
      expect(screen.getByText("Added")).toBeInTheDocument();
      expect(screen.getByText("Options page")).toBeInTheDocument();
      expect(screen.getByText("Advanced mode")).toBeInTheDocument();
      // Opening the notes must not trigger the update itself.
      expect(onApply).not.toHaveBeenCalled();
    });

    it("applies from the modal's call to action", () => {
      const onApply = vi.fn();
      render(<UpdatePrompt notice={withNotes} onDismiss={vi.fn()} onApply={onApply} />);
      fireEvent.click(screen.getByTestId("update-apply"));

      fireEvent.click(screen.getByTestId("whats-new-apply"));

      expect(onApply).toHaveBeenCalledTimes(1);
    });

    it("closes the modal without applying on Later", () => {
      const onApply = vi.fn();
      render(<UpdatePrompt notice={withNotes} onDismiss={vi.fn()} onApply={onApply} />);
      fireEvent.click(screen.getByTestId("update-apply"));

      fireEvent.click(screen.getByTestId("whats-new-close"));

      expect(screen.queryByTestId("whats-new-modal")).not.toBeInTheDocument();
      expect(onApply).not.toHaveBeenCalled();
    });

    // Two notices about the same update stacked on screen at once reads as a bug.
    // The node lingers through MUI's exit transition, so this waits it out
    // rather than asserting on the frame right after the click.
    it("hides the snackbar while the modal is open", async () => {
      render(<UpdatePrompt notice={withNotes} onDismiss={vi.fn()} onApply={vi.fn()} />);
      expect(screen.getByTestId("update-snackbar")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("update-apply"));

      expect(screen.getByTestId("whats-new-modal")).toBeInTheDocument();
      await waitForElementToBeRemoved(() => screen.queryByTestId("update-snackbar"));
    });

    // "Later" means stop showing this now — re-opening the snackbar behind the
    // closing modal reads as the prompt refusing to go away.
    it("keeps the snackbar closed after Later", async () => {
      render(<UpdatePrompt notice={withNotes} onDismiss={vi.fn()} onApply={vi.fn()} />);
      fireEvent.click(screen.getByTestId("update-apply"));
      await waitForElementToBeRemoved(() => screen.queryByTestId("update-snackbar"));

      fireEvent.click(screen.getByTestId("whats-new-close"));

      await waitFor(() => expect(screen.queryByTestId("whats-new-modal")).not.toBeInTheDocument());
      expect(screen.queryByTestId("update-snackbar")).not.toBeInTheDocument();
    });

    // …but it is not a dismissal: nothing is persisted, so the same update still
    // prompts on the next open.
    it("does not record a dismissal on Later", async () => {
      const onDismiss = vi.fn();
      render(<UpdatePrompt notice={withNotes} onDismiss={onDismiss} onApply={vi.fn()} />);
      fireEvent.click(screen.getByTestId("update-apply"));

      fireEvent.click(screen.getByTestId("whats-new-close"));

      await waitFor(() => expect(screen.queryByTestId("whats-new-modal")).not.toBeInTheDocument());
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("labels the modal action per install source", () => {
      const { unmount } = render(
        <UpdatePrompt notice={withNotes} onDismiss={vi.fn()} onApply={vi.fn()} />,
      );
      fireEvent.click(screen.getByTestId("update-apply"));
      expect(screen.getByTestId("whats-new-apply")).toHaveTextContent("View release");
      unmount();

      render(
        <UpdatePrompt
          notice={{ ...WEBSTORE, notes: NOTES }}
          onDismiss={vi.fn()}
          onApply={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByTestId("update-apply"));
      expect(screen.getByTestId("whats-new-apply")).toHaveTextContent("Reload now");
    });

    it("explains when notes could not be loaded", () => {
      // No notes → the snackbar acts directly, so the modal never opens and the
      // empty state is only reachable if a caller renders it itself.
      render(<WhatsNewModalHarness />);
      expect(screen.getByTestId("whats-new-empty")).toHaveTextContent(
        "Release notes couldn't be loaded.",
      );
    });
  });
});

/** Renders the modal directly to cover its notes-unavailable branch. */
function WhatsNewModalHarness() {
  return <WhatsNewModal notice={MANUAL} open onClose={vi.fn()} onApply={vi.fn()} />;
}
