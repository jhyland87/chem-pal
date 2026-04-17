import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RangeColumnFilter from "../RangeColumnFilter";

// Mock column object
const mockColumn = {
  id: "test-column",
  getHeaderText: () => "Test Column",
  getFilterValue: vi.fn(() => [0, 100]),
  setFilterValueDebounced: vi.fn(),
  getFullRange: vi.fn(() => [0, 100]),
};

describe("RangeColumnFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders two slider thumbs at the column's full range", () => {
    render(
      <RangeColumnFilter column={mockColumn as unknown as FilterVariantInputProps["column"]} />,
    );

    const sliders = screen.getAllByRole("slider", { name: "Test Column range" });
    expect(sliders).toHaveLength(2);
    expect(sliders[0]).toHaveAttribute("aria-valuenow", "0");
    expect(sliders[1]).toHaveAttribute("aria-valuenow", "100");
  });

  it("updates filter value when the range changes", () => {
    render(
      <RangeColumnFilter column={mockColumn as unknown as FilterVariantInputProps["column"]} />,
    );

    const sliders = screen.getAllByRole("slider", { name: "Test Column range" });
    fireEvent.change(sliders[0], { target: { value: 25 } });

    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith([25, 100]);
  });

  it("initializes with existing filter value", () => {
    const columnWithValue = {
      ...mockColumn,
      getFilterValue: vi.fn(() => [25, 75]),
    };

    render(
      <RangeColumnFilter
        column={columnWithValue as unknown as FilterVariantInputProps["column"]}
      />,
    );

    const sliders = screen.getAllByRole("slider", { name: "Test Column range" });
    expect(sliders[0]).toHaveAttribute("aria-valuenow", "25");
    expect(sliders[1]).toHaveAttribute("aria-valuenow", "75");
  });
});
