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

  it("renders with correct label", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    const select = screen.getByLabelText("Test Column");
    expect(select).toBeInTheDocument();
  });

  it("shows options when clicked", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    const select = screen.getByLabelText("Test Column");
    fireEvent.mouseDown(select);

    // Now the options should be visible
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 3")).toBeInTheDocument();
  });

  it("updates filter value when options are selected", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    const select = screen.getByLabelText("Test Column");
    fireEvent.mouseDown(select);

    const option1 = screen.getByText("Option 1");
    fireEvent.click(option1);

    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith(["Option 1"]);
  });

  it("handles multiple selections", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    const select = screen.getByLabelText("Test Column");
    fireEvent.mouseDown(select);

    const option1 = screen.getByText("Option 1");
    const option2 = screen.getByText("Option 2");
    fireEvent.click(option1);
    fireEvent.click(option2);

    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith(["Option 1", "Option 2"]);
  });

  it("initializes with existing filter value", () => {
    const columnWithValue = {
      ...mockColumn,
      getFilterValue: () => {
        return ["Option 1", "Option 2"];
      },
    };

    render(<SelectColumnFilter column={columnWithValue} />);

    const select = screen.getByLabelText("Test Column");
    // Open the select to see the selected values
    fireEvent.mouseDown(select);

    // Check that the options are selected by their style
    const option1 = screen.getByText("Option 1");
    const option2 = screen.getByText("Option 2");

    // Material-UI uses fontWeight to indicate selection
    expect(option1).toHaveStyle({ fontWeight: "500" }); // Medium weight for selected
    expect(option2).toHaveStyle({ fontWeight: "500" }); // Medium weight for selected
  });

  it("shows 'No Options Available' when there are no options", () => {
    const columnWithNoOptions = {
      ...mockColumn,
      getAllUniqueValues: () => [],
    };

    render(<SelectColumnFilter column={columnWithNoOptions} />);

    const select = screen.getByLabelText("Test Column");
    fireEvent.mouseDown(select);

    expect(screen.getByText("No Options Available")).toBeInTheDocument();
  });
});
