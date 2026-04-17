import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import SelectColumnFilter from "../SelectColumnFilter";

const mockColumn = {
  id: "testColumn",
  getHeaderText: () => "Test Column",
  getFilterValue: () => [],
  getAllUniqueValues: () => ["Option 1", "Option 2", "Option 3"],
  setFilterValueDebounced: vi.fn(),
  columnDef: { meta: {} },
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

  it("renders a combobox labelled with the column header", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    expect(screen.getByRole("combobox", { name: "Test Column" })).toBeInTheDocument();
  });

  it("shows all unique values as options when the dropdown opens", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Test Column" }));
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Option 1")).toBeInTheDocument();
    expect(within(listbox).getByText("Option 2")).toBeInTheDocument();
    expect(within(listbox).getByText("Option 3")).toBeInTheDocument();
  });

  it("updates filter value when an option is selected", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Test Column" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Option 1"));

    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith(["Option 1"]);
  });

  it("accumulates selections across multiple picks", () => {
    render(<SelectColumnFilter column={mockColumn} />);

    // MUI Select with `multiple` keeps the menu open after each click, so we
    // only open it once and then click two options in sequence.
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Test Column" }));
    const listbox = screen.getByRole("listbox");
    fireEvent.click(within(listbox).getByText("Option 1"));
    fireEvent.click(within(listbox).getByText("Option 2"));

    expect(mockColumn.setFilterValueDebounced).toHaveBeenLastCalledWith(["Option 1", "Option 2"]);
  });

  it("renders pre-selected values as comma-separated text", () => {
    const columnWithValue = {
      ...mockColumn,
      getFilterValue: () => ["Option 1", "Option 2"],
    };

    render(<SelectColumnFilter column={columnWithValue} />);

    expect(screen.getByText("Option 1, Option 2")).toBeInTheDocument();
  });

  it("disables the control when there are no options", () => {
    const columnWithNoOptions = {
      ...mockColumn,
      getAllUniqueValues: () => [],
    };

    render(<SelectColumnFilter column={columnWithNoOptions} />);

    const combobox = screen.getByRole("combobox", { name: "Test Column" });
    expect(combobox).toHaveAttribute("aria-disabled", "true");
  });
});
