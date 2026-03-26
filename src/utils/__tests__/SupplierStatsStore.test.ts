/**
 * Unit tests for the {@link SupplierStatsStore} utility module.
 *
 * Validates each increment function (searchQueryCount, success, failure,
 * uniqueProductCount, parseError), multi-supplier independence, zero-init
 * for new entries, clearStats, rapid-batch correctness, per-day storage
 * key format (`supplier_stats_MMDDYYYY`), and migration from the legacy
 * `supplierStats` Chrome storage key.
 *
 * @source
 */
import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  setupChromeStorageMock,
  resetChromeStorageMock,
  restoreChromeStorageMock,
} from "../../__fixtures__/helpers/chrome/storageMock";
import {
  incrementSearchQueryCount,
  incrementSuccess,
  incrementFailure,
  incrementProductCount,
  incrementParseError,
  getStats,
  clearStats,
} from "../SupplierStatsStore";

describe("SupplierStatsStore", () => {
  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    restoreChromeStorageMock();
  });

  /**
   * Advances fake timers past the internal `FLUSH_DELAY_MS` (500 ms) and
   * drains all pending microtasks so that the debounced write to Chrome
   * storage completes before assertions run.
   *
   * @example
   * ```ts
   * incrementSuccess("Carolina");
   * await flushStore();
   * // Storage now contains the incremented value
   * ```
   *
   * @source
   */
  const flushStore = async () => {
    vi.advanceTimersByTime(600); // past the 500ms FLUSH_DELAY_MS
    // Allow promises in the flush chain to resolve
    await vi.runAllTimersAsync();
  };

  it("returns empty stats when nothing has been recorded", async () => {
    vi.useRealTimers();
    const stats = await getStats();
    expect(stats).toEqual({});
  });

  it("increments searchQueryCount for a supplier", async () => {
    incrementSearchQueryCount("Carolina");
    await flushStore();

    vi.useRealTimers();
    const stats = await getStats();
    const today = new Date().toISOString().slice(0, 10);

    expect(stats[today]).toBeDefined();
    expect(stats[today]["Carolina"]).toBeDefined();
    expect(stats[today]["Carolina"].searchQueryCount).toBe(1);
  });

  it("increments successCount for a supplier", async () => {
    incrementSuccess("Ambeed");
    incrementSuccess("Ambeed");
    incrementSuccess("Ambeed");
    await flushStore();

    vi.useRealTimers();
    const stats = await getStats();
    const today = new Date().toISOString().slice(0, 10);

    expect(stats[today]["Ambeed"].successCount).toBe(3);
  });

  it("increments failureCount for a supplier", async () => {
    incrementFailure("LibertySci");
    incrementFailure("LibertySci");
    await flushStore();

    vi.useRealTimers();
    const stats = await getStats();
    const today = new Date().toISOString().slice(0, 10);

    expect(stats[today]["LibertySci"].failureCount).toBe(2);
  });

  it("increments uniqueProductCount for a supplier", async () => {
    incrementProductCount("Macklin");
    incrementProductCount("Macklin");
    incrementProductCount("Macklin");
    incrementProductCount("Macklin");
    incrementProductCount("Macklin");
    await flushStore();

    vi.useRealTimers();
    const stats = await getStats();
    const today = new Date().toISOString().slice(0, 10);

    expect(stats[today]["Macklin"].uniqueProductCount).toBe(5);
  });

  it("increments parseErrorCount for a supplier", async () => {
    incrementParseError("Himedia");
    await flushStore();

    vi.useRealTimers();
    const stats = await getStats();
    const today = new Date().toISOString().slice(0, 10);

    expect(stats[today]["Himedia"].parseErrorCount).toBe(1);
  });

  it("tracks multiple suppliers independently", async () => {
    incrementSuccess("Carolina");
    incrementSuccess("Carolina");
    incrementSuccess("Ambeed");
    incrementFailure("Ambeed");
    incrementParseError("LibertySci");
    await flushStore();

    vi.useRealTimers();
    const stats = await getStats();
    const today = new Date().toISOString().slice(0, 10);

    expect(stats[today]["Carolina"].successCount).toBe(2);
    expect(stats[today]["Carolina"].failureCount).toBe(0);
    expect(stats[today]["Ambeed"].successCount).toBe(1);
    expect(stats[today]["Ambeed"].failureCount).toBe(1);
    expect(stats[today]["LibertySci"].parseErrorCount).toBe(1);
  });

  it("initializes all fields to zero for new supplier entries", async () => {
    incrementSuccess("NewSupplier");
    await flushStore();

    vi.useRealTimers();
    const stats = await getStats();
    const today = new Date().toISOString().slice(0, 10);
    const entry = stats[today]["NewSupplier"];

    expect(entry.searchQueryCount).toBe(0);
    expect(entry.successCount).toBe(1);
    expect(entry.failureCount).toBe(0);
    expect(entry.uniqueProductCount).toBe(0);
    expect(entry.parseErrorCount).toBe(0);
  });

  it("clearStats removes all data", async () => {
    incrementSuccess("Carolina");
    await flushStore();

    vi.useRealTimers();
    await clearStats();
    const stats = await getStats();

    expect(stats).toEqual({});
  });

  it("batches rapid concurrent increments correctly", async () => {
    // Simulate many rapid increments that would cause race conditions
    // with a naive read-modify-write approach
    for (let i = 0; i < 20; i++) {
      incrementSuccess("RapidTest");
    }
    await flushStore();

    vi.useRealTimers();
    const stats = await getStats();
    const today = new Date().toISOString().slice(0, 10);

    expect(stats[today]["RapidTest"].successCount).toBe(20);
  });

  it("stores data in per-day storage keys", async () => {
    incrementSuccess("TestSupplier");
    await flushStore();

    // Check that the storage key follows supplier_stats_MMDDYYYY format
    vi.useRealTimers();
    const allData = await chrome.storage.local.get(null);
    const statsKeys = Object.keys(allData).filter((k) => k.startsWith("supplier_stats_"));

    expect(statsKeys.length).toBeGreaterThan(0);

    // Verify key format: supplier_stats_MMDDYYYY
    const keyPattern = /^supplier_stats_\d{8}$/;
    for (const key of statsKeys) {
      expect(key).toMatch(keyPattern);
    }
  });

  it("migrates legacy supplierStats format", async () => {
    // Set up legacy format data
    const legacyData: SupplierStatsData = {
      "2026-03-25": {
        Carolina: {
          searchQueryCount: 5,
          successCount: 10,
          failureCount: 1,
          uniqueProductCount: 4,
          parseErrorCount: 0,
        },
      },
    };
    await chrome.storage.local.set({ supplierStats: legacyData });

    vi.useRealTimers();
    const stats = await getStats();

    // Should have migrated the data
    expect(stats["2026-03-25"]).toBeDefined();
    expect(stats["2026-03-25"]["Carolina"].successCount).toBe(10);

    // Legacy key should be removed
    const remaining = await chrome.storage.local.get(["supplierStats"]);
    expect(remaining.supplierStats).toBeUndefined();
  });
});
