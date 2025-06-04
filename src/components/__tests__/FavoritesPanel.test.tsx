import { GridColDef } from "@mui/x-data-grid";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FavoritesPanel from "../FavoritesPanel";

// Mock the DataGrid component since it's complex and we don't need to test its internals
vi.mock("@mui/x-data-grid", () => ({
  DataGrid: vi.fn(
    ({
      rows,
      columns,
      initialState,
      pageSizeOptions,
      checkboxSelection,
    }: {
      rows: any[];
      columns: GridColDef[];
      initialState: { pagination: { paginationModel: { pageSize: number } } };
      pageSizeOptions: number[];
      checkboxSelection: boolean;
    }) => (
      <div data-testid="mock-data-grid">
        <div data-testid="row-count">{rows.length}</div>
        <div data-testid="column-count">{columns.length}</div>
        <div data-testid="page-size">{initialState.pagination.paginationModel.pageSize}</div>
        <div data-testid="has-checkbox">{checkboxSelection ? "true" : "false"}</div>
        <div data-testid="page-size-options">{pageSizeOptions.join(",")}</div>
      </div>
    ),
  ),
}));

describe("FavoritesPanel", () => {
  it("renders without crashing", () => {
    render(<FavoritesPanel />);
    expect(screen.getByTestId("mock-data-grid")).toBeInTheDocument();
  });

  it("renders DataGrid with correct props", () => {
    render(<FavoritesPanel />);

    // Check row count
    expect(screen.getByTestId("row-count")).toHaveTextContent("9");

    // Check column count
    expect(screen.getByTestId("column-count")).toHaveTextContent("5");

    // Check page size
    expect(screen.getByTestId("page-size")).toHaveTextContent("5");

    // Check checkbox selection
    expect(screen.getByTestId("has-checkbox")).toHaveTextContent("true");

    // Check page size options
    expect(screen.getByTestId("page-size-options")).toHaveTextContent("5,10");
  });

  it("renders Paper component with correct styles", () => {
    render(<FavoritesPanel />);
    const paper = screen.getByTestId("mock-data-grid").parentElement;
    expect(paper).toHaveClass("MuiPaper-root");
    expect(paper).toHaveStyle({
      height: "400px",
      width: "100%",
    });
  });
});
