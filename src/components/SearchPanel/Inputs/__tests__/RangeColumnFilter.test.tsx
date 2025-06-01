import type { FilterVariantInputProps } from "@/types/props";
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

  it("renders with correct label and initial range", () => {
    render(
      <RangeColumnFilter column={mockColumn as unknown as FilterVariantInputProps["column"]} />,
    );

    expect(screen.getByText("Test Column")).toBeInTheDocument();

    // Get both slider thumbs using data-index
    const sliders = screen.getAllByRole("slider", { name: "Test Column range" });
    const minSlider = sliders[0];
    const maxSlider = sliders[1];

    expect(minSlider).toBeInTheDocument();
    expect(maxSlider).toBeInTheDocument();
    expect(minSlider).toHaveAttribute("aria-valuenow", "0");
    expect(maxSlider).toHaveAttribute("aria-valuenow", "100");
  });

  it("updates filter value when range changes", () => {
    render(
      <RangeColumnFilter column={mockColumn as unknown as FilterVariantInputProps["column"]} />,
    );

    const sliders = screen.getAllByRole("slider", { name: "Test Column range" });
    const minSlider = sliders[0];
    fireEvent.change(minSlider, { target: { value: 25 } });

    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith([25, 100]);
  });

  it("resets to full range when min/max labels are clicked", () => {
    render(
      <RangeColumnFilter column={mockColumn as unknown as FilterVariantInputProps["column"]} />,
    );

    // First set a custom range
    const sliders = screen.getAllByRole("slider", { name: "Test Column range" });
    const minSlider = sliders[0];
    fireEvent.change(minSlider, { target: { value: 25 } });

    // Then click the min label to reset
    const minLabel = screen.getByText("0");
    fireEvent.click(minLabel);

    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith([0, 100]);

    // Reset mocks to test max label
    vi.clearAllMocks();

    // Click the max label to reset
    const maxLabel = screen.getByText("100");
    fireEvent.click(maxLabel);

    expect(mockColumn.setFilterValueDebounced).toHaveBeenCalledWith([0, 100]);
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
    const minSlider = sliders[0];
    const maxSlider = sliders[1];

    expect(minSlider).toHaveAttribute("aria-valuenow", "25");
    expect(maxSlider).toHaveAttribute("aria-valuenow", "75");
  });
});
