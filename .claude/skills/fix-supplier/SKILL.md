---
name: fix-supplier
description: Diagnose and repair a ChemPal supplier that stopped returning results or returns wrong data (missing prices, wrong quantities, empty search). Use when a storefront changed its markup or API, a supplier test or e2e fixture no longer matches the live site, or a user reports a supplier broken. For adding a new supplier use add-supplier.
paths: src/suppliers/**
---

# Fixing a broken supplier

Scrapers break when a storefront changes. Work from evidence, not guesses.

## 1. Reproduce against the live site

Use the `supplier-scout` agent (or fetch by hand) to re-fetch the supplier's search endpoint
and compare the live response with the saved fixture in `src/suppliers/__fixtures__/<name>/`.
Common causes: a renamed JSON field, a changed CSS selector, a new required header or cookie,
a moved search URL, a platform migration (e.g. to Shopify — then the base class changes).

In a built extension, `window.chempal.backgroundFetch(url)` fetches through the service worker
exactly as the supplier does, which is the quickest way to see what the extension sees
(see `src/utils/debugConsole.ts`).

## 2. Update the fixture first

Replace the stale fixture with a fresh captured response (trim it, keep one or two products,
and strip cookies/tokens). Run the supplier's test and watch it fail for the right reason:

```bash
pnpm test:run src/suppliers/__tests__/supplier<Name>.test.ts
```

## 3. Fix the parser

Change the supplier class, not the shared base, unless several suppliers share the break.
Read the invariants in `src/suppliers/AGENTS.md` before editing. If the host changed, update
`baseURL`/`apiURL` and the `public/manifest.json` host permissions together
(`requiredHosts.test.ts` checks they agree).

If the site is now unreachable or hostile (login wall, bot challenge), park it instead: the
`add-supplier` skill covers disabling a supplier (moving it to `disabled/` and out of the barrel).

## 4. Verify and record

```bash
pnpm type-check && pnpm lint && pnpm test:run
```

Add a user-facing line under `## [Unreleased]` → `### Fixed` in `CHANGELOG.md`
(e.g. "Fixed <Supplier> returning no results."). If the supplier's static metadata changed,
`pnpm run generate` refreshes `supplierMeta.generated.ts`.
