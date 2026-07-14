import {
  getMigrationDb,
  getSearchResults,
  getStoredAppVersion,
  setStoredAppVersion,
} from "@/utils/idbCache";
import { Logger } from "@/utils/Logger";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyPendingMigrations,
  computePendingMigrations,
  getMigrationStatus,
  resetToCurrentVersion,
  runMigrations,
  seedVersionIfUnset,
} from "../registry";
import type { Migration } from "../types";

const logger = new Logger("registry.test");

/** Build a no-op migration with the given version bounds. */
function mig(from: string, to: string): Migration {
  return { from, to, description: `${from}->${to}`, up: async () => {} };
}

/**
 * A migration whose `up` records its run order and appends its target version to a
 * `tags` array on the single `search_results` row — lets a test assert the chain
 * ran in order and transformed the cached data cumulatively.
 */
function chainStep(from: string, to: string, order: string[]): Migration {
  return {
    from,
    to,
    description: `tag ${to}`,
    async up({ db }) {
      order.push(to);
      const row = (await db.get("search_results", "current")) as { tags?: string[] } | undefined;
      const tags = row?.tags ?? [];
      tags.push(to);
      await db.put("search_results", { id: "current", data: [], tags });
    },
  };
}

/** Seed a stored version + an empty tagged `search_results` row for chain tests. */
async function seedCacheAt(version: string): Promise<void> {
  await setStoredAppVersion(version);
  const db = await getMigrationDb();
  await db.put("search_results", { id: "current", data: [], tags: [] });
  db.close();
}

/** Read the `tags` array off the single `search_results` row. */
async function readTags(): Promise<string[]> {
  const db = await getMigrationDb();
  const row = (await db.get("search_results", "current")) as { tags?: string[] } | undefined;
  db.close();
  return row?.tags ?? [];
}

/** Wipe the marker + search results so each test starts from a fresh cache. */
beforeEach(async () => {
  // Touch a real accessor first so getDB() creates the v6 stores before the
  // untyped connection (which never upgrades) tries to clear them.
  await getStoredAppVersion();
  const db = await getMigrationDb();
  await db.clear("app_meta");
  await db.clear("search_results");
  db.close();
});

describe("computePendingMigrations", () => {
  const all = [mig("1.0.0", "1.0.1"), mig("1.0.1", "1.1.0"), mig("1.1.0", "2.0.0")];

  it("returns nothing for a fresh install (no stored version)", () => {
    expect(computePendingMigrations(all, undefined, "2.0.0")).toEqual([]);
  });

  it("returns nothing when the cache is already current", () => {
    expect(computePendingMigrations(all, "2.0.0", "2.0.0")).toEqual([]);
  });

  it("selects only steps between the stored and current versions", () => {
    const pending = computePendingMigrations(all, "1.0.0", "1.1.0");
    expect(pending.map((m) => `${m.from}->${m.to}`)).toEqual(["1.0.0->1.0.1", "1.0.1->1.1.0"]);
  });

  it("excludes steps whose target is newer than the current version", () => {
    const pending = computePendingMigrations(all, "1.0.1", "1.1.0");
    expect(pending.map((m) => m.to)).toEqual(["1.1.0"]);
  });

  it("orders steps by target version ascending regardless of input order", () => {
    const shuffled = [mig("1.1.0", "2.0.0"), mig("1.0.0", "1.0.1"), mig("1.0.1", "1.1.0")];
    const pending = computePendingMigrations(shuffled, "1.0.0", "2.0.0");
    expect(pending.map((m) => m.to)).toEqual(["1.0.1", "1.1.0", "2.0.0"]);
  });
});

describe("version marker + registry integration", () => {
  it("reports no stored version on a fresh cache", async () => {
    expect(await getStoredAppVersion()).toBeUndefined();
  });

  it("round-trips the stored app version", async () => {
    await setStoredAppVersion("1.2.3");
    expect(await getStoredAppVersion()).toBe("1.2.3");
  });

  it("seeds the current version only when unset", async () => {
    await seedVersionIfUnset();
    expect(await getStoredAppVersion()).toBe(__APP_VERSION__);

    await setStoredAppVersion("0.9.0");
    await seedVersionIfUnset();
    expect(await getStoredAppVersion()).toBe("0.9.0");
  });

  it("getMigrationStatus has no pending steps and no marker on a fresh cache", async () => {
    const status = await getMigrationStatus();
    expect(status.currentVersion).toBe(__APP_VERSION__);
    expect(status.storedVersion).toBeUndefined();
    expect(status.pending).toEqual([]);
  });

  it("applyPendingMigrations seeds the version when nothing is pending", async () => {
    await applyPendingMigrations();
    expect(await getStoredAppVersion()).toBe(__APP_VERSION__);
  });

  it("resetToCurrentVersion clears caches and stamps the current version", async () => {
    const db = await getMigrationDb();
    await db.put("search_results", { id: "current", data: [{ title: "x" }] });
    db.close();

    await resetToCurrentVersion();

    expect(await getSearchResults()).toEqual([]);
    expect(await getStoredAppVersion()).toBe(__APP_VERSION__);
  });

  it("a migration step can transform records via the untyped db handle", async () => {
    const step: Migration = {
      from: "1.0.0",
      to: "1.0.1",
      description: "stamp rows as migrated",
      async up({ db }) {
        const rows = await db.getAll("search_results");
        const tx = db.transaction("search_results", "readwrite");
        for (const row of rows) {
          await tx.store.put({ ...row, migrated: true });
        }
        await tx.done;
      },
    };

    const db = await getMigrationDb();
    await db.put("search_results", { id: "current", data: [] });
    await step.up({ db, logger });
    const row = (await db.get("search_results", "current")) as { migrated?: boolean };
    db.close();

    expect(row.migrated).toBe(true);
  });
});

describe("runMigrations — release upgrades", () => {
  it("upgrades the cache across a single release (1.0.0 -> 1.0.1)", async () => {
    await seedCacheAt("1.0.0");
    const order: string[] = [];

    await runMigrations([chainStep("1.0.0", "1.0.1", order)]);

    expect(order).toEqual(["1.0.1"]);
    expect(await getStoredAppVersion()).toBe("1.0.1");
    expect(await readTags()).toEqual(["1.0.1"]);
  });

  it("upgrades through multiple releases in order (1.0.0 -> 1.0.1 -> 1.1.0)", async () => {
    await seedCacheAt("1.0.0");
    const order: string[] = [];

    await runMigrations([chainStep("1.0.0", "1.0.1", order), chainStep("1.0.1", "1.1.0", order)]);

    // Ran oldest-first, transformed the data cumulatively, marker at the final version.
    expect(order).toEqual(["1.0.1", "1.1.0"]);
    expect(await readTags()).toEqual(["1.0.1", "1.1.0"]);
    expect(await getStoredAppVersion()).toBe("1.1.0");
  });

  it("chains four releases end to end (1.0.0 -> 2.0.0)", async () => {
    await seedCacheAt("1.0.0");
    const order: string[] = [];

    await runMigrations([
      chainStep("1.0.0", "1.0.1", order),
      chainStep("1.0.1", "1.1.0", order),
      chainStep("1.1.0", "1.2.0", order),
      chainStep("1.2.0", "2.0.0", order),
    ]);

    expect(await readTags()).toEqual(["1.0.1", "1.1.0", "1.2.0", "2.0.0"]);
    expect(await getStoredAppVersion()).toBe("2.0.0");
  });

  it("advances the marker per step: a mid-chain failure resumes from the last success", async () => {
    await seedCacheAt("1.0.0");
    const order: string[] = [];
    const failing: Migration = {
      from: "1.0.1",
      to: "1.1.0",
      description: "boom",
      up: async () => {
        throw new Error("boom");
      },
    };

    await expect(runMigrations([chainStep("1.0.0", "1.0.1", order), failing])).rejects.toThrow(
      "boom",
    );

    // First step committed (marker + data), the failing step did not advance the marker.
    expect(await getStoredAppVersion()).toBe("1.0.1");
    expect(await readTags()).toEqual(["1.0.1"]);

    // Retrying with only the remaining step completes the upgrade.
    await runMigrations([chainStep("1.0.1", "1.1.0", order)]);
    expect(await getStoredAppVersion()).toBe("1.1.0");
    expect(await readTags()).toEqual(["1.0.1", "1.1.0"]);
  });

  it("is a no-op for an empty chain", async () => {
    await seedCacheAt("1.0.0");
    await runMigrations([]);
    expect(await getStoredAppVersion()).toBe("1.0.0");
  });
});
