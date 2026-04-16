# Search Cache System

This diagram details how ChemPal caches search results and product data using **IndexedDB** to avoid redundant network requests across searches. Lightweight app state remains in `chrome.storage` via the `cstorage` wrapper.

## Key Concepts

- **IndexedDB for cached data**: Query results, product details, search history, and supplier stats are stored in IndexedDB (`chempal` database, version 2) for better performance and no quota pressure on `chrome.storage`
- **chrome.storage for app state**: User settings, table state, excluded products, and session state remain in `chrome.storage.local` / `chrome.storage.session`
- **Two independent supplier caches**: Query results and product details are cached separately in IndexedDB with different key generation strategies
- **LRU eviction**: Both supplier caches cap at 100 entries, evicting the least recently used when full (using IndexedDB indexes on `cachedAt` / `timestamp`)
- **Limit-aware invalidation**: The query cache invalidates entries when a new search requests more results than the cached limit
- **Timestamp refresh on read**: Product data cache updates `timestamp` on hit to prevent active entries from being evicted
- **Serialization**: `ProductBuilder.dump()` serializes builders for storage; `ProductBuilder.createFromCache()` re-hydrates them
- **Optional compression**: `chrome.storage` writes optionally flow through `cstorage` (`src/utils/storage.ts`), which can LZ-compress values at rest via `lz-string` `compressToUTF16` wrapped in an `LzEnvelope` (`{ __lz: 1, d: "..." }`), controlled by `useStorageCompression` in `config.json`. Reads auto-detect the envelope and decompress, falling back to raw values for legacy data. IndexedDB data is **not** compressed via `cstorage`.
- **One-time migration**: `idbMigration.ts` migrates legacy `chrome.storage` cache data to IndexedDB on first run

## Diagram

> [!TIP]
> If the below graphs fail to load, try refreshing without cache (`shift`+`command`+`r` on OSX, `Ctrl`+`F5` on Windows virus)

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

subgraph Comparison["Query Cache vs Product Data Cache"]
direction LR
subgraph QComp["Query Results Cache"]
QC1["Storage: IndexedDB supplierQueryCache"]
QC2["Key: base64 of query + supplier"]
QC3["Stored data: array of serialized\nProductBuilder snapshots"]
QC4["Invalidation: when requested limit\nexceeds cached limit"]
QC5["Written: after queryProducts()\nreturns results"]
end
subgraph PComp["Product Data Cache"]
PC1["Storage: IndexedDB supplierProductDataCache"]
PC2["Key: MD5 of url + supplier + params"]
PC3["Stored data: single serialized\nProductBuilder snapshot"]
PC4["Invalidation: LRU eviction only\nno limit-based invalidation"]
PC5["Written: after getProductData()\nfetches product page"]
end
end

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
classDef comp fill:#5DADE2,stroke:#2E86C1,color:#fff

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
class QC1,QC2,QC3,QC4,QC5,PC1,PC2,PC3,PC4,PC5 comp
```
