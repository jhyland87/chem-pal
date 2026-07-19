import {
  resetChromeStorageMock,
  restoreChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { toDateKey } from "@/helpers/supplierStats";
import { clearSupplierStats } from "@/utils/idbCache";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStats,
  getStats,
  incrementFailure,
  incrementParseError,
  incrementProductCount,
  incrementSearchQueryCount,
  incrementSuccess,
} from "../SupplierStatsStore";

describe("SupplierStatsStore", () => {
  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(async () => {
    resetChromeStorageMock();
    await clearSupplierStats();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    restoreChromeStorageMock();
  });

  /** Helper: advance timers and flush microtasks to let the debounced flush complete */
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
    // Local calendar day — the store keys buckets locally so "Today" in the
    // stats panel matches the user's day, not UTC's.
    const today = toDateKey(new Date());

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
    // Local calendar day — the store keys buckets locally so "Today" in the
    // stats panel matches the user's day, not UTC's.
    const today = toDateKey(new Date());

    expect(stats[today]["Ambeed"].successCount).toBe(3);
  });

  it("increments failureCount for a supplier", async () => {
    incrementFailure("LibertySci");
    incrementFailure("LibertySci");
    await flushStore();

    vi.useRealTimers();
    const stats = await getStats();
    // Local calendar day — the store keys buckets locally so "Today" in the
    // stats panel matches the user's day, not UTC's.
    const today = toDateKey(new Date());

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
    // Local calendar day — the store keys buckets locally so "Today" in the
    // stats panel matches the user's day, not UTC's.
    const today = toDateKey(new Date());

    expect(stats[today]["Macklin"].uniqueProductCount).toBe(5);
  });

  it("increments parseErrorCount for a supplier", async () => {
    incrementParseError("Himedia");
    await flushStore();

    vi.useRealTimers();
    const stats = await getStats();
    // Local calendar day — the store keys buckets locally so "Today" in the
    // stats panel matches the user's day, not UTC's.
    const today = toDateKey(new Date());

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
    // Local calendar day — the store keys buckets locally so "Today" in the
    // stats panel matches the user's day, not UTC's.
    const today = toDateKey(new Date());

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
    // Local calendar day — the store keys buckets locally so "Today" in the
    // stats panel matches the user's day, not UTC's.
    const today = toDateKey(new Date());
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
    // Local calendar day — the store keys buckets locally so "Today" in the
    // stats panel matches the user's day, not UTC's.
    const today = toDateKey(new Date());

    expect(stats[today]["RapidTest"].successCount).toBe(20);
  });

  it("stores data keyed by date in IndexedDB", async () => {
    incrementSuccess("TestSupplier");
    await flushStore();

    vi.useRealTimers();
    const stats = await getStats();
    // Local calendar day — the store keys buckets locally so "Today" in the
    // stats panel matches the user's day, not UTC's.
    const today = toDateKey(new Date());

    // Verify the date key is in YYYY-MM-DD format
    expect(stats[today]).toBeDefined();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stats[today]["TestSupplier"].successCount).toBe(1);
  });
});
