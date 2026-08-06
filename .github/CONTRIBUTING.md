# Contributing to ChemPal

Thanks for your interest in ChemPal! It's an open-source browser extension that
helps amateur chemistry hobbyists compare prices across chemical suppliers from a
single interface. Contributions of all sizes are welcome — bug fixes, new
suppliers, docs, translations, or ideas.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first — it applies to all
project spaces. The [wiki](https://github.com/jhyland87/chem-pal/wiki) has more
background and troubleshooting.

## Prerequisites

- **Node** ≥ 22.15.0 and **npm** ≥ 10.9.2 (use [nvm](https://github.com/nvm-sh/nvm)
  if you need to switch versions).
- **pnpm** — this project uses pnpm, not npm, for installing and running scripts:

  ```bash
  npm install -g pnpm
  ```

## Getting started

```bash
git clone https://github.com/jhyland87/chem-pal.git
cd chem-pal
pnpm run setup      # install dependencies
pnpm build          # dev build → build/
```

Then load `build/` as an unpacked extension at `chrome://extensions` (enable
**Developer mode** first). For Firefox, run `pnpm build:firefox` and load
`build-firefox/manifest.json` as a temporary add-on at
`about:debugging#/runtime/this-firefox`.

> [!NOTE]
> The Vite dev server **cannot** verify extension behavior — `chrome.*` is
> undefined there, so anything touching storage, messaging, or the service worker
> fails. To test by hand, `pnpm build` and load the unpacked extension.

> [!NOTE]
> `pnpm build` runs logo codegen that rewrites `public/static/images/logo/*`.
> That churn in `git status` is expected — it's not a change you made.

## Before you open a PR

Run these in order — this is the same sequence CI uses:

```bash
pnpm type-check     # tsc -b
pnpm lint           # ESLint
pnpm test:run       # unit tests (Vitest)
pnpm format         # Prettier — don't hand-fix quotes/wrapping
```

Add `pnpm test:e2e:chrome` if your change is user-facing.

> [!IMPORTANT]
> Always run unit tests via `pnpm test:run` (not bare `vitest`) — the script
> applies `configs/vitest.config.ts` and the no-network fetch guard, which bare
> `vitest` skips.

## Code style

The house style is the Google TypeScript style guide plus ChemPal's deviations —
see [STYLEGUIDE.md](../STYLEGUIDE.md). Two invariants catch people out:

- **No `as` / `!` type assertions outside test files.** Use type guards, runtime
  checks, or properly-typed values instead.
- **Every function gets a TSDoc block**, including private helpers. `tsdoc/syntax`
  is an ESLint error, so a malformed block fails `pnpm lint`.

Detailed guidance for AI agents (and humans who want the full workflow) lives in
[AGENTS.md](../AGENTS.md).

## Adding a supplier

Adding a supplier is the most common contribution, and it touches more files than
you'd expect (the barrel, host permissions, fixtures, tests, the changelog). The
full checklist is in `.claude/skills/add-supplier/`. Supplier classes live in
`src/suppliers/`, one class per supplier on top of the shared `SupplierBase*`
platform bases.

## Reporting bugs and requesting features

- **Bugs:** the easiest path is the in-extension bug report — it prefills your
  version, diagnostics, and logs. You can also open a
  [bug report issue](https://github.com/jhyland87/chem-pal/issues/new/choose)
  directly. Search existing issues first to avoid duplicates.
- **Feature requests:** open an issue and apply the `enhancement` label.
- **Security issues:** please **don't** open a public issue — see
  [SECURITY.md](SECURITY.md).

## Commits and pull requests

- Write clear, imperative commit messages ("Add Foo supplier", not "added stuff").
- Open your pull request against the `main` branch and fill out the PR template.
- Keep PRs focused — one logical change per PR is easier to review.

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](../LICENSE).
