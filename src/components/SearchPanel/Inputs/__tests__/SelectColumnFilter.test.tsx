import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import SelectColumnFilter from "../SelectColumnFilter";

// Mock the column object that would be passed as props
const mockColumn = {
  id: "testColumn",
  getHeaderText: () => "Test Column",
  getFilterValue: () => [],
  getAllUniqueValues: () => ["Option 1", "Option 2", "Option 3"],
  setFilterValueDebounced: vi.fn(),
};

beforeAll(() => {
  setupChromeStorageMock();
});

afterAll(() => {
  resetChromeStorageMock();
});
describe("SelectColumnFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct options", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 3")).toBeInTheDocument();
  });

  it("shows all options as checkboxes", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    // All should be unchecked initially
    checkboxes.forEach((cb) => expect(cb).not.toBeChecked());
  });

  it("updates filter value when an option is clicked", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    fireEvent.click(screen.getByText("Option 1"));

    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith(["Option 1"]);
  });

  it("handles multiple selections", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    fireEvent.click(screen.getByText("Option 1"));
    fireEvent.click(screen.getByText("Option 2"));

    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith(["Option 1", "Option 2"]);
  });

  it("initializes with existing filter value", () => {
    const columnWithValue = {
      ...mockColumn,
      getFilterValue: () => ["Option 1", "Option 2"],
    };

    render(<SelectColumnFilter column={columnWithValue} />);

    // Checkboxes for pre-selected options should be checked
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]).toBeChecked(); // Option 1
    expect(checkboxes[1]).toBeChecked(); // Option 2
    expect(checkboxes[2]).not.toBeChecked(); // Option 3
  });

  it("shows 'No Options Available' when there are no options", () => {
    const columnWithNoOptions = {
      ...mockColumn,
      getAllUniqueValues: () => [],
    };

    render(<SelectColumnFilter column={columnWithNoOptions} />);

    expect(screen.getByText("No Options Available")).toBeInTheDocument();
  });
});
