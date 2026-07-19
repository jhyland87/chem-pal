import {
  clearAllCaches,
  getMigrationDb,
  getStoredAppVersion,
  setStoredAppVersion,
} from "@/utils/idbCache";
import { Logger } from "@/utils/Logger";
import semver from "semver";
import type { Migration } from "./types";

const logger = new Logger("migrations");

/** Matches a step filename, capturing the `from` and `to` semver versions. */
const FILENAME_PATTERN = /\/v(\d+\.\d+\.\d+)-to-v(\d+\.\d+\.\d+)\.ts$/;

/** The current app version whose data shape ships in this build. */
const CURRENT_VERSION = __APP_VERSION__;

/** Aggregated status of the cache versus the running app version. */
export interface MigrationStatus {
  /** Version that last wrote the cache, or `undefined` on a fresh install. */
  storedVersion?: string;
  /** The running app version (`__APP_VERSION__`). */
  currentVersion: string;
  /** Steps that must run to bring the cache up to `currentVersion`. */
  pending: Migration[];
}

/**
 * Runtime type guard for a {@link Migration} object loaded from a step file.
 * Validates the four required members without any type assertion, so an
 * unexpected export shape fails loudly at load time rather than mid-migration.
 * @param value - The value exported as `migration` by a step module.
 * @returns `true` when `value` matches the {@link Migration} shape.
 * @example
 * ```ts
 * isMigration({ from: "1.0.0", to: "1.0.1", description: "x", up: async () => {} }); // => true
 * ```
 * @source
 */
function isMigration(value: unknown): value is Migration {
  if (typeof value !== "object" || value === null) return false;
  return (
    "from" in value &&
    typeof value.from === "string" &&
    "to" in value &&
    typeof value.to === "string" &&
    "description" in value &&
    typeof value.description === "string" &&
    "up" in value &&
    typeof value.up === "function"
  );
}

/**
 * Order migrations by their target version ascending, so a chain applies oldest
 * first (`1.0.1`, then `1.1.0`, …). Non-mutating.
 * @param migrations - The migrations to order.
 * @returns A new array sorted by `to` ascending.
 * @example
 * ```ts
 * // input targets [1.1.0, 1.0.1] => output targets [1.0.1, 1.1.0]
 * sortMigrations([toOneOne, toOneZeroOne]);
 * ```
 * @source
 */
function sortMigrations(migrations: Migration[]): Migration[] {
  return [...migrations].sort((a, b) => semver.compare(a.to, b.to));
}

/**
 * Eagerly import every `steps/vX.Y.Z-to-vA.B.C.ts` file and validate it. Each
 * module must named-export a `migration` object whose `from`/`to` match its
 * filename and form a forward (`to > from`) semver step. Any violation throws at
 * module load, keeping the filename and metadata honest.
 * @returns All discovered migrations, sorted by target version ascending.
 * @example
 * ```ts
 * loadMigrations(); // => [{ from: "1.0.0", to: "1.0.1", ... }]
 * ```
 * @source
 */
function loadMigrations(): Migration[] {
  const modules = import.meta.glob("./steps/*.ts", { eager: true });
  const migrations: Migration[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    if (typeof mod !== "object" || mod === null || !("migration" in mod)) {
      throw new Error(`Migration file ${path} must named-export a \`migration\` object`);
    }
    const migration = mod.migration;
    if (!isMigration(migration)) {
      throw new Error(`Migration file ${path} exports an invalid \`migration\` object`);
    }
    const match = FILENAME_PATTERN.exec(path);
    if (!match) {
      throw new Error(`Migration filename ${path} must match vX.Y.Z-to-vA.B.C.ts`);
    }
    const [, fromFile, toFile] = match;
    if (migration.from !== fromFile || migration.to !== toFile) {
      throw new Error(
        `Migration ${path} metadata (${migration.from} → ${migration.to}) does not match its filename (${fromFile} → ${toFile})`,
      );
    }
    if (semver.valid(migration.from) == null || semver.valid(migration.to) == null) {
      throw new Error(`Migration ${path} has invalid semver versions`);
    }
    if (!semver.gt(migration.to, migration.from)) {
      throw new Error(`Migration ${path} must move forward (to > from)`);
    }
    migrations.push(migration);
  }
  return sortMigrations(migrations);
}

/** All migration steps bundled in this build, validated and sorted at load. */
const ALL_MIGRATIONS = loadMigrations();

/**
 * Select the migrations that must run to move a cache from `storedVersion` up to
 * `currentVersion` — those whose target is newer than the cache and no newer than
 * the app. A `null`/`undefined` `storedVersion` (fresh install) yields none. Logs
 * a warning if the resulting chain has a gap (a release's step is missing).
 * @param migrations - The full set of known migrations.
 * @param storedVersion - Version that created the cache, or `undefined` if fresh.
 * @param currentVersion - The running app version to migrate up to.
 * @returns The steps to run, ordered oldest-first (empty when none apply).
 * @example
 * ```ts
 * computePendingMigrations(all, "1.0.0", "1.1.0"); // => [1.0.0→1.0.1, 1.0.1→1.1.0]
 * computePendingMigrations(all, undefined, "1.1.0"); // => []
 * ```
 * @source
 */
export function computePendingMigrations(
  migrations: Migration[],
  storedVersion: string | undefined,
  currentVersion: string,
): Migration[] {
  if (storedVersion == null) return [];
  const pending = sortMigrations(
    migrations.filter((m) => semver.gt(m.to, storedVersion) && semver.lte(m.to, currentVersion)),
  );
  for (let i = 0; i < pending.length; i++) {
    const expectedFrom = i === 0 ? storedVersion : pending[i - 1].to;
    if (semver.neq(pending[i].from, expectedFrom)) {
      logger.warn("Migration chain is not contiguous — a release's step may be missing", {
        expectedFrom,
        actualFrom: pending[i].from,
        step: `${pending[i].from} → ${pending[i].to}`,
      });
    }
  }
  return pending;
}

/**
 * Read the cache's stored version and report which migrations are pending for the
 * running app. Drives the on-open "Version update detected" prompt: an empty
 * `pending` means the cache is current (or a fresh install), a non-empty one lists
 * the steps to apply.
 * @returns The stored version, the current version, and the pending steps.
 * @example
 * ```ts
 * const { pending } = await getMigrationStatus();
 * if (pending.length > 0) showPrompt(pending);
 * ```
 * @source
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  const storedVersion = await getStoredAppVersion();
  return {
    storedVersion,
    currentVersion: CURRENT_VERSION,
    pending: computePendingMigrations(ALL_MIGRATIONS, storedVersion, CURRENT_VERSION),
  };
}

/**
 * Run an ordered chain of migration steps against the untyped migration DB handle,
 * advancing the stored version marker to each step's `to` **after** that step
 * succeeds. This means a mid-chain failure leaves the marker at the last completed
 * step, so a retry resumes from there instead of re-running the whole chain. A
 * throwing step propagates its error (marker left at the last success); the caller
 * decides whether to retry or {@link resetToCurrentVersion}. Passing `[]` is a no-op.
 * @param steps - The migrations to run, already ordered oldest-first.
 * @returns Resolves once every step has applied and the marker reflects the last one.
 * @throws If any step's `up` rejects (after committing every earlier step's marker).
 * @example
 * ```ts
 * await runMigrations([v100to101, v101to110]); // marker ends at "1.1.0"
 * ```
 * @source
 */
export async function runMigrations(steps: Migration[]): Promise<void> {
  if (steps.length === 0) return;
  const db = await getMigrationDb();
  logger.info("Running migrations", { steps: steps.map((s) => `${s.from} → ${s.to}`).join(", ") });
  try {
    for (const migration of steps) {
      const _logger = logger.sub(`${migration.from} → ${migration.to}`);
      _logger.info("Applying migration step");
      try {
        await migration.up({ db, logger: _logger });
        _logger.info("Migration step applied successfully");
        await setStoredAppVersion(migration.to);
      } catch (error) {
        _logger.error("Migration step failed", {
          error,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    }
  } catch (error) {
    logger.error("Migrations failed", {
      error,
      reason: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Migrate the cache from its stored version up to the running app version: compute
 * the pending chain, {@link runMigrations | run it}, then stamp the marker at the
 * current version (covering the case where the newest release has no migration of
 * its own). When nothing is pending, the version is seeded (fresh install) instead.
 * A failing step propagates so the caller can fall back to {@link resetToCurrentVersion}.
 * @returns Resolves once the cache is migrated and the marker is current.
 * @throws If any migration step's `up` rejects.
 * @example
 * ```ts
 * try { await applyPendingMigrations(); }
 * catch { await resetToCurrentVersion(); }
 * ```
 * @source
 */
export async function applyPendingMigrations(): Promise<void> {
  const storedVersion = await getStoredAppVersion();
  const pending = computePendingMigrations(ALL_MIGRATIONS, storedVersion, CURRENT_VERSION);
  if (pending.length === 0) {
    await seedVersionIfUnset();
    return;
  }
  await runMigrations(pending);
  await setStoredAppVersion(CURRENT_VERSION);
}

/**
 * Discard all cached data and stamp the cache with the current version — the
 * "Cancel / start fresh" path from the update prompt. Deliberately leaves price
 * history intact, matching {@link clearAllCaches}.
 * @returns Resolves once the cache is cleared and the marker is set.
 * @example
 * ```ts
 * await resetToCurrentVersion(); // caches empty, marker = current version
 * ```
 * @source
 */
export async function resetToCurrentVersion(): Promise<void> {
  await clearAllCaches();
  await setStoredAppVersion(CURRENT_VERSION);
}

/**
 * Stamp the cache with the current version only when no marker exists yet — used
 * on a fresh install and on an existing user's first run of a migration-enabled
 * build. Never clears data and never overwrites an existing marker.
 * @returns Resolves once the marker is seeded (or immediately if already set).
 * @example
 * ```ts
 * await seedVersionIfUnset(); // first run: marker = current version
 * ```
 * @source
 */
export async function seedVersionIfUnset(): Promise<void> {
  const storedVersion = await getStoredAppVersion();
  if (storedVersion == null) {
    await setStoredAppVersion(CURRENT_VERSION);
  }
}
