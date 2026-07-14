import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TruncatedDescription } from "../TruncatedDescription";

const LONG = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

describe("TruncatedDescription", () => {
  it("renders short text without a toggle", () => {
    render(<TruncatedDescription text="short" limit={20} />);
    expect(screen.getByText("short")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing when there is no text", () => {
    const { container } = render(<TruncatedDescription text={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("truncates long text and toggles between [more] and [less]", () => {
    const { container } = render(<TruncatedDescription text={LONG} limit={10} />);

    // Collapsed: preview + ellipsis, tail hidden, "[more]" toggle shown.
    expect(container.textContent).toContain("0123456789…");
    expect(container.textContent).not.toContain("ABCDEFGHIJ");
    expect(screen.getByRole("button")).toHaveTextContent("more");

    // Expand: full text revealed, "[less]" toggle shown.
    fireEvent.click(screen.getByRole("button"));
    expect(container.textContent).toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(screen.getByRole("button")).toHaveTextContent("less");

    // Collapse: back to the truncated preview.
    fireEvent.click(screen.getByRole("button"));
    expect(container.textContent).not.toContain("ABCDEFGHIJ");
    expect(screen.getByRole("button")).toHaveTextContent("more");
  });
});
