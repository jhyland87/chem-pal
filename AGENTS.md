# AGENTS.md

Guidance for AI coding agents working in this repository. Humans: see
[README.md](README.md) and [RELEASING.md](RELEASING.md).

## What this is

ChemPal is a **Manifest V3 browser extension** (Chrome and Firefox) that searches ~30
chemical suppliers from one interface and normalizes their prices and quantities into a
comparable table. React 19 + MUI 7, TypeScript, Vite, pnpm, Node ≥ 22.15.0.

Entry points: `index.html` → `src/main.tsx` (popup and full-tab UI),
`options.html` → `src/options.tsx` (options page), `src/service-worker.ts` (background).

## Commands

Run these from the repo root with `pnpm`.

| Task | Command | Notes |
| --- | --- | --- |
| Typecheck | `pnpm type-check` | `tsc -b`. **`tsc --noEmit -p tsconfig.json` silently checks nothing** — don't use it. |
| Lint | `pnpm lint` | ESLint over `src`, excluding test/fixture/mock files. |
| Unit tests | `pnpm test:run` | **Always via this script.** Bare `vitest` skips `configs/vitest.config.ts` and disables the no-network fetch guard. |
| E2E (Chrome) | `pnpm test:e2e:chrome` | Prefix `E2E_HEADED=1` to watch it. |
| E2E (Firefox) | `pnpm test:e2e:firefox` | Load smoke test only — see below. |
| Dev build | `pnpm build` | Output in `build/`. `build:firefox` for `build-firefox/`. |
| Prod build + pack | `pnpm build:prod` | Produces the signed `.crx`. |
| API docs | `pnpm run docs` | TypeDoc into `docs/`. `pnpm docs:www` serves them. |
| Codegen | `pnpm run generate` | Logos + `src/constants/suppliers.ts`. Runs automatically as `prebuild`. |

Two script names collide with pnpm's own subcommands and **must** be run as
`pnpm run docs` and `pnpm run pack` — plain `pnpm docs` / `pnpm pack` invoke pnpm's
builtins and fail with a usage error.

`pnpm run generate` rewrites `public/static/images/logo/*` and
`src/constants/suppliers.ts` on every build. Expect that churn in `git status` after a
build — it is not a change you made, and it is not something to "fix".

## Layout

- `src/suppliers/` — one class per supplier plus shared `SupplierBase*` platform bases.
  `index.ts` is the barrel that decides which suppliers are live.
- `src/utils/` — `ProductBuilder`, `Logger`, `search-query/` (AST parsing), `typeGuards/`.
- `src/helpers/` — domain parsing: currency, quantity, CAS, SMILES, purity/grade.
- `src/components/SearchPanel/` — the results table and search UI (the bulk of the app).
- `src/_locales/<lang>/messages.json` — 7 locales, Chrome i18n format.
- `configs/` — vitest, playwright, and typedoc configs. Tests need the config flags.
- `tools/` — build/codegen node scripts (`generate-supplier-constants.js`,
  `extractChangelog.js`, `pack-extension.js`).
- `plugins/` — local TypeDoc plugins, including the taxonomy index.
- `e2e/` — Playwright-driven extension tests. `demo/` — the scripted demo recording.
- `dev/` — **gitignored scratch**, not source. Don't read it for patterns or edit it.
- `docs/` — **generated** TypeDoc output. Never hand-edit; regenerate with `pnpm run docs`.

## Conventions and invariants

**TypeScript style lives in [STYLEGUIDE.md](STYLEGUIDE.md)** — the Google TypeScript style
guide plus ChemPal's deviations. Read its first table before writing code: the two that
catch people out are **double quotes** (not Google's single quotes) and **no `as` / `!`
assertions outside test files**.

Project invariants beyond style, all of which have bitten before:

- **Every function gets a TSDoc block**, including non-exported private helpers — never a
  plain `//` note above a function. `tsdoc/syntax` is an ESLint **error**, so malformed
  blocks fail `pnpm lint`. Tag set and taxonomy: the `typedoc-comments` skill.
- **Declare all class properties at the top of the class**, above the methods. Don't
  interleave a field with the one method that uses it — supplier classes in particular
  keep their whole config block up top.
- **i18n changes hit all 7 locales.** Adding, renaming, or rewording a key in
  `src/_locales/en/messages.json` means the same edit, properly translated, in `de`, `es`,
  `fi`, `hi`, `pl`, and `ru`. Edit them as text — never round-trip a whole `messages.json`
  through a JSON serializer, because placeholder formatting differs between files and a
  reserialize rewrites every key. See the `add-i18n-key` skill.
- **Quantity has two layers.** `quantity` + `uom` are the friendly-metric *display* pair
  (imperial input is converted at the store boundary via `toMetricQuantity`);
  `baseQuantity` is the *sort* scale (`toBaseQuantity`). There is no display-layer
  formatter — don't add one.
- **`ProductBuilder` optional-field setters take `unknown`** and guard internally, so
  suppliers can pass raw scraped values without pre-checking. Required and overloaded
  setters stay strictly typed.
- Named imports from `react` (`import { useState } from "react"`), not the default
  namespace import.

### Tests that don't run

`configs/vitest.config.ts` has an `exclude` list. These files exist but **never run**, so a
green `pnpm test:run` says nothing about them:

- `src/helpers/__tests__/productBuilder.test.ts`
- `src/suppliers/__tests__/supplierMacklin.test.ts`
- `src/__tests__/**`

If you touch the code they cover, run them explicitly and expect breakage.

Tests that import `SupplierBase` must import `ProductBuilder` first — there is a
module-initialization cycle between them.

## Verifying a change

Order: `pnpm type-check` → `pnpm lint` → `pnpm test:run` → E2E if user-facing.
Details in the `verify-changes` skill.

Two hard limits worth knowing before you plan a verification:

- **The Vite dev server cannot verify extension behavior.** `chrome.*` is undefined there,
  so anything touching storage, messaging, or the service worker fails. To check by hand:
  `pnpm build`, then load `build/` unpacked in `chrome://extensions`.
- **Firefox E2E is a load smoke test only.** Playwright cannot drive `moz-extension://`
  UI pages, so `pnpm test:e2e:firefox` proves the extension loads and nothing more.

Prod builds strip MUI icon `data-testid` attributes — target results-header buttons by
`aria-label` or role instead. (`pnpm demo` builds prod.)

The extension console exposes `window.chempal` debug helpers from
`src/utils/debugConsole.ts` (`backgroundFetch`, `getProductById`, `storageBreakdown`,
`simulateUpdate`, …) and fuzzy-scorer probes from `src/utils/fuzzScorerLab.ts`
(`fuzzTest`, `astTest`, `getCachedTitles`) for testing filters offline against cached titles.

## Docs map

| File | Contents |
| --- | --- |
| [README.md](README.md) | Features, install, build prerequisites |
| [STYLEGUIDE.md](STYLEGUIDE.md) | TypeScript house style — modules, naming, types, classes, control flow, comments |
| [RELEASING.md](RELEASING.md) | The release workflow, signing key, version flow |
| [CHANGELOG.md](CHANGELOG.md) | Keep a Changelog format. Write entries **for users**. The release workflow extracts the tag's section via `tools/extractChangelog.js`, and it becomes the in-extension update prompt. |
| `wiki_files/` | Source for the user-facing GitHub wiki |
| `pages/` | Long-form docs published into the TypeDoc site (privacy policy, cache migrations) |
| `STORE-LISTING.md` | Chrome Web Store listing copy |

## Skills

Repeating procedures live in `.claude/skills/`, and are worth reading before starting the
corresponding task even if you're not using Claude Code:

- `add-supplier` — the full checklist for adding a supplier (it touches more files than
  you'd guess).
- `typedoc-comments` — TSDoc tag set and order, `@example` formatting, the
  `@category`/`@group` taxonomy.
- `add-i18n-key` — adding or changing a message key across all 7 locales.
- `verify-changes` — what to run, and what each check does and doesn't prove.
- `cut-release` — cutting and publishing a release.
