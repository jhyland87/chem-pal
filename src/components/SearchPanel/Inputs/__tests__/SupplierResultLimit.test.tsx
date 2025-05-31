import { useAppContext } from "@/context";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SupplierResultLimit from "../SupplierResultLimit";

// Mock the app context
const mockSetSettings = vi.fn();
const mockAppContext = {
  settings: {
    supplierResultLimit: 10,
  },
  setSettings: mockSetSettings,
};

// Mock the context
vi.mock("@/context", () => ({
  useAppContext: vi.fn(() => mockAppContext),
}));

describe("SupplierResultLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct label and initial value", () => {
    render(<SupplierResultLimit />);

    const input = screen.getByLabelText("Result Limit (per supplier)");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("10");
  });

  it("updates result limit when value changes", () => {
    render(<SupplierResultLimit />);

    const input = screen.getByLabelText("Result Limit (per supplier)");
    fireEvent.change(input, { target: { value: "20" } });

    expect(mockSetSettings).toHaveBeenCalledWith({
      ...mockAppContext.settings,
      supplierResultLimit: 20,
    });
  });

  it("handles invalid input", () => {
    render(<SupplierResultLimit />);

    const input = screen.getByLabelText("Result Limit (per supplier)");
    fireEvent.change(input, { target: { value: "invalid" } });

    expect(mockSetSettings).toHaveBeenCalledWith({
      ...mockAppContext.settings,
      supplierResultLimit: NaN,
    });
  });

  it("initializes with different value from context", () => {
    const differentContext = {
      ...mockAppContext,
      settings: {
        ...mockAppContext.settings,
        supplierResultLimit: 50,
      },
    };

    (useAppContext as ReturnType<typeof vi.fn>).mockReturnValue(differentContext);

    render(<SupplierResultLimit />);

    const input = screen.getByLabelText("Result Limit (per supplier)");
    expect(input).toHaveValue("50");
  });
});
