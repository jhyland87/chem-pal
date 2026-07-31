---
name: add-migration-step
description: Add a cache migration step in src/migrations/steps when a release changes the shape of data already cached in IndexedDB. Use when a released version reshapes records inside an existing object store and old caches must be transformed on upgrade — covers the when/whether decision, the version-chaining and filename rules, the untyped db handle, idempotency, tests, and how it ties into cutting a release. Distinguishes a data migration from a DB_VERSION structural bump and from a plain cache clear.
---

# Adding a cache migration step

A migration step reshapes records **inside an existing object store** when a new
release changes their shape, so an existing user's cache is transformed on first
open instead of silently mis-read. The engine lives in `src/migrations/registry.ts`;
steps live in `src/migrations/steps/`. Read
[`src/migrations/steps/README.md`](../../../src/migrations/steps/README.md) alongside
this — it holds the canonical template and rules; this skill adds the *when/whether*
decision and the release tie-in.

## First: do you actually need a step?

Three different mechanisms, don't mix them up:

| The change is… | Do this | Not a step because… |
| --- | --- | --- |
| Reshaping records **inside** an existing store (add/rename/drop a field, re-encode a value) | **Add a migration step** (this skill) | — |
| Adding/removing an **object store or index** | Bump `DB_VERSION` + extend the `upgrade` callback in `src/utils/idbCache.ts` | Steps run against the already-open DB; they can't change its structural schema |
| A cached format changed and **can't be cleanly transformed** | Write a step that just calls the store's `clear…` helper (e.g. `clearSupplierQueryCache`) from `src/utils/idbCache.ts` | This is how invalidation is now expressed — **do not** bump `SupplierCache.CACHE_VERSION` |

If the release doesn't change any cached data shape, add nothing:
`applyPendingMigrations` stamps the new version marker on its own, so the newest
release needs a step **only** when its shape actually changed.

## Versions: from = last release, to = the release shipping the change

- **`to`** is the version you are about to ship (the one that introduces the new
  shape). **`from`** is the last **published** release — the version whose shape is
  sitting in existing users' caches.
- Steps must form a **contiguous chain**: each step's `from` equals the previous
  step's `to`. A gap (e.g. `1.5.0→1.6.0` then `1.7.0→1.8.0` with nothing bridging
  `1.6.0→1.7.0`) logs a "chain is not contiguous" warning and the middle upgrade
  won't transform. Add exactly one step per shape-changing release.
- `to` must be a forward semver step (`> from`). The registry validates all of
  this **at module load** (eager `import.meta.glob`), so a bad filename or a
  from/to mismatch throws during build and tests — not in a user's browser.

Because this is release-bound, the step lands in the **same PR** that changes the
shape, and its `to` is the version the `cut-release` skill is about to tag.

## Filename and template

```
src/migrations/steps/v<from>-to-v<to>.ts    e.g. v1.6.1-to-v1.7.0.ts
```

The `from`/`to` in the filename **must** match the `from`/`to` in the exported
`migration` object — the registry throws at load if they diverge.

```ts
// src/migrations/steps/v1.6.1-to-v1.7.0.ts
import type { Migration } from "../types";

export const migration: Migration = {
  from: "1.6.1",
  to: "1.7.0",
  description: "Add the `foo` field to cached search results",
  async up({ db, logger }) {
    // `db` is the UNTYPED idb handle: store names are plain strings and rows are
    // `unknown`, so read old-shaped records without `as` (which is banned in src).
    const rows = await db.getAll("search_results");
    const tx = db.transaction("search_results", "readwrite");
    for (const row of rows) {
      // ...transform row into the new shape, then:
      await tx.store.put(row);
    }
    await tx.done;
    logger.info("Migrated search_results to 1.7.0 shape", { count: rows.length });
  },
};
```

## Constraints that bite

- **`description` is a raw English string, not a locale key.** It's interpolated
  into the translated `migration_step` template
  (`i18n('migration_step', [from, to, description])` in `MigrationPrompt.tsx`), so
  the wrapper text is localized but your description shows verbatim in every locale.
  Keep it short and plain — but **do not** add it to the 7 `_locales/*/messages.json`
  files. This is the opposite of the usual "i18n hits all 7 locales" rule.
- **Forward-only.** Steps define `up` only; there is no `down`. The user's "Cancel"
  in the update prompt clears the cache and starts fresh instead.
- **Tolerate re-running over your own partial writes.** The version marker advances
  only *after* a step succeeds, so a step that throws partway is retried from its
  start — over rows it may have already migrated. Make `up` safe to re-apply
  (e.g. check whether a row is already in the new shape before rewriting it).
- **No `as` / `!` in `src`.** The handle is untyped precisely so you don't need
  assertions; narrow with runtime checks / `in` instead.

## Test it

The registry's own mechanics are covered by
`src/migrations/__tests__/registry.test.ts` — copy its helpers (`seedCacheAt`,
`chainStep`, `readTags`) as a pattern for asserting your step transforms a seeded
row correctly. A step with non-trivial logic should get its own focused test.

Load-time validation (filename ↔ metadata, forward step, valid semver) is enforced
by importing the registry, so it surfaces in `pnpm test:run` and the build even
without a dedicated test.

## Verify

```bash
pnpm type-check
pnpm lint
pnpm test:run
```

`chrome.*` is undefined in the Vite dev server, so migrations can't run there. To
exercise the real upgrade path by hand: `pnpm build`, load `build/` unpacked in
`chrome://extensions` while on an older cache, and reopen — the "Version update
detected" prompt should list your step's `from → to: description`. See the
`verify-changes` skill.

## Ties into

- `cut-release` — the step ships in the release whose version is its `to`.
- `add-i18n-key` — relevant only for the fixed `migration_*` prompt strings, **not**
  for a step's `description`.
