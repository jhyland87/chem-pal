# IndexedDB Object Stores

This document describes the structure of the `chempal` IndexedDB database — every object store, its key, indexes, value shape, size limits, and the functions that read and write it. All access goes through `src/utils/idbCache.ts`.

## Key Concepts

- **One database, `chempal`**: Opened once via a singleton (`getDB()`) using the [`idb`](https://github.com/jakearchibald/idb) wrapper. Current schema version is **7** (`DB_VERSION`). Object stores are created in the `upgrade` callback.
- **Store names are centralized**: Every store name lives in the `IDB_STORE` constant (`src/constants/common.ts`) and is **snake_case** to match the `chrome.storage` key convention (`CACHE`). `IDB_STORE` is an `as const` object rather than a string enum because idb's typed store-name API needs literal string types.
- **IndexedDB vs `chrome.storage`**: Bulk/cached data lives here in IndexedDB (no quota pressure). Lightweight app state — user settings, session query, table state — stays in `chrome.storage` via the `cstorage` wrapper and the `CACHE` enum. The two are separate namespaces.
- **Single-row stores**: `search_results`, `excluded_products`, and `app_meta` hold everything under one row keyed `"current"`, so a read/write is a full replace of that row.
- **Capacity caps live in `config.json`**: The tunables — `maxSupplierCacheEntries` (100), `maxHistoryEntries` (100), `maxExportEntries` (20), and `maxExportsCacheBytes` (25 MB) — are build-time config, not hardcoded constants.
- **Two LRU-capped caches**: `supplier_query_cache` and `supplier_product_data_cache` each cap at `maxSupplierCacheEntries`, evicting the least-recently-used via an index (`cachedAt` / `timestamp`).
- **Schema version ≠ cache version**: `DB_VERSION` (7) versions the IndexedDB schema. `SupplierCache.CACHE_VERSION` (4), stored in each query-cache entry's `__cacheMetadata.version`, versions the cached *payload* format and evicts stale entries on read — independent of the DB schema version. A third version, the app version stamped in `app_meta`, drives the `src/migrations/` step chain.
- **`clearAllCaches` spares user data**: The bulk clear wipes six cache/derived stores but **not** `price_history` (user-accumulated data with its own clear action), `exports` (saved spreadsheets with their own delete actions), or `app_meta` (the migration marker — wiping it would re-run migrations).

## Overview

```mermaid
flowchart LR
linkStyle default stroke-width:4px;
classDef idb fill:#E67E22,stroke:#D35400,color:#fff,font-weight:bold
classDef single fill:#8E44AD,stroke:#6C3483,color:#fff,font-weight:bold
classDef lru fill:#E74C3C,stroke:#C0392B,color:#fff,font-weight:bold
classDef user fill:#27AE60,stroke:#1E8449,color:#fff,font-weight:bold
classDef meta fill:#34495E,stroke:#22303D,color:#fff,font-weight:bold

subgraph DB["IndexedDB — chempal (v7)"]
direction TB
SR[("search_results\nkey: id ('current')\nvalue: Product[]")]
EX[("excluded_products\nkey: id ('current')\nvalue: ExcludedProductsMap")]
AM[("app_meta\nkey: id ('current')\nvalue: appVersion + updatedAt")]
SH[("search_history\nkey: timestamp\nmax maxHistoryEntries (LRU by age)")]
QC[("supplier_query_cache\nkey: base64(query:supplier)\nindex: cachedAt · LRU")]
PC[("supplier_product_data_cache\nkey: md5({key,supplier})\nindex: timestamp · LRU")]
SS[("supplier_stats\nkey: YYYY-MM-DD")]
PH[("price_history\nkey: id\nindex: productKey")]
XP[("exports\nkey: id\nindex: createdAt\ncapped by count + bytes")]
end

class SR,EX single
class SH,SS idb
class QC,PC lru
class PH,XP user
class AM meta
```

## Stores

### `search_results`

The most recent search's results, so the table can rehydrate on popup reopen.

| Property | Value |
| --- | --- |
| Key path | `id` (single row keyed `"current"`) |
| Indexes | none |
| Value | `{ id: string; data: Product[] }` |
| Access | `getSearchResults`, `setSearchResults`, `clearSearchResults` |

`setSearchResults` runs `findDuplicateProductIds` and **warns** (does not silently drop) when two products share an identity — a signal that a search fired twice or a supplier emitted duplicates. `clearSearchResults` dispatches the `IDB_SEARCH_RESULTS_CLEARED` window event so the UI can react.

### `search_history`

Past searches, newest-first on read.

| Property | Value |
| --- | --- |
| Key path | `timestamp` (epoch ms) |
| Indexes | none |
| Value | `SearchHistoryEntry` → `{ timestamp, type: "search", query, resultCount, filters?, selectedSuppliers?, data? }` |
| Limit | `maxHistoryEntries` (`config.json`, default 100); oldest entries trimmed via cursor when exceeded |
| Access | `getSearchHistory`, `addSearchHistoryEntry`, `updateSearchHistoryResultCount`, `clearSearchHistory` |

`resultCount` is updated live as results stream in for the entry keyed by its start timestamp.

### `supplier_query_cache`

Whole search-result sets, cached per query + supplier so a repeat search skips the network. Stores **serialized `ProductBuilder` snapshots** (`ProductBuilder.dump()`), not response HTML.

| Property | Value |
| --- | --- |
| Key path | `cacheKey` = `base64(query + supplierName)` (`generateCacheKey`) |
| Indexes | `cachedAt` → `__cacheMetadata.cachedAt` |
| Value | `{ cacheKey, data: unknown[], __cacheMetadata }` |
| `__cacheMetadata` | `{ cachedAt, version, query, supplier, supplierModule, resultCount, limit }` |
| Limit | `maxSupplierCacheEntries` (`config.json`, default 100); LRU-evict oldest by `cachedAt` on write |
| Eviction on read | TTL (`cacheTtlMinutes`) and version mismatch (`version !== CACHE_VERSION`) |
| Invalidation | Entry dropped when a new search requests more results than the cached `limit` |
| Access | `getSupplierQueryCacheEntry`, `putSupplierQueryCacheEntry`, `deleteSupplierQueryCacheEntry`, `getAllSupplierQueryCacheEntries`, `clearSupplierQueryCache` |

### `supplier_product_data_cache`

Enriched per-product detail data, keyed by the product's **stable identity** so a product enriched under one search hydrates any other search that surfaces it.

| Property | Value |
| --- | --- |
| Key path | `cacheKey` = `md5({ key: identity, supplier })` (`getProductIdentityKey`; `identity` = `getUniqueProductKey`) |
| Indexes | `timestamp` |
| Value | `{ cacheKey, data: Record<string, unknown>, timestamp }` |
| Limit | `maxSupplierCacheEntries` (`config.json`, default 100); LRU-evict oldest by `timestamp` on write |
| Timestamp | Refreshed on cache hit so active entries aren't evicted |
| Access | `getSupplierProductDataCacheEntry`, `putSupplierProductDataCacheEntry`, `deleteSupplierProductDataCacheEntry`, `getAllSupplierProductDataCacheEntries`, `clearSupplierProductDataCache` |

### `supplier_stats`

Per-day, per-supplier HTTP/parse counters for the stats panel. Cached responses do **not** increment HTTP counts.

| Property | Value |
| --- | --- |
| Key path | `dateKey` (`"YYYY-MM-DD"`) |
| Indexes | none |
| Value | `{ dateKey, suppliers: Record<supplierName, SupplierDayStats> }` |
| `SupplierDayStats` | `{ searchQueryCount, successCount, failureCount, uniqueProductCount, parseErrorCount }` |
| Access | `getSupplierStatsEntry`, `putSupplierStatsEntry`, `getAllSupplierStats`, `deleteSupplierStatsEntries`, `clearSupplierStats` |

`putSupplierStatsEntry` dispatches the `IDB_SUPPLIER_STATS_UPDATED` window event so the stats panel refreshes live during a search.

### `excluded_products`

The user's "Ignore Product" list. Matched by the **same identity** as the product-detail cache, so ignoring a product hides it across searches.

| Property | Value |
| --- | --- |
| Key path | `id` (single row keyed `"current"`) |
| Indexes | none |
| Value | `{ id: string; map: ExcludedProductsMap }` |
| `ExcludedProductsMap` | `Record<md5 identity, { url?, supplier, title?, excludedAt }>` |
| Access | `getExcludedProducts`, `putExcludedProducts`, `clearExcludedProducts` |

### `price_history`

Per-product/per-variant USD price series over time. See [Price Tracking](./price-tracking.md) for the full recording process.

| Property | Value |
| --- | --- |
| Key path | `id` = `${productKey}` (base) or `${productKey}::${variantKey}` (variant) |
| Indexes | `productKey` (fetch a product's base + all variant series in one query) |
| Value | `PriceHistoryEntry` → `{ id, productKey, variantKey?, variantId?, supplier, title, permalink?, points: { t, usd }[], updatedAt }` |
| Access | `getPriceSeries`, `putPriceSeries`, `getPriceSeriesByProduct`, `clearPriceHistory` |

### `app_meta`

The app version that last wrote or migrated the cache. Read on startup to decide which `src/migrations/` steps still need to run; `undefined` means a fresh install, so the current version is seeded rather than migrated.

| Property | Value |
| --- | --- |
| Key path | `id` (single row keyed `"current"`) |
| Indexes | none |
| Value | `{ id: string; appVersion: string; updatedAt: number }` |
| Access | `getStoredAppVersion`, `setStoredAppVersion` |

### `exports`

Generated `.xlsx` result exports, retained so the export-history list can re-download a past export without re-running the search.

| Property | Value |
| --- | --- |
| Key path | `id` |
| Indexes | `createdAt` (newest-first listing and eviction order) |
| Value | `ExportRecord` → `{ id, createdAt, filename, query?, scope: "all" \| "filtered", rowCount, sizeBytes, blob }` |
| Limit | **Two caps, whichever binds first**: `maxExportEntries` (default 20) and `maxExportsCacheBytes` (default 25 MB); oldest evicted first on write |
| Access | `putExport`, `getAllExports`, `deleteExport`, `clearExports` |

`sizeBytes` is tracked explicitly because the record holds a `Blob` — `JSON.stringify` flattens Blobs to `{}`, so the storage-breakdown UI sums `sizeBytes` instead of measuring the serialized row.

## Bulk Clear & Versioning

- **`clearAllCaches()`** clears, in one transaction: `search_results`, `search_history`, `supplier_query_cache`, `supplier_product_data_cache`, `supplier_stats`, and `excluded_products` — then dispatches `IDB_SEARCH_RESULTS_CLEARED`. `price_history`, `exports`, and `app_meta` are intentionally left intact.
- **Schema migrations** run in the `upgrade` callback. Each store is created behind an `objectStoreNames.contains(...)` guard, so bumping `DB_VERSION` adds new stores without touching existing ones.
- **Data migrations** are separate from schema migrations: `src/migrations/registry.ts` loads semver-named step files (`vX.Y.Z-to-vX.Y.Z.ts` under `src/migrations/steps/`), compares the `app_meta` version marker against the running build, runs the pending chain, and re-stamps the marker.

## Key Files

| File | Responsibility |
| --- | --- |
| `src/utils/idbCache.ts` | Schema (`ChemPalDBSchema`), `getDB()` singleton, and all store CRUD |
| `src/constants/common.ts` | `IDB_STORE` store-name constants; `CACHE` (chrome.storage keys) |
| `src/utils/SupplierCache.ts` | Class wrapper over the two supplier caches; owns `CACHE_VERSION` and key generation |
| `src/helpers/excludedProducts.ts` | `ExcludedProductsMap` shape and the exclusion helpers |
| `src/helpers/productIdentity.ts` | `getProductIdentityKey` — the shared identity used by the product cache and exclusions |
| `src/migrations/registry.ts` | Version-marker comparison and the ordered data-migration step chain |
| `config.json` | Capacity caps: `maxSupplierCacheEntries`, `maxHistoryEntries`, `maxExportEntries`, `maxExportsCacheBytes` |
