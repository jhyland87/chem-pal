# Caching

ChemPal uses a tiered storage architecture to cache search results, product data, and application state. Bulk cached data (search results, supplier caches, search history, supplier stats) lives in **IndexedDB** for performance and capacity, while lightweight app state (user settings, UI state, excluded products) remains in **chrome.storage**. All `chrome.storage` writes optionally flow through the `cstorage` compression wrapper (see [Transparent Compression](#transparent-compression)).

## Key Concepts

- **IndexedDB for cached data**: Query results, product details, search history, and supplier stats are stored in IndexedDB (`chempal` database, version 2) for better performance with large datasets and no quota pressure on `chrome.storage`
- **chrome.storage for app state**: User settings, table state, excluded products, and session state (current query, panel) remain in `chrome.storage.local` / `chrome.storage.session`
- **Two independent supplier caches**: Query results and product details are cached separately in IndexedDB with different key generation strategies
- **LRU eviction**: Both supplier caches cap at 100 entries, evicting the least recently used when full (using IndexedDB indexes on `cachedAt` / `timestamp`)
- **Limit-aware invalidation**: The query cache invalidates entries when a new search requests more results than the cached limit
- **Timestamp refresh on read**: Product data cache updates `timestamp` on hit to prevent active entries from being evicted
- **Serialization**: `ProductBuilder.dump()` serializes builders for storage; `ProductBuilder.createFromCache()` re-hydrates them
- **Optional compression**: `src/utils/storage.ts` wraps `chrome.storage` with lz-string (UTF-16) compression, controlled by the `useStorageCompression` flag in `config.json`
- **One-time migration**: `idbMigration.ts` migrates legacy `chrome.storage` cache data to IndexedDB on first run

## Storage Architecture

### IndexedDB (`chempal` database, v2)

| Object Store | Key | Purpose | Max Entries | Eviction |
|---|---|---|---|---|
| `searchResults` | `"current"` (single record) | Last search result set | 1 | Overwritten |
| `searchHistory` | `timestamp` | Search history entries | 100 | Oldest pruned on add |
| `supplierQueryCache` | `base64(query:supplier)` | Per-supplier search result lists | 100 | LRU by `cachedAt` index |
| `supplierProductDataCache` | `MD5(url + supplier + params)` | Per-URL product detail snapshots | 100 | LRU by `timestamp` index |
| `supplierStats` | `YYYY-MM-DD` | Per-supplier, per-day statistics | 30 days | Auto-pruned beyond 30 days |

### chrome.storage.local (via `cstorage`)

| Key | Purpose |
|---|---|
| `USER_SETTINGS` | User preferences (theme, currency, suppliers, etc.) |
| `HTTP_LRU` | LRU cache for HTTP responses (100 max entries) |
| `EXCLUDED_PRODUCTS` | Map of user-excluded products |
| `TABLE_STATE` | TanStack table state (sorting, pagination, column visibility) |
| `SELECTED_SUPPLIERS` | Array of selected supplier names |
| `BOOKMARKS_FOLDER_ID` | Chrome bookmarks folder ID for ChemPal favorites |

### chrome.storage.session (via `cstorage`)

| Key | Purpose |
|---|---|
| `QUERY` | Current search query string |
| `SEARCH_INPUT` | Current search input text |
| `SEARCH_IS_NEW_SEARCH` | Boolean flag for new search detection |
| `PANEL` | Current panel index (0=SearchHome, 1=Results, 2=Stats) |

## Transparent Compression

All `chrome.storage` access flows through `cstorage`, a compression-aware facade exported from `src/utils/storage.ts`. Compression is controlled by the `useStorageCompression` flag in `config.json` — when `true`, values are LZ-compressed at rest; when `false`, values are stored as plain JSON.

> **Note:** IndexedDB data is **not** compressed via `cstorage`. The compression layer only applies to `chrome.storage.local` and `chrome.storage.session` access.

### Wire format

When compression is enabled, values are wrapped in a small envelope so reads can distinguish compressed from legacy entries:

```ts
interface LzEnvelope {
  __lz: 1;   // version tag (LZ_VERSION)
  d: string; // lz-string compressToUTF16 output
}
```

On `set`, values are `JSON.stringify`ed and run through `compressToUTF16`, then wrapped in the envelope. On `get`, `isLzEnvelope(value)` decides whether to decompress and `JSON.parse`, or pass the value through unchanged (backward compatibility for data that was written before the wrapper shipped, or written directly via `chrome.storage.*`).

### Two-layer design

The module is intentionally split so the compression logic is directly unit-testable without mocking `chrome.*`:

- **Pure codec** — `encodeValue`, `decodeValue`, `encodeItems`, `decodeItems`, `decodeChanges`, `isLzEnvelope`. No `chrome.*` access.
- **Adapter** — `cstorage.local`, `cstorage.session`, `cstorage.onChanged`. Thin shim that delegates to the codec and talks to `chrome.storage`.

`cstorage.onChanged.addListener` wraps the caller's listener so that `oldValue` / `newValue` in the change payload are already decompressed. A `WeakMap` tracks the outer→inner listener mapping so `removeListener` works as expected.

### Compression toggle

The `useStorageCompression` flag in `config.json` controls whether `encodeValue()` compresses or passes through:

```json
{
  "useStorageCompression": false
}
```

When `false`, `encodeValue()` returns the raw value without wrapping it in an `LzEnvelope`. `decodeValue()` always handles both compressed envelopes and raw values, so toggling the flag is fully backward-compatible with existing data.

### Backward compatibility

- Reads auto-detect envelopes, so pre-compression data in users' browsers continues to work after upgrade.
- Reads of externally-written envelopes (e.g. another page that imports `cstorage`) are transparent.
- If compression or decompression fails, the wrapper logs via `Logger("storage")` and falls back to the raw value so cached data is never lost on a codec error.
- The envelope carries a `__lz` version tag (`LZ_VERSION = 1`) so the wire format can be migrated in the future.

## One-Time Migration

`idbMigration.ts` runs once before React renders (called from `main.tsx`). It migrates legacy `chrome.storage` cache data to IndexedDB:

| Legacy Key (chrome.storage) | Target (IndexedDB store) |
|---|---|
| `search_results` (session) | `searchResults` |
| `search_history` (local) | `searchHistory` |
| `supplier_query_cache` (local) | `supplierQueryCache` |
| `supplier_product_data_cache` (local) | `supplierProductDataCache` |
| `supplier_stats_*` and legacy `supplierStats` (local) | `supplierStats` (with date key conversion) |

The migration is idempotent — it checks the `__idb_migrated` flag in `chrome.storage.local` and skips if already run. After migration, legacy cache keys are removed from `chrome.storage`. Non-cache keys (`USER_SETTINGS`, `HTTP_LRU`, `EXCLUDED_PRODUCTS`, etc.) are not touched.

## Cache Architecture

```mermaid
flowchart TB

subgraph Init["Cache Initialization"]
direction TB
SB["SupplierBase constructor"]
IC["initCache()\nthis.cache = new SupplierCache(supplierName)"]
SC["SupplierCache instance\nscoped to supplier name\ne.g. Loudwolf, Onyxmet"]
SB --> IC --> SC
end

subgraph Storage["Storage Backend"]
direction LR
subgraph IDB["IndexedDB (chempal db)"]
direction TB
QCS[("supplierQueryCache\nQuery Results\nkey: base64(query:supplier)\nindex: cachedAt")]
PDS[("supplierProductDataCache\nProduct Data\nkey: MD5(url+supplier+params)\nindex: timestamp")]
SRS[("searchResults\nCurrent Results\nkey: 'current'")]
SHS[("searchHistory\nSearch History\nkey: timestamp")]
SSS[("supplierStats\nSupplier Stats\nkey: YYYY-MM-DD")]
end
subgraph CS["chrome.storage (via cstorage)"]
direction TB
LOCAL[("chrome.storage.local\nUSER_SETTINGS, HTTP_LRU,\nEXCLUDED_PRODUCTS,\nTABLE_STATE, etc.")]
SESSION[("chrome.storage.session\nQUERY, PANEL,\nSEARCH_INPUT")]
end
end

subgraph QueryCache["Query Results Cache Flow"]
direction TB
QPC["queryProductsWithCache(query, limit)"]
subgraph KeyGen1["Key Generation"]
GCK["generateCacheKey(query, supplierName)\nbase64(query + supplierName)\nfallback: Buffer then MD5 hash"]
end
QPC --> GCK
QLOOKUP{"Cache lookup\ncache key exists?"}
GCK --> QLOOKUP
subgraph CacheHit1["Cache Hit"]
direction TB
LIMITCHK{"cached.limit\nless than requested limit?"}
INVALIDATE["Invalidate entry\ndelete cache key"]
RESTORE["ProductBuilder.createFromCache(baseURL, data)\nre-hydrate builders from\ncached serialized data\nslice to requested limit"]
LIMITCHK -->|"yes - insufficient data"| INVALIDATE
LIMITCHK -->|"no - sufficient"| RESTORE
end
subgraph CacheMiss1["Cache Miss"]
direction TB
QP["queryProducts(query, limit)\nsupplier-specific fetch"]
DUMP1["results.map b.dump\nserialize ProductBuilders"]
SAVE1["cache.cacheQueryResults(\nquery, supplierName, results, limit)"]
QP --> DUMP1 --> SAVE1
end
QLOOKUP -->|"hit"| CacheHit1
QLOOKUP -->|"miss"| CacheMiss1
INVALIDATE -->|"re-fetch"| CacheMiss1
end

SAVE1 -->|"write"| QCS
QLOOKUP -.->|"read"| QCS
INVALIDATE -.->|"delete"| QCS

subgraph ProductCache["Product Data Cache Flow"]
direction TB
GPD["getProductData(product)\ncalled per product in execute() loop"]
subgraph KeyGen2["Key Generation"]
GPCK["getProductDataCacheKey(url, supplierName, params?)\nMD5 hash of url + supplierName + params"]
end
GPD --> GPCK
PLOOKUP{"getCachedProductData(key)\nexists?"}
GPCK --> PLOOKUP
subgraph CacheHit2["Cache Hit"]
direction TB
TOUCH["updateProductDataCacheTimestamp(key)\nrefresh timestamp to prevent\nLRU eviction"]
SETDATA["product.setData(cachedData)\nhydrate builder with\ncached product details"]
TOUCH --> SETDATA
end
subgraph CacheMiss2["Cache Miss"]
direction TB
FETCH["getProductDataWithCache(product, fetcher, params)\ncall supplier-specific fetcher"]
DUMP2["resultBuilder.dump()\nserialize product data"]
SAVE2["cache.cacheProductData(key, data)"]
FETCH --> DUMP2 --> SAVE2
end
PLOOKUP -->|"hit"| CacheHit2
PLOOKUP -->|"miss"| CacheMiss2
end

SAVE2 -->|"write"| PDS
PLOOKUP -.->|"read"| PDS
TOUCH -.->|"update timestamp"| PDS

subgraph LRU["LRU Eviction Policy"]
direction TB
MAX["Max entries: 100 per cache\nquery cache and product cache\neach have independent limits"]
EVICT["On write: if entries >= 100\nsort by cachedAt/timestamp ascending\ndelete oldest entry via IDB index"]
MAX --- EVICT
end

SAVE1 -.->|"triggers if full"| LRU
SAVE2 -.->|"triggers if full"| LRU

subgraph Metadata["CacheMetadata - per entry"]
direction LR
META["cachedAt: timestamp\nversion: 1\nquery: search term\nsupplier: supplier name\nresultCount: number of results\nlimit: requested limit"]
end

SAVE1 -.->|"attached as __cacheMetadata"| Metadata
SAVE2 -.->|"attached as __cacheMetadata"| Metadata

classDef init fill:#4A90D9,stroke:#2C5F8A,color:#fff,font-weight:bold
classDef idb fill:#E67E22,stroke:#D35400,color:#fff,font-weight:bold
classDef cstorage fill:#16A085,stroke:#0E6B57,color:#fff,font-weight:bold
classDef cacheFlow fill:#5A7D8B,stroke:#3E5A66,color:#fff
classDef hit fill:#27AE60,stroke:#1E8449,color:#fff
classDef miss fill:#D97B2A,stroke:#A35D1F,color:#fff
classDef decision fill:#F5D76E,stroke:#C5A83D,color:#333,font-weight:bold
classDef lru fill:#E74C3C,stroke:#C0392B,color:#fff
classDef meta fill:#8E44AD,stroke:#6C3483,color:#fff
classDef keygen fill:#1ABC9C,stroke:#148F77,color:#fff

class SB,IC,SC init
class QCS,PDS,SRS,SHS,SSS idb
class LOCAL,SESSION cstorage
class QPC,GPD cacheFlow
class RESTORE,SETDATA,TOUCH hit
class QP,DUMP1,SAVE1,FETCH,DUMP2,SAVE2 miss
class QLOOKUP,PLOOKUP,LIMITCHK decision
class MAX,EVICT,INVALIDATE lru
class META meta
class GCK,GPCK keygen
```

## Query Cache vs Product Data Cache

| | Query Results Cache | Product Data Cache |
|---|---|---|
| **Storage** | IndexedDB `supplierQueryCache` | IndexedDB `supplierProductDataCache` |
| **Purpose** | Cache search result lists | Cache individual product details |
| **Key** | `base64(query + supplier)` | `MD5(url + supplier + params)` |
| **Stored data** | Array of serialized `ProductBuilder` snapshots | Single serialized `ProductBuilder` snapshot |
| **Invalidation** | When requested limit exceeds cached limit | LRU eviction only |
| **Written** | After `queryProducts()` returns results | After `getProductData()` fetches a product page |
| **Max entries** | 100 | 100 |
| **LRU index** | `cachedAt` | `timestamp` |
