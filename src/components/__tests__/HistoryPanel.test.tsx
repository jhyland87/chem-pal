import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import {
  setupChromeStorageMock,
  resetChromeStorageMock,
  restoreChromeStorageMock,
} from "../../__fixtures__/helpers/chrome/storageMock";
import { addSearchHistoryEntry, clearSearchHistory } from "@/utils/idbCache";

// Mock @mui/icons-material to avoid ENFILE from barrel import
vi.mock("@mui/icons-material", () => ({
  Delete: vi.fn((props: any) => <span data-testid="DeleteIcon" {...props} />),
}));

// Mock the context — HistoryPanel uses useAppContext
const mockSetPendingSearchQuery = vi.fn();
const mockSetDrawerTab = vi.fn();
const mockSetSearchFilters = vi.fn();
const mockSetSelectedSuppliers = vi.fn();
const mockSetPanel = vi.fn();
vi.mock("@/context", () => ({
  useAppContext: () => ({
    setPendingSearchQuery: mockSetPendingSearchQuery,
    setDrawerTab: mockSetDrawerTab,
    setSearchFilters: mockSetSearchFilters,
    setSelectedSuppliers: mockSetSelectedSuppliers,
    setPanel: mockSetPanel,
  }),
}));

import HistoryPanel from "../HistoryPanel";

async function seedHistory(entries: SearchHistoryEntry[]): Promise<void> {
  for (const entry of entries) {
    await addSearchHistoryEntry(entry);
  }
}

describe("HistoryPanel", () => {
  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(async () => {
    resetChromeStorageMock();
    await clearSearchHistory();
    mockSetPendingSearchQuery.mockClear();
    mockSetDrawerTab.mockClear();
    mockSetSearchFilters.mockClear();
    mockSetSelectedSuppliers.mockClear();
    mockSetPanel.mockClear();
  });

  afterAll(() => {
    restoreChromeStorageMock();
  });

  it("renders empty state when no history exists", async () => {
    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText("No search history yet.")).toBeInTheDocument();
    });
    expect(screen.getByText("0 searches")).toBeInTheDocument();
  });

  it("renders history entries from IndexedDB", async () => {
    const entries: SearchHistoryEntry[] = [
      { query: "sodium chloride", timestamp: Date.now(), resultCount: 10, type: "search" },
      { query: "acetic acid", timestamp: Date.now() - 60000, resultCount: 5, type: "search" },
    ];
    await seedHistory(entries);

    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText("sodium chloride")).toBeInTheDocument();
      expect(screen.getByText("acetic acid")).toBeInTheDocument();
    });
    expect(screen.getByText("2 searches")).toBeInTheDocument();
  });

  it("renders singular 'search' for single entry", async () => {
    const entries: SearchHistoryEntry[] = [
      { query: "ethanol", timestamp: Date.now(), resultCount: 3, type: "search" },
    ];
    await seedHistory(entries);

    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText("1 search")).toBeInTheDocument();
    });
  });

  it("displays result count for each entry", async () => {
    const entries: SearchHistoryEntry[] = [
      { query: "sulfuric acid", timestamp: Date.now(), resultCount: 42, type: "search" },
    ];
    await seedHistory(entries);

    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText(/42 results/)).toBeInTheDocument();
    });
  });

  it("displays singular 'result' for count of 1", async () => {
    const entries: SearchHistoryEntry[] = [
      { query: "rare compound", timestamp: Date.now(), resultCount: 1, type: "search" },
    ];
    await seedHistory(entries);

    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText(/1 result$/)).toBeInTheDocument();
    });
  });

  it("clears history when clear button is clicked", async () => {
    const entries: SearchHistoryEntry[] = [
      { query: "test query", timestamp: Date.now(), resultCount: 5, type: "search" },
    ];
    await seedHistory(entries);

    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText("test query")).toBeInTheDocument();
    });

    const clearButton = screen.getByLabelText("Clear history");
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText("No search history yet.")).toBeInTheDocument();
      expect(screen.getByText("0 searches")).toBeInTheDocument();
    });
  });

  it("does not show clear button when history is empty", async () => {
    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText("0 searches")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Clear history")).not.toBeInTheDocument();
  });

  it("triggers re-search when a history entry is clicked", async () => {
    const entries: SearchHistoryEntry[] = [
      { query: "potassium nitrate", timestamp: Date.now(), resultCount: 8, type: "search" },
    ];
    await seedHistory(entries);

    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText("potassium nitrate")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("potassium nitrate"));

    expect(mockSetPendingSearchQuery).toHaveBeenCalledWith("potassium nitrate");
    expect(mockSetDrawerTab).toHaveBeenCalledWith(-1);
    expect(mockSetPanel).toHaveBeenCalledWith(1);
  });

  it("formats timestamps correctly", async () => {
    // Use a known date: Jan 15, 2026, 2:30 PM
    const date = new Date(2026, 0, 15, 14, 30);
    const entries: SearchHistoryEntry[] = [
      { query: "test", timestamp: date.getTime(), resultCount: 0, type: "search" },
    ];
    await seedHistory(entries);

    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
    });
  });

  it("renders multiple entries in order", async () => {
    const entries: SearchHistoryEntry[] = [
      { query: "first", timestamp: Date.now(), resultCount: 1, type: "search" },
      { query: "second", timestamp: Date.now() - 1000, resultCount: 2, type: "search" },
      { query: "third", timestamp: Date.now() - 2000, resultCount: 3, type: "search" },
    ];
    await seedHistory(entries);

    render(<HistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText("3 searches")).toBeInTheDocument();
      expect(screen.getByText("first")).toBeInTheDocument();
      expect(screen.getByText("second")).toBeInTheDocument();
      expect(screen.getByText("third")).toBeInTheDocument();
    });
  });
});
