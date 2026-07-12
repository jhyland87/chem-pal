# Contributing & Development

This wiki is a **user guide**. If you want to build, extend, or contribute to
ChemPal, here's where to go.

- **Source code & README** —
  [github.com/jhyland87/chem-pal](https://github.com/jhyland87/chem-pal). The README
  covers prerequisites, cloning, and the full set of build/test scripts.
- **Building from source** — see [Installation → Build it yourself](Installation#build-it-yourself)
  for the quick version (`pnpm run setup` → `pnpm run build` / `build:firefox`).
- **API documentation** — the codebase is documented with TypeDoc. Generate the
  browsable API docs locally with:
  ```bash
  pnpm run docs      # generate into docs/
  pnpm run wwwdocs   # serve them at http://localhost:8080
  ```
- **Issues & feature requests** — use the
  [GitHub issue tracker](https://github.com/jhyland87/chem-pal/issues).

## Adding a supplier

New suppliers are the most valuable contribution. Each supplier is a small class
under `src/suppliers/` that implements a standard search/parse lifecycle; adding one
to `src/suppliers/index.ts` makes it appear automatically in searches and in the
supplier settings. See the code and the generated API docs for the base classes and
patterns to follow.

---

**Back to:** [Home](Home)
