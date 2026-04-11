import {
  resetChromeStorageMock,
  restoreChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { CACHE } from "@/constants/common";
import { cstorage } from "@/utils/storage";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildNoResultsMessage,
  createInitialHistoryEntry,
  saveResultsToSession,
  updateColumnFilterFromResult,
  updateHistoryResultCount,
} from "../useSearch";

vi.mock("@/helpers/pubchem", () => ({
  getCompoundNameFromAlias: vi.fn(),
}));

// Import after mocking so we can control the mock implementation
import { getCompoundNameFromAlias } from "@/helpers/pubchem";

describe("useSearch helpers", () => {
  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    restoreChromeStorageMock();
  });

  describe("updateColumnFilterFromResult", () => {
    it("ignores columns that are not in the config", () => {
      const config = {};
      const product = { price: 42 } as unknown as Product;
      updateColumnFilterFromResult(config, product);
      expect(config).toEqual({});
    });

    it("adds unique values for 'select' filter variants", () => {
      const config = {
        supplier: { filterVariant: "select", filterData: [] as unknown[] },
      };
      updateColumnFilterFromResult(config, { supplier: "Carolina" } as unknown as Product);
      updateColumnFilterFromResult(config, { supplier: "Ambeed" } as unknown as Product);
      updateColumnFilterFromResult(config, { supplier: "Carolina" } as unknown as Product);

      expect(config.supplier.filterData).toEqual(["Carolina", "Ambeed"]);
    });

    it("adds unique values for 'text' filter variants", () => {
      const config = {
        title: { filterVariant: "text", filterData: [] as unknown[] },
      };
      updateColumnFilterFromResult(config, { title: "Acetone" } as unknown as Product);
      updateColumnFilterFromResult(config, { title: "Acetone" } as unknown as Product);
      updateColumnFilterFromResult(config, { title: "Ethanol" } as unknown as Product);

      expect(config.title.filterData).toEqual(["Acetone", "Ethanol"]);
    });

    it("tracks numeric values for 'range' filter variants", () => {
      const config = {
        price: { filterVariant: "range", filterData: [] as unknown[] },
      };
      updateColumnFilterFromResult(config, { price: 10 } as unknown as Product);
      updateColumnFilterFromResult(config, { price: 5 } as unknown as Product);

      // The lower bound should update to the smaller value
      expect(config.price.filterData[0]).toBe(5);
    });

    it("skips non-numeric values for 'range' filter variants", () => {
      const config = {
        price: { filterVariant: "range", filterData: [] as unknown[] },
      };
      updateColumnFilterFromResult(config, { price: "not a number" } as unknown as Product);
      expect(config.price.filterData).toEqual([]);
    });
  });

  describe("saveResultsToSession", () => {
    it("persists the results to chrome.storage.session under SEARCH_RESULTS", async () => {
      const results = [{ id: 1, title: "Widget" }] as unknown as Product[];
      await saveResultsToSession(results);

      const stored = await cstorage.session.get([CACHE.SEARCH_RESULTS]);
      expect(stored[CACHE.SEARCH_RESULTS]).toEqual(results);
    });

    it("does not throw when chrome.storage.session.set rejects", async () => {
      const setSpy = vi
        .spyOn(chrome.storage.session, "set")
        .mockRejectedValueOnce(new Error("quota exceeded"));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(saveResultsToSession([])).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();

      setSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe("createInitialHistoryEntry", () => {
    it("prepends a new entry with resultCount 0 to the history array", async () => {
      const timestamp = 1_700_000_000_000;
      const filters = {
        titleQuery: "acetone",
        availability: [],
        country: [],
        shippingType: [],
      } as unknown as SearchFilters;

      await createInitialHistoryEntry("acetone", timestamp, filters, ["Carolina"]);

      const stored = await cstorage.local.get([CACHE.SEARCH_HISTORY]);
      const history = stored[CACHE.SEARCH_HISTORY] as SearchHistoryEntry[];

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        query: "acetone",
        timestamp,
        resultCount: 0,
        type: "search",
        selectedSuppliers: ["Carolina"],
      });
      expect(history[0].filters).toEqual(filters);
    });

    it("prepends newer entries in front of older ones", async () => {
      const filters = {
        titleQuery: "",
        availability: [],
        country: [],
        shippingType: [],
      } as unknown as SearchFilters;

      await createInitialHistoryEntry("first", 1, filters, []);
      await createInitialHistoryEntry("second", 2, filters, []);

      const stored = await cstorage.local.get([CACHE.SEARCH_HISTORY]);
      const history = stored[CACHE.SEARCH_HISTORY] as SearchHistoryEntry[];

      expect(history.map((h) => h.query)).toEqual(["second", "first"]);
    });

    it("truncates history to the most recent 100 entries", async () => {
      const filters = {
        titleQuery: "",
        availability: [],
        country: [],
        shippingType: [],
      } as unknown as SearchFilters;

      // Seed with 100 existing entries
      const seeded: SearchHistoryEntry[] = Array.from({ length: 100 }, (_, i) => ({
        query: `q${i}`,
        timestamp: i,
        resultCount: 0,
        type: "search",
        filters,
        selectedSuppliers: [],
      }));
      await chrome.storage.local.set({ [CACHE.SEARCH_HISTORY]: seeded });

      await createInitialHistoryEntry("newest", 9999, filters, []);

      const stored = await cstorage.local.get([CACHE.SEARCH_HISTORY]);
      const history = stored[CACHE.SEARCH_HISTORY] as SearchHistoryEntry[];

      expect(history).toHaveLength(100);
      expect(history[0].query).toBe("newest");
    });

    it("handles a missing or non-array existing history gracefully", async () => {
      const filters = {
        titleQuery: "",
        availability: [],
        country: [],
        shippingType: [],
      } as unknown as SearchFilters;

      await chrome.storage.local.set({ [CACHE.SEARCH_HISTORY]: "garbage" });

      await createInitialHistoryEntry("q", 1, filters, []);

      const stored = await cstorage.local.get([CACHE.SEARCH_HISTORY]);
      const history = stored[CACHE.SEARCH_HISTORY] as SearchHistoryEntry[];

      expect(history).toHaveLength(1);
      expect(history[0].query).toBe("q");
    });
  });

  describe("updateHistoryResultCount", () => {
    const baseFilters = {
      titleQuery: "",
      availability: [],
      country: [],
      shippingType: [],
    } as unknown as SearchFilters;

    it("updates the resultCount on the matching entry", async () => {
      await createInitialHistoryEntry("a", 100, baseFilters, []);
      await createInitialHistoryEntry("b", 200, baseFilters, []);

      await updateHistoryResultCount(100, 42);

      const stored = await cstorage.local.get([CACHE.SEARCH_HISTORY]);
      const history = stored[CACHE.SEARCH_HISTORY] as SearchHistoryEntry[];

      const updated = history.find((h) => h.timestamp === 100);
      const untouched = history.find((h) => h.timestamp === 200);
      expect(updated?.resultCount).toBe(42);
      expect(untouched?.resultCount).toBe(0);
    });

    it("is a no-op when no entry matches the timestamp", async () => {
      await createInitialHistoryEntry("a", 100, baseFilters, []);

      await updateHistoryResultCount(999, 5);

      const stored = await cstorage.local.get([CACHE.SEARCH_HISTORY]);
      const history = stored[CACHE.SEARCH_HISTORY] as SearchHistoryEntry[];

      expect(history[0].resultCount).toBe(0);
    });
  });

  describe("buildNoResultsMessage", () => {
    const mockedGetCompoundNameFromAlias = vi.mocked(getCompoundNameFromAlias);

    it("returns just the basic message when filters are inactive and PubChem has no alternative", async () => {
      mockedGetCompoundNameFromAlias.mockResolvedValueOnce(undefined);

      const msg = await buildNoResultsMessage("zzzzz", false);
      expect(msg).toBe('No results found for "zzzzz"');
    });

    it("includes the filter-broadening hint when filters are active", async () => {
      mockedGetCompoundNameFromAlias.mockResolvedValueOnce(undefined);

      const msg = await buildNoResultsMessage("zzzzz", true);
      expect(msg).toContain('No results found for "zzzzz"');
      expect(msg).toContain("broadening your search filters");
    });

    it("suggests the PubChem name when it differs from the query", async () => {
      mockedGetCompoundNameFromAlias.mockResolvedValueOnce("acetone");

      const msg = await buildNoResultsMessage("propan-2-one", false);
      expect(msg).toContain("Perhaps try the PubChem name instead: acetone");
    });

    it("does not suggest the PubChem name when it matches the query case-insensitively", async () => {
      mockedGetCompoundNameFromAlias.mockResolvedValueOnce("Acetone");

      const msg = await buildNoResultsMessage("acetone", false);
      expect(msg).not.toContain("Perhaps try");
    });
  });
});
