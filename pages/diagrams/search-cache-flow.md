# Search Cache System

This diagram details how ChemPal caches search results and product data using **IndexedDB** to avoid redundant network requests across searches. Lightweight app state remains in `chrome.storage` via the `cstorage` wrapper.

## Key Concepts

- **IndexedDB for cached data**: Query results, product details, search history, and supplier stats are stored in IndexedDB (`chempal` database, version 2) for better performance and no quota pressure on `chrome.storage`
- **chrome.storage for app state**: User settings, table state, excluded products, and session state remain in `chrome.storage.local` / `chrome.storage.session`
- **Two independent supplier caches**: Query results and product details are cached separately in IndexedDB with different key generation strategies
- **LRU eviction**: Both supplier caches cap at 100 entries, evicting the least recently used when full (using IndexedDB indexes on `cachedAt` / `timestamp`)
- **Limit-aware invalidation**: The query cache invalidates entries when a new search requests more results than the cached limit
- **Status-aware product caching**: A product's detail fetch is **not** cached when it hit a status in `noCacheStatusCodes` (default `[429]`) or when the search was aborted by `maxAllowableSearchTime` — the product is still listed, but stays uncached so the next search retries it (`SupplierBase.shouldCacheProductData`)
- **Timestamp refresh on read**: Product data cache updates `timestamp` on hit to prevent active entries from being evicted
- **Serialization**: `ProductBuilder.dump()` serializes builders for storage; `ProductBuilder.createFromCache()` re-hydrates them
- **Optional compression**: `chrome.storage` writes optionally flow through `cstorage` (`src/utils/storage.ts`), which can LZ-compress values at rest via `lz-string` `compressToUTF16` wrapped in an `LzEnvelope` (`{ __lz: 1, d: "..." }`), controlled by `useStorageCompression` in `config.json`. Reads auto-detect the envelope and decompress, falling back to raw values for legacy data. IndexedDB data is **not** compressed via `cstorage`.
- **One-time migration**: `idbMigration.ts` migrates legacy `chrome.storage` cache data to IndexedDB on first run


Whats important to know about the cache is that the cache is keyed by the unique request data, but its not the response object that is cached. Its the standardized search results and the standardized product data that is cached (why cache the entire page when we know exactly what data we need? Easier to cache _that_ data).

There are a few reasons behind having two different types of caches:
1. **We can use cached product data in different search results** - Sometimes search results may share the same data, and this lets us use cached data from one result set in another.
   - Example: If you were to query `sodium borohydride`, theres a possibility that you may find `sodium triacitoxyborohydride` in the results. If you then go and specifically query `sodium triacitoxyborohydride`, any of the cached `sodium triacitoxyborohydride` products that were erronously included in the results for `sodium borohydride` will be what gets included in the results.
2. **This gives us more granular control over the cache** -  Single products can be invalidated and cached without impacting the cache for all products in that search result.


## Diagrams

The two supplier caches are independent, so each flow is its own graph below.
Shared pieces (cache initialization, LRU eviction, and the `__cacheMetadata`
envelope) appear in both. The storage backend that both write to is shown as a
separate reference graph at the end.


```mermaid
%%{init: {'theme': 'default', 'config': {'useMaxWidth': false}}}%%
flowchart LR
classDef init fill:#4A90D9,stroke:#2C5F8A,color:#fff,font-weight:bold

subgraph Init["Cache Initialization"]
direction LR
SB["SupplierBase constructor"]
IC["initCache()\nthis.cache = new SupplierCache(supplierName)"]
SC["SupplierCache instance\nscoped to supplier name\ne.g. Loudwolf, Onyxmet"]
SB --> IC --> SC
end

class SB,IC,SC init
```

### Query Results Cache Flow

```mermaid
flowchart TB
classDef init fill:#4A90D9,stroke:#2C5F8A,color:#fff,font-weight:bold
classDef idb fill:#E67E22,stroke:#D35400,color:#fff,font-weight:bold
classDef cacheFlow fill:#5A7D8B,stroke:#3E5A66,color:#fff
classDef hit fill:#27AE60,stroke:#1E8449,color:#fff
classDef miss fill:#D97B2A,stroke:#A35D1F,color:#fff
classDef decision fill:#F5D76E,stroke:#C5A83D,color:#333,font-weight:bold
classDef lru fill:#E74C3C,stroke:#C0392B,color:#fff
classDef meta fill:#8E44AD,stroke:#6C3483,color:#fff
classDef keygen fill:#1ABC9C,stroke:#148F77,color:#fff

%% subgraph Init["Cache Initialization"]
%% direction TB
%% SB["SupplierBase constructor"]
%% IC["initCache()\nthis.cache = new SupplierCache(supplierName)"]
%% SC["SupplierCache instance\nscoped to supplier name\ne.g. Loudwolf, Onyxmet"]
%% SB --> IC --> SC
%% end

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

QCS[("supplierQueryCache\nkey: base64(query:supplier)\nindex: cachedAt")]
SAVE1 -->|"write"| QCS
QLOOKUP -.->|"read"| QCS
INVALIDATE -.->|"delete"| QCS

subgraph LRU["LRU Eviction Policy"]
direction TB
MAX["Max entries: 100 per cache\nquery cache and product cache\neach have independent limits"]
EVICT["On write: if entries >= 100\nsort by cachedAt/timestamp ascending\ndelete oldest entry via IDB index"]
MAX --- EVICT
end
SAVE1 -.->|"triggers if full"| LRU

subgraph Metadata["CacheMetadata - per entry"]
direction LR
META["cachedAt: timestamp\nversion: 2\nquery: search term\nsupplier: display name\nsupplierModule: class name\nresultCount: number of results\nlimit: requested limit"]
end
SAVE1 -.->|"attached as __cacheMetadata"| Metadata

class SB,IC,SC init
class QCS idb
class QPC cacheFlow
class RESTORE hit
class QP,DUMP1,SAVE1 miss
class QLOOKUP,LIMITCHK decision
class MAX,EVICT,INVALIDATE lru
class META meta
class GCK keygen
```

### Product Data Cache Flow


```mermaid
flowchart TB
classDef init fill:#4A90D9,stroke:#2C5F8A,color:#fff,font-weight:bold
classDef idb fill:#E67E22,stroke:#D35400,color:#fff,font-weight:bold
classDef cacheFlow fill:#5A7D8B,stroke:#3E5A66,color:#fff
classDef hit fill:#27AE60,stroke:#1E8449,color:#fff
classDef miss fill:#D97B2A,stroke:#A35D1F,color:#fff
classDef decision fill:#F5D76E,stroke:#C5A83D,color:#333,font-weight:bold
classDef lru fill:#E74C3C,stroke:#C0392B,color:#fff
classDef meta fill:#8E44AD,stroke:#6C3483,color:#fff
classDef keygen fill:#1ABC9C,stroke:#148F77,color:#fff

%% subgraph Init["Cache Initialization"]
%% direction TB
%% SB["SupplierBase constructor"]
%% IC["initCache()\nthis.cache = new SupplierCache(supplierName)"]
%% SC["SupplierCache instance\nscoped to supplier name\ne.g. Loudwolf, Onyxmet"]
%% SB --> IC --> SC
%% end

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
CACHEABLE{"shouldCacheProductData?\nskip if fetch hit a noCacheStatusCode (429)\nor search aborted (maxAllowableSearchTime)"}
DUMP2["resultBuilder.dump()\nserialize product data"]
SAVE2["cache.cacheProductData(key, data)"]
SKIP2["Skip caching\nproduct still yielded;\nretried on next search"]
FETCH --> CACHEABLE
CACHEABLE -->|"yes"| DUMP2 --> SAVE2
CACHEABLE -->|"no"| SKIP2
end
PLOOKUP -->|"hit"| CacheHit2
PLOOKUP -->|"miss"| CacheMiss2

PDS[("supplierProductDataCache\nkey: MD5(url+supplier+params)\nindex: timestamp")]
SAVE2 -->|"write"| PDS
PLOOKUP -.->|"read"| PDS
TOUCH -.->|"update timestamp"| PDS

subgraph LRU["LRU Eviction Policy"]
direction TB
MAX["Max entries: 100 per cache\nquery cache and product cache\neach have independent limits"]
EVICT["On write: if entries >= 100\nsort by cachedAt/timestamp ascending\ndelete oldest entry via IDB index"]
MAX --- EVICT
end
SAVE2 -.->|"triggers if full"| LRU

subgraph Metadata["CacheMetadata - per entry"]
direction LR
META["cachedAt: timestamp\nversion: 2\nquery: search term\nsupplier: display name\nsupplierModule: class name\nresultCount: number of results\nlimit: requested limit"]
end
SAVE2 -.->|"attached as __cacheMetadata"| Metadata

class SB,IC,SC init
class PDS idb
class GPD cacheFlow
class SETDATA,TOUCH hit
class FETCH,DUMP2,SAVE2 miss
class PLOOKUP,CACHEABLE decision
class MAX,EVICT,SKIP2 lru
class META meta
class GPCK keygen
```

### Storage Backend

```mermaid
flowchart LR
classDef idb fill:#E67E22,stroke:#D35400,color:#fff,font-weight:bold
classDef cstorage fill:#16A085,stroke:#0E6B57,color:#fff,font-weight:bold

subgraph IDB["IndexedDB (chempal db, v2)"]
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

class QCS,PDS,SRS,SHS,SSS idb
class LOCAL,SESSION cstorage
```

## Query Cache vs Product Data Cache

The two supplier caches store different things and invalidate differently:

| Aspect | Query Results Cache | Product Data Cache |
| --- | --- | --- |
| Storage | IndexedDB `supplierQueryCache` | IndexedDB `supplierProductDataCache` |
| Key | base64 of `query + supplier` | MD5 of `url + supplier + params` |
| Stored data | Array of serialized `ProductBuilder` snapshots | Single serialized `ProductBuilder` snapshot |
| Invalidation | When requested limit exceeds cached limit | LRU eviction only (no limit-based invalidation) |
| Written | After `queryProducts()` returns results | After `getProductData()` fetches product page |
