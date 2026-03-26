/**
 * Unit tests for the {@link StatsPanel} component.
 *
 * Validates the empty-state message, header rendering (back button, title,
 * call count), tab visibility (By Supplier / Daily / Totals), pie-chart
 * rendering with inner/outer rings, supplier legend display, clear-stats
 * button visibility, and singular/plural "call"/"calls" label formatting.
 *
 * @source
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import {
  setupChromeStorageMock,
  resetChromeStorageMock,
  restoreChromeStorageMock,
} from "../../__fixtures__/helpers/chrome/storageMock";

/**
 * Mock spy for {@link useAppContext().setPanel}, used to verify
 * navigation triggered by the back button.
 *
 * @source
 */
const mockSetPanel = vi.fn();
vi.mock("@/context", () => ({
  useAppContext: () => ({
    setPanel: mockSetPanel,
  }),
}));

/**
 * Lightweight mock for the MUI Delete icon to avoid file-descriptor
 * exhaustion caused by the `@mui/icons-material` barrel import.
 *
 * @source
 */
vi.mock("@mui/icons-material", () => ({
  Delete: vi.fn((props: any) => <span data-testid="DeleteIcon" {...props} />),
}));

/**
 * Mock replacement for `@mui/x-charts/PieChart`. Renders a plain `<div>`
 * that exposes the number of chart series via a `data-testid` attribute.
 *
 * @example
 * ```tsx
 * screen.getByTestId("pie-series-count"); // "2" for inner + outer ring
 * ```
 *
 * @source
 */
vi.mock("@mui/x-charts/PieChart", () => ({
  PieChart: vi.fn(({ series, children }: any) => (
    <div data-testid="mock-pie-chart">
      <div data-testid="pie-series-count">{series?.length ?? 0}</div>
      {children}
    </div>
  )),
}));

/**
 * Mock replacement for `@mui/x-charts/LineChart`. Renders a plain `<div>`
 * that exposes the number of line series via a `data-testid` attribute.
 *
 * @source
 */
vi.mock("@mui/x-charts/LineChart", () => ({
  LineChart: vi.fn(({ series }: any) => (
    <div data-testid="mock-line-chart">
      <div data-testid="line-series-count">{series?.length ?? 0}</div>
    </div>
  )),
}));

/**
 * Mock for `@mui/x-charts/hooks` returning a fixed drawing area so that
 * chart-dependent layout calculations do not throw in jsdom.
 *
 * @source
 */
vi.mock("@mui/x-charts/hooks", () => ({
  useDrawingArea: () => ({ width: 400, height: 300, left: 0, top: 0 }),
}));

/**
 * Mock replacement for `@mui/x-data-grid` DataGrid, exposing row and
 * column counts through `data-testid` attributes.
 *
 * @source
 */
vi.mock("@mui/x-data-grid", () => ({
  DataGrid: vi.fn(({ rows, columns }: any) => (
    <div data-testid="mock-data-grid">
      <div data-testid="grid-row-count">{rows?.length ?? 0}</div>
      <div data-testid="grid-column-count">{columns?.length ?? 0}</div>
    </div>
  )),
}));

/**
 * Mock for the {@link SupplierStatsStore} module, providing spies for
 * `getStats` and `clearStats` so tests can control resolved data.
 *
 * @source
 */
vi.mock("@/utils/SupplierStatsStore", () => ({
  getStats: vi.fn(),
  clearStats: vi.fn(),
}));

import { getStats, clearStats } from "@/utils/SupplierStatsStore";
import StatsPanel from "../StatsPanel";

/**
 * Typed reference to the mocked `getStats` function, allowing
 * `mockResolvedValue` calls in individual tests.
 *
 * @source
 */
const mockGetStats = getStats as ReturnType<typeof vi.fn>;

/**
 * Typed reference to the mocked `clearStats` function, allowing
 * `mockResolvedValue` calls in individual tests.
 *
 * @source
 */
const mockClearStats = clearStats as ReturnType<typeof vi.fn>;

describe("StatsPanel", () => {
  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
    mockSetPanel.mockClear();
    mockClearStats.mockResolvedValue(undefined);
  });

  afterAll(() => {
    restoreChromeStorageMock();
  });

  it("renders empty state when no stats exist", async () => {
    mockGetStats.mockResolvedValue({});

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("No stats yet. Run a search to start tracking.")).toBeInTheDocument();
    });
    expect(screen.getByText("0 calls")).toBeInTheDocument();
  });

  it("renders the header with back button and title", async () => {
    mockGetStats.mockResolvedValue({});

    render(<StatsPanel />);

    expect(screen.getByText("Supplier Stats")).toBeInTheDocument();
    expect(screen.getByLabelText("Back to search home")).toBeInTheDocument();
  });

  it("renders tabs when data exists", async () => {
    mockGetStats.mockResolvedValue({
      "2026-03-26": {
        Carolina: { searchQueryCount: 1, successCount: 5, failureCount: 0, uniqueProductCount: 3, parseErrorCount: 0 },
      },
    });

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("By Supplier")).toBeInTheDocument();
      expect(screen.getByText("Daily")).toBeInTheDocument();
      expect(screen.getByText("Totals")).toBeInTheDocument();
    });
  });

  it("displays total call count in header", async () => {
    mockGetStats.mockResolvedValue({
      "2026-03-26": {
        Carolina: { searchQueryCount: 1, successCount: 10, failureCount: 2, uniqueProductCount: 5, parseErrorCount: 0 },
        Ambeed: { searchQueryCount: 1, successCount: 3, failureCount: 0, uniqueProductCount: 2, parseErrorCount: 0 },
      },
    });

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("15 calls")).toBeInTheDocument();
    });
  });

  it("renders pie chart on By Supplier tab by default", async () => {
    mockGetStats.mockResolvedValue({
      "2026-03-26": {
        Carolina: { searchQueryCount: 1, successCount: 5, failureCount: 0, uniqueProductCount: 3, parseErrorCount: 0 },
      },
    });

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-pie-chart")).toBeInTheDocument();
    });

    // Should have HTTP Calls / Parsed Data toggle
    expect(screen.getByText("HTTP Calls")).toBeInTheDocument();
    expect(screen.getByText("Parsed Data")).toBeInTheDocument();
  });

  it("renders pie chart with two series (inner + outer ring)", async () => {
    mockGetStats.mockResolvedValue({
      "2026-03-26": {
        Carolina: { searchQueryCount: 1, successCount: 5, failureCount: 1, uniqueProductCount: 3, parseErrorCount: 0 },
      },
    });

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("pie-series-count")).toHaveTextContent("2");
    });
  });

  it("shows supplier legend on pie chart tab", async () => {
    mockGetStats.mockResolvedValue({
      "2026-03-26": {
        Carolina: { searchQueryCount: 1, successCount: 5, failureCount: 0, uniqueProductCount: 3, parseErrorCount: 0 },
        Ambeed: { searchQueryCount: 1, successCount: 2, failureCount: 0, uniqueProductCount: 1, parseErrorCount: 0 },
      },
    });

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Carolina")).toBeInTheDocument();
      expect(screen.getByText("Ambeed")).toBeInTheDocument();
    });
  });

  it("shows clear button when data exists", async () => {
    mockGetStats.mockResolvedValue({
      "2026-03-26": {
        Carolina: { searchQueryCount: 1, successCount: 1, failureCount: 0, uniqueProductCount: 0, parseErrorCount: 0 },
      },
    });

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText("Clear stats")).toBeInTheDocument();
    });
  });

  it("does not show clear button when no data", async () => {
    mockGetStats.mockResolvedValue({});

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("0 calls")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Clear stats")).not.toBeInTheDocument();
  });

  it("displays singular 'call' for count of 1", async () => {
    mockGetStats.mockResolvedValue({
      "2026-03-26": {
        Carolina: { searchQueryCount: 1, successCount: 1, failureCount: 0, uniqueProductCount: 0, parseErrorCount: 0 },
      },
    });

    render(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("1 call")).toBeInTheDocument();
    });
  });
});
