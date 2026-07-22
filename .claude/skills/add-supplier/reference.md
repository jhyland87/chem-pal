# Supplier reference

Companion to [SKILL.md](SKILL.md). Read this when choosing a base class or tuning a
supplier's behavior.

## Base classes

All live in `src/suppliers/`. Counts are current implementations, useful as a signal for
which patterns are well-trodden.

| Base | In use | Subclass provides |
| --- | --- | --- |
| `SupplierBase` | 31 | Everything: `titleSelector`, `getUniqueProductKey`, `queryProducts` |
| `SupplierBaseShopify` | 11 | Identity fields + `apiURL` (the `*.myshopify.com` domain) |
| `SupplierBaseWoocommerce` | 7 | Identity fields |
| `SupplierBaseSearchanise` | 6 | Identity fields + the Searchanise API key |
| `SupplierBaseWix` | 5 | Identity fields |
| `SupplierBaseMagento2` | 3 | Identity fields (+ URL-rewrite property where the store uses one) |
| `SupplierBaseAmazon` | 3 | Identity fields + storefront ID |
| `SupplierBaseMySimpleStore` | 1 | Identity fields + `storeId` |

Prefer a platform base. Dropping to raw `SupplierBase` means implementing the whole
search/parse lifecycle by hand.

## Required members

Declared abstract on `SupplierBase` — every supplier must set these:

| Member | Type | Notes |
| --- | --- | --- |
| `supplierName` | `string` | Display name shown in the UI and logs |
| `baseURL` | `string` | `https://…`, no trailing slash. Drives `requiredHosts` |
| `shipping` | `ShippingRange` | Broad shipping scope |
| `country` | `CountryCode` | Drives currency and country-specific behavior |
| `paymentMethods` | `PaymentMethod[]` | Rendered as card icons |

Raw `SupplierBase` subclasses additionally implement:

| Method | Purpose |
| --- | --- |
| `queryProducts(...)` | Run the search and yield raw supplier-shaped results |
| `titleSelector(data)` | Extract the product title used for fuzzy matching |
| `getUniqueProductKey(data)` | Stable per-product identity, for dedupe and caching |
| `setup()` | Optional pre-search step (set a cookie, flip the store to list view) |

## Optional overrides worth knowing

| Member | Default | Use when |
| --- | --- | --- |
| `shipsTo` | — | The supplier only ships to specific countries: `["US", "CN", "NL"]` |
| `apiURL` | — | Search hits a different host than `baseURL`. Auto-added to `requiredHosts` |
| `minMatchPercentage` | `65` | The store's search is noisy (raise) or too strict (lower) |
| `fuzzScorer` | `WRatio` | A different fuzzball scorer matches this store's titles better |
| `fuzzyFilterRankOnly` | `false` | Fuzzy matching should rank but never exclude results |
| `maxFallbackQueries` | `4` | Tune how many query relaxations are attempted |
| `supportsNativeAdvancedSearch` | `false` | The store understands boolean/AST queries itself |
| `skipProductDetailCache` | `false` | Search already returns every field, so detail fetch is a passthrough |
| `requiredCookies` | `[]` | The store needs seeded cookies before it will respond |
| `challengeRetryLimit` / `challengeRetryDelayMs` | `0` / `300` | The store serves interstitial challenges |
| `httpRequestHardLimit` | — | Cap total requests per search |
| `maxConcurrentRequests` | — | Throttle parallel detail fetches for fragile stores |

## Files a supplier touches

Derived from the commits that added Consolidated Chemical (`a1b0b8c`) and Orbit Natural
Product Derivatives (`462f319`):

- `src/suppliers/Supplier<Name>.ts` — the class
- `src/suppliers/index.ts` — barrel export
- `src/constants/suppliers.ts` — generated, via `pnpm run generate-supplier-constants`
- `public/manifest.json` — `host_permissions`
- `src/suppliers/__fixtures__/<name>/` or `__mocks__/<name>/` — captured responses
- `src/suppliers/__tests__/supplier<Name>.test.ts` — the test
- `CHANGELOG.md` — user-facing entry under `## [Unreleased]`
- `src/_locales/*/messages.json` — only if the supplier needs new UI copy
- A new `SupplierBase*` file, if this supplier is the first on its platform

Ignore `public/static/images/logo/*` changes — `pnpm run generate` rewrites them on every
build and they are unrelated to the supplier.
