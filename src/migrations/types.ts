import type { Logger } from "@/utils/Logger";
import type { IDBPDatabase } from "idb";

/**
 * Everything a migration step needs to reshape cached data. The `db` handle is
 * the **untyped** connection from `getMigrationDb()` — its store names are plain
 * `string` and its records are `unknown`, so a step can read old-shaped or
 * renamed records without type assertions. Use `logger` for progress/diagnostics.
 */
export interface MigrationContext {
  db: IDBPDatabase;
  logger: Logger;
}

/**
 * A single release-to-release cache migration. One per `steps/vX.Y.Z-to-vA.B.C.ts`
 * file. `from`/`to` must match the filename's versions (the registry enforces
 * this). `description` is shown to the user in the update prompt. `up` applies the
 * change to the already-open cache; migrations are forward-only (no `down`).
 */
export interface Migration {
  /** Semver the cache is being migrated *from*, e.g. `"1.0.0"`. */
  from: string;
  /** Semver the cache is being migrated *to*, e.g. `"1.0.1"`. */
  to: string;
  /** Short, user-facing summary of what this step changes. */
  description: string;
  /**
   * Apply the migration against the open cache.
   * @param ctx - The migration context (untyped db handle + logger).
   * @returns Resolves once the step's changes are committed.
   */
  up(ctx: MigrationContext): Promise<void>;
}
