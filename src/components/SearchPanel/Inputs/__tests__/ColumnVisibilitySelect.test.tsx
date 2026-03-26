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

  const mockColumnVisibility = ["id", "name"];
  const mockHandleColumnVisibilityChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct options", () => {
    render(
      <ColumnVisibilitySelect
        columnNames={mockColumnNames}
        columnVisibility={mockColumnVisibility}
        handleColumnVisibilityChange={mockHandleColumnVisibilityChange}
      />,
    );

    // Check that all column names are rendered as list items
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
    expect(screen.getByText("Quantity")).toBeInTheDocument();
    // Defaults option should also be present
    expect(screen.getByText("Defaults")).toBeInTheDocument();
  });

  it("shows checked checkboxes for visible columns", () => {
    render(
      <ColumnVisibilitySelect
        columnNames={mockColumnNames}
        columnVisibility={mockColumnVisibility}
        handleColumnVisibilityChange={mockHandleColumnVisibilityChange}
      />,
    );

    // Visible columns should have checked checkboxes
    const idCheckbox = screen.getByRole("checkbox", { name: "ID" });
    const nameCheckbox = screen.getByRole("checkbox", { name: "Name" });
    expect(idCheckbox).toBeChecked();
    expect(nameCheckbox).toBeChecked();

    // Non-visible columns should be unchecked
    const priceCheckbox = screen.getByRole("checkbox", { name: "Price" });
    const quantityCheckbox = screen.getByRole("checkbox", { name: "Quantity" });
    expect(priceCheckbox).not.toBeChecked();
    expect(quantityCheckbox).not.toBeChecked();
  });

  it("calls handleColumnVisibilityChange when clicking a column", () => {
    render(
      <ColumnVisibilitySelect
        columnNames={mockColumnNames}
        columnVisibility={mockColumnVisibility}
        handleColumnVisibilityChange={mockHandleColumnVisibilityChange}
      />,
    );

    // Click on "Price" to toggle it
    fireEvent.click(screen.getByText("Price"));

    expect(mockHandleColumnVisibilityChange).toHaveBeenCalledTimes(1);
    const event = mockHandleColumnVisibilityChange.mock.calls[0][0];
    expect(event.target.value).toContain("price");
  });

  it("handles empty column names", () => {
    render(
      <ColumnVisibilitySelect
        columnNames={{}}
        columnVisibility={[]}
        handleColumnVisibilityChange={mockHandleColumnVisibilityChange}
      />,
    );

    // Only the "Defaults" item should be rendered
    expect(screen.getByText("Defaults")).toBeInTheDocument();
    expect(screen.queryByText("ID")).not.toBeInTheDocument();
  });

  it("handles empty column visibility", () => {
    render(
      <ColumnVisibilitySelect
        columnNames={mockColumnNames}
        columnVisibility={[]}
        handleColumnVisibilityChange={mockHandleColumnVisibilityChange}
      />,
    );

    // All column checkboxes should be unchecked
    const idCheckbox = screen.getByRole("checkbox", { name: "ID" });
    const nameCheckbox = screen.getByRole("checkbox", { name: "Name" });
    const priceCheckbox = screen.getByRole("checkbox", { name: "Price" });
    const quantityCheckbox = screen.getByRole("checkbox", { name: "Quantity" });
    expect(idCheckbox).not.toBeChecked();
    expect(nameCheckbox).not.toBeChecked();
    expect(priceCheckbox).not.toBeChecked();
    expect(quantityCheckbox).not.toBeChecked();
  });
});
