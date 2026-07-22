---
name: verify-changes
description: Verify a ChemPal change actually works before committing — which checks to run, in what order, and what each one does and doesn't prove. Use before committing or opening a PR, when a change needs manual confirmation in a real browser, or when deciding whether unit tests are sufficient evidence.
---

# Verifying a change

## The sequence

```bash
pnpm type-check    # tsc -b
pnpm lint          # eslint over src, excluding tests/fixtures/mocks
pnpm test:run      # vitest with configs/vitest.config.ts
```

Then E2E, if the change is user-facing:

```bash
pnpm test:e2e:chrome              # E2E_HEADED=1 to watch it run
pnpm test:e2e:firefox             # load smoke test only
```

Two command traps:

- **`pnpm type-check`, not `tsc --noEmit -p tsconfig.json`.** The latter silently checks
  nothing and exits clean.
- **`pnpm test:run`, not bare `vitest`.** Bare `vitest` misses
  `configs/vitest.config.ts`, which installs the no-network fetch guard — tests will
  happily hit real supplier sites.

## What a green run doesn't prove

**Excluded test files never ran.** `configs/vitest.config.ts` excludes
`src/helpers/__tests__/productBuilder.test.ts`,
`src/suppliers/__tests__/supplierMacklin.test.ts`, and `src/__tests__/**`. If your change
touches the code they cover, run them explicitly and expect breakage.

**Firefox E2E only proves the extension loads.** Playwright cannot drive
`moz-extension://` UI pages, so there is no Firefox coverage of actual UI behavior.

**Programmatic search needs `PANEL.RESULTS` mounted.** `ResultsTable` only exists on that
panel; writing to the session-storage inbox alone will not fire a search on a fresh
`SEARCH_HOME` load.

## Manual verification in a real browser

**The Vite dev server cannot do this.** `chrome.*` is undefined under `pnpm dev`, so
storage, messaging, and the service worker all fail. Instead:

```bash
pnpm build
```

Then load `build/` unpacked at `chrome://extensions` (Developer mode → Load unpacked).
Use `pnpm build:firefox` → `build-firefox/` for Firefox.

Two things to know once it's loaded:

- **Prod builds strip MUI icon `data-testid` attributes.** Target results-header icon
  buttons by `aria-label` or role instead. (`pnpm demo` builds prod.)
- **Debug helpers live on `window.chempal`** (`src/utils/debugConsole.ts`) —
  `backgroundFetch`, `getProductById`, `getProductPriceHistory`, `storageBreakdown`,
  `simulateUpdate`, `resetUpdatePrompt`. Fuzzy-filter probes (`fuzzTest`, `astTest`,
  `getCachedTitles`, from `src/utils/fuzzScorerLab.ts`) let you test filter changes
  offline against cached titles instead of re-running searches.

## Test-writing gotchas

- Import `ProductBuilder` before `SupplierBase` — module-initialization cycle.
- `vi.restoreAllMocks()` in `beforeEach` strips the chrome storage-mock implementations.
  Re-call `setupChromeStorageMock()` after it for anything doing `cstorage` round-trips.

## Before committing

- `git status` will show churn in `public/static/images/logo/*` and
  `src/constants/suppliers.ts` if you ran a build — that's `pnpm run generate`, not you.
  Leave it or revert it, but don't investigate it.
- Add a user-facing line to `CHANGELOG.md` under `## [Unreleased]` for anything a user
  would notice.
