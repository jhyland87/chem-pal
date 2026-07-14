# Cache migration steps

Each file here migrates the IndexedDB cache from one released app version to the
next. On app open, `../registry.ts` reads the version that last wrote the cache
(the `app_meta` marker) and runs every step needed to reach the running
`__APP_VERSION__`, in ascending semver order.

## Naming

```
v<from>-to-v<to>.ts        e.g. v1.0.0-to-v1.0.1.ts, v1.0.1-to-v1.1.0.ts
```

The `from`/`to` in the filename **must** match the `from`/`to` in the exported
`migration` object — the registry throws at load time if they diverge. `to` must
be a forward step (`> from`). Upgrading 1.0.0 → 1.1.0 runs `v1.0.0-to-v1.0.1.ts`
then `v1.0.1-to-v1.1.0.ts`.

## Template

```ts
// src/migrations/steps/v1.0.0-to-v1.0.1.ts
import type { Migration } from "../types";

export const migration: Migration = {
  from: "1.0.0",
  to: "1.0.1",
  description: "Add the `foo` field to cached search results",
  async up({ db, logger }) {
    // `db` is the UNTYPED idb handle — store names are plain strings and records
    // are `unknown`, so you can read old-shaped rows without type assertions.
    const rows = await db.getAll("search_results");
    const tx = db.transaction("search_results", "readwrite");
    for (const row of rows) {
      // ...transform `row` into the new shape, then:
      await tx.store.put(row);
    }
    await tx.done;
    logger.info("Migrated search_results to 1.0.1 shape", { count: rows.length });
  },
};
```

## Rules

- **Forward-only.** Steps define `up` only. Reverting is the user's "Cancel"
  choice in the update prompt, which clears the cache and starts fresh.
- **Data, not structure.** These steps reshape records *inside* existing object
  stores. Adding or removing an object store / index still goes through the
  `DB_VERSION` bump + `upgrade` callback in `src/utils/idbCache.ts`.
- **Prefer clearing over guessing.** If a cached format changed and can't be
  cleanly transformed, call the store's `clear...` helper from
  `src/utils/idbCache.ts` (e.g. `clearSupplierQueryCache`). This is how cache
  invalidation is now expressed — do not bump `SupplierCache.CACHE_VERSION`.
- **Idempotent-friendly.** The version marker advances after each step succeeds,
  so a retry resumes at the first unfinished step rather than replaying the whole
  chain. But a step that fails partway may have already written some rows, so
  write each step to tolerate re-running over its own partially-migrated data.
