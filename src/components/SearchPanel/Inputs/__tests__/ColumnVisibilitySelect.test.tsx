import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ColumnVisibilitySelect from "../ColumnVisibilitySelect";

describe("ColumnVisibilitySelect", () => {
  const mockColumnNames = {
    id: "ID",
    name: "Name",
    price: "Price",
    quantity: "Quantity",
  };

  const mockColumnVisibility = ["ID", "Name"];
  const mockHandleColumnVisibilityChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct label and options", () => {
    render(
      <ColumnVisibilitySelect
        columnNames={mockColumnNames}
        columnVisibility={mockColumnVisibility}
        handleColumnVisibilityChange={mockHandleColumnVisibilityChange}
      />,
    );

    // Check label
    expect(screen.getByLabelText("Column Visibility")).toBeInTheDocument();

    // Open select to see options
    const select = screen.getByRole("combobox", { name: "Column Visibility" });
    fireEvent.mouseDown(select);

    // Check all options are rendered
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
    expect(screen.getByText("Quantity")).toBeInTheDocument();
  });

  it("shows selected options with medium font weight", () => {
    render(
      <ColumnVisibilitySelect
        columnNames={mockColumnNames}
        columnVisibility={mockColumnVisibility}
        handleColumnVisibilityChange={mockHandleColumnVisibilityChange}
      />,
    );

    // Open select to see options
    const select = screen.getByRole("combobox", { name: "Column Visibility" });
    fireEvent.mouseDown(select);

    // Check selected options have medium font weight
    const selectedOption1 = screen.getByText("ID");
    const selectedOption2 = screen.getByText("Name");
    expect(selectedOption1).toHaveStyle({ fontWeight: "500" }); // Medium weight
    expect(selectedOption2).toHaveStyle({ fontWeight: "500" }); // Medium weight

    // Check unselected options have regular font weight
    const unselectedOption1 = screen.getByText("Price");
    const unselectedOption2 = screen.getByText("Quantity");
    expect(unselectedOption1).toHaveStyle({ fontWeight: "400" }); // Regular weight
    expect(unselectedOption2).toHaveStyle({ fontWeight: "400" }); // Regular weight
  });

  it("calls handleColumnVisibilityChange when selecting an option", () => {
    render(
      <ColumnVisibilitySelect
        columnNames={mockColumnNames}
        columnVisibility={mockColumnVisibility}
        handleColumnVisibilityChange={mockHandleColumnVisibilityChange}
      />,
    );

    // Open select
    const select = screen.getByRole("combobox", { name: "Column Visibility" });
    fireEvent.mouseDown(select);

    // Select an option
    const option = screen.getByText("Price");
    fireEvent.click(option);

    // Check that the handler was called with updated selection
    expect(mockHandleColumnVisibilityChange).toHaveBeenCalled();
    const event = mockHandleColumnVisibilityChange.mock.calls[0][0];
    expect(event.target.value).toContain("Price");
  });

  it("handles empty column names", () => {
    render(
      <ColumnVisibilitySelect
        columnNames={{}}
        columnVisibility={[]}
        handleColumnVisibilityChange={mockHandleColumnVisibilityChange}
      />,
    );

    // Open select
    const select = screen.getByRole("combobox", { name: "Column Visibility" });
    fireEvent.mouseDown(select);

    // Check that no options are rendered
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("handles empty column visibility", () => {
    render(
      <ColumnVisibilitySelect
        columnNames={mockColumnNames}
        columnVisibility={[]}
        handleColumnVisibilityChange={mockHandleColumnVisibilityChange}
      />,
    );

    // Open select
    const select = screen.getByRole("combobox", { name: "Column Visibility" });
    fireEvent.mouseDown(select);

    // Check all options have regular font weight (none selected)
    Object.values(mockColumnNames).forEach((name) => {
      const option = screen.getByText(name);
      expect(option).toHaveStyle({ fontWeight: "400" }); // Regular weight
    });
  });
});
