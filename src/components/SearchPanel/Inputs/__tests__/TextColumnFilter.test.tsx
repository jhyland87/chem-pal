import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TextColumnFilter from "../TextColumnFilter";

// Mock the column object that would be passed as props
const mockColumn = {
  id: "testColumn",
  getHeaderText: () => "Test Column",
  getFilterValue: () => "",
  setFilterValueDebounced: vi.fn(),
};

describe("TextColumnFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct label and initial value", () => {
    render(<TextColumnFilter column={mockColumn} />);

    const input = screen.getByLabelText("Test Column");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("updates filter value when text is entered", () => {
    render(<TextColumnFilter column={mockColumn} />);

    const input = screen.getByLabelText("Test Column");
    fireEvent.change(input, { target: { value: "test value" } });

    expect(input).toHaveValue("test value");
    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith("test value");
  });

  it("handles clearing input correctly", () => {
    render(<TextColumnFilter column={mockColumn} />);

    const input = screen.getByLabelText("Test Column");

    // First set a value to ensure we can test clearing it
    fireEvent.change(input, { target: { value: "test" } });
    expect(input).toHaveValue("test");
    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith("test");

    // Now clear the input
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");
    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith("");
  });

  it("initializes with existing filter value", () => {
    const columnWithValue = {
      ...mockColumn,
      getFilterValue: () => "initial value",
    };

    render(<TextColumnFilter column={columnWithValue} />);

    const input = screen.getByLabelText("Test Column");
    expect(input).toHaveValue("initial value");
  });

  it("updates filter value multiple times", () => {
    render(<TextColumnFilter column={mockColumn} />);

    const input = screen.getByLabelText("Test Column");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.change(input, { target: { value: "test value" } });

    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledTimes(2);
    expect(mockColumn.setFilterValueDebounced).toHaveBeenLastCalledWith("test value");
  });
});
