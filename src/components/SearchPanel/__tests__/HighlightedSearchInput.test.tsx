import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HighlightedSearchInput from "../HighlightedSearchInput";

describe("HighlightedSearchInput", () => {
  it("renders the value and reports changes", () => {
    const onChange = vi.fn();
    render(<HighlightedSearchInput value="acetone" onChange={onChange} ariaLabel="Search" />);

    const input = screen.getByRole("textbox", { name: "Search" });
    expect(input).toHaveValue("acetone");

    fireEvent.change(input, { target: { value: "acetonex" } });
    expect(onChange).toHaveBeenCalledWith("acetonex");
  });

  it("reports a plain query as valid (not blocked)", () => {
    const onValidityChange = vi.fn();
    render(
      <HighlightedSearchInput value="sodium" onChange={() => {}} onValidityChange={onValidityChange} />,
    );
    expect(onValidityChange).toHaveBeenLastCalledWith(false, undefined);
  });

  it("renders a colored backdrop for a valid advanced query", () => {
    const { container } = render(
      <HighlightedSearchInput value="sodium AND chloride" onChange={() => {}} />,
    );
    expect(container.querySelector(".hl-keyword")?.textContent).toBe("AND");
  });

  it("blocks an advanced query with no inclusive term", () => {
    const onValidityChange = vi.fn();
    render(
      <HighlightedSearchInput
        value="NOT foo AND NOT bar"
        onChange={() => {}}
        onValidityChange={onValidityChange}
      />,
    );
    const [blocked, message] = onValidityChange.mock.calls.at(-1) ?? [];
    expect(blocked).toBe(true);
    expect(message).toMatch(/at least one term/i);
  });

  it("blocks an advanced query with unbalanced parentheses", () => {
    const onValidityChange = vi.fn();
    render(
      <HighlightedSearchInput
        value="sodium AND (chloride"
        onChange={() => {}}
        onValidityChange={onValidityChange}
      />,
    );
    const [blocked, message] = onValidityChange.mock.calls.at(-1) ?? [];
    expect(blocked).toBe(true);
    expect(message).toMatch(/parenthes/i);
  });
});
