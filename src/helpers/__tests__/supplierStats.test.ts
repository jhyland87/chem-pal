import { describe, expect, it } from "vitest";
import {
  classifySupplierHealth,
  EXCESSIVE_RATIO,
  filterStatsByRange,
  STATS_RANGES,
  statusLabelKey,
  toDateKey,
  type StatsRange,
} from "@/helpers/supplierStats";

/** Builds a day entry with a single supplier; values are irrelevant to range tests. */
const day = (): { [supplier: string]: SupplierDayStats } => ({
  Carolina: {
    searchQueryCount: 1,
    successCount: 1,
    failureCount: 0,
    uniqueProductCount: 1,
    parseErrorCount: 0,
  },
});

// Wednesday 2026-07-15, local noon so the local calendar day is unambiguous.
const NOW = new Date(2026, 6, 15, 12, 0, 0);

const STATS: SupplierStatsData = {
  "2026-05-20": day(), // ~2 months back
  "2026-06-30": day(), // last month
  "2026-07-01": day(), // this month, >7 days ago
  "2026-07-09": day(), // 6 days ago -> inside last7
  "2026-07-13": day(), // Monday of this week
  "2026-07-15": day(), // today
};

const keysFor = (range: StatsRange) => Object.keys(filterStatsByRange(STATS, range, NOW)).sort();

describe("toDateKey", () => {
  it("formats using the local calendar, not UTC", () => {
    // 23:30 local on the 15th — in a negative-offset zone this is the 16th in UTC.
    expect(toDateKey(new Date(2026, 6, 15, 23, 30))).toBe("2026-07-15");
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05"); // zero-padding
  });
});

describe("filterStatsByRange", () => {
  it("returns everything for 'all'", () => {
    expect(keysFor("all")).toEqual(Object.keys(STATS).sort());
  });

  it("keeps only today", () => {
    expect(keysFor("today")).toEqual(["2026-07-15"]);
  });

  it("keeps the last 7 days inclusive of today", () => {
    expect(keysFor("last7")).toEqual(["2026-07-09", "2026-07-13", "2026-07-15"]);
  });

  it("keeps the last 30 days", () => {
    expect(keysFor("last30")).toEqual([
      "2026-06-30",
      "2026-07-01",
      "2026-07-09",
      "2026-07-13",
      "2026-07-15",
    ]);
  });

  it("keeps the current calendar month only", () => {
    expect(keysFor("month")).toEqual(["2026-07-01", "2026-07-09", "2026-07-13", "2026-07-15"]);
  });

  it("keeps the current week starting Monday", () => {
    // 2026-07-15 is a Wednesday; the week starts Monday 2026-07-13.
    expect(keysFor("week")).toEqual(["2026-07-13", "2026-07-15"]);
  });

  it("excludes days after 'now' so a clock skew can't leak future entries", () => {
    const withFuture: SupplierStatsData = { ...STATS, "2026-07-20": day() };
    expect(Object.keys(filterStatsByRange(withFuture, "month", NOW))).not.toContain("2026-07-20");
  });

  it("covers every range option offered in the dropdown", () => {
    for (const { value } of STATS_RANGES) {
      expect(() => filterStatsByRange(STATS, value, NOW)).not.toThrow();
    }
  });
});

describe("classifySupplierHealth", () => {
  const totals = (o: Partial<Record<string, number>> = {}) => ({
    success: 0,
    failure: 0,
    products: 0,
    parseErrors: 0,
    ...o,
  });

  it("reports ok for a healthy supplier", () => {
    expect(classifySupplierHealth(totals({ success: 9, failure: 1, products: 20 }))).toEqual({
      status: "ok",
      reasons: [],
    });
  });

  it("reports ok for a supplier with no recorded activity", () => {
    expect(classifySupplierHealth(totals()).status).toBe("ok");
  });

  // Regression: real Ambeed figures that were wrongly flagged "Excessive Parser
  // Errors" when parse health was graded against products. It has zero products
  // only because uniqueProductCount counts non-cached detail fetches.
  it("does not flag a supplier with a healthy ratio but zero products", () => {
    expect(
      classifySupplierHealth(totals({ success: 114, failure: 14, products: 0, parseErrors: 10 })),
    ).toEqual({ status: "ok", reasons: [] });
  });

  describe("connection health", () => {
    it("flags 100% failure as noSuccess", () => {
      expect(classifySupplierHealth(totals({ success: 0, failure: 4 })).status).toBe("noSuccess");
    });

    it("flags a failure share at exactly the threshold as excessive", () => {
      // 5/10 == EXCESSIVE_RATIO; the boundary is inclusive.
      expect(EXCESSIVE_RATIO).toBe(0.5);
      expect(classifySupplierHealth(totals({ success: 5, failure: 5 })).status).toBe(
        "connectionErrors",
      );
    });

    it("leaves just under 50% failures alone", () => {
      expect(classifySupplierHealth(totals({ success: 6, failure: 5 })).status).toBe("ok");
    });
  });

  describe("parser health", () => {
    it("flags parse errors on every successful call as parseFailure", () => {
      expect(classifySupplierHealth(totals({ success: 10, parseErrors: 10 })).status).toBe(
        "parseFailure",
      );
    });

    it("flags at least half of successful calls as excessive", () => {
      expect(classifySupplierHealth(totals({ success: 10, parseErrors: 5 })).status).toBe(
        "parseErrors",
      );
    });

    it("leaves just under half alone", () => {
      expect(classifySupplierHealth(totals({ success: 11, parseErrors: 5 })).status).toBe("ok");
    });

    it("ignores products entirely when grading the parser", () => {
      const withProducts = classifySupplierHealth(
        totals({ success: 10, products: 999, parseErrors: 8 }),
      );
      const withoutProducts = classifySupplierHealth(
        totals({ success: 10, products: 0, parseErrors: 8 }),
      );
      expect(withProducts).toEqual(withoutProducts);
    });

    it("does not grade the parser when nothing succeeded", () => {
      // Connection status already covers this; parse ratio would divide by zero.
      expect(
        classifySupplierHealth(totals({ success: 0, failure: 3, parseErrors: 3 })).status,
      ).toBe("noSuccess");
    });
  });

  it("keeps the worst status but records every reason", () => {
    const result = classifySupplierHealth(totals({ success: 4, failure: 6, parseErrors: 4 }));
    expect(result.reasons).toContain("connectionErrors");
    expect(result.reasons).toContain("parseFailure");
    // parseFailure outranks connectionErrors.
    expect(result.status).toBe("parseFailure");
  });

  it("reports disabled suppliers as disabled regardless of their counters", () => {
    const result = classifySupplierHealth(
      totals({ success: 0, failure: 99, parseErrors: 99 }),
      true,
    );
    expect(result).toEqual({ status: "disabled", reasons: [] });
  });
});

describe("statusLabelKey", () => {
  it("maps every status to a distinct i18n key", () => {
    const statuses = [
      "ok",
      "disabled",
      "parseErrors",
      "parseFailure",
      "connectionErrors",
      "noSuccess",
    ] as const;
    const keys = statuses.map(statusLabelKey);
    expect(new Set(keys).size).toBe(statuses.length);
    expect(keys.every((k) => k.startsWith("stats_status_"))).toBe(true);
  });
});
