# Caching

ChemPal caches search results and product data in `chrome.storage.local` to avoid redundant network requests across searches.

## Key Concepts

- **Two independent caches**: Query results and product details are cached separately with different key generation strategies
- **LRU eviction**: Both caches cap at 100 entries, evicting the least recently used when full
- **Limit-aware invalidation**: The query cache invalidates entries when a new search requests more results than the cached limit
- **Timestamp refresh on read**: Product data cache updates `cachedAt` on hit to prevent active entries from being evicted
- **Serialization**: `ProductBuilder.dump()` serializes builders for storage; `ProductBuilder.createFromCache()` re-hydrates them

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

subgraph Storage["Chrome Storage Backend"]
direction LR
QCS[("chrome.storage.local\nQuery Results Cache\nkey: SupplierCache.getQueryCacheKey()")]
PDS[("chrome.storage.local\nProduct Data Cache\nkey: SupplierCache.getProductDataCacheKey()")]
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
INVALIDATE["Invalidate entry\ndelete cache key\nsave back to storage"]
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
INVALIDATE -.->|"delete + write"| QCS

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
TOUCH["updateProductDataCacheTimestamp(key)\nrefresh cachedAt to prevent\nLRU eviction"]
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
EVICT["On write: if entries ≥ 100\nsort by cachedAt ascending\ndelete oldest entry"]
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
classDef storage fill:#E8A838,stroke:#B8841F,color:#fff,font-weight:bold
classDef cacheFlow fill:#5A7D8B,stroke:#3E5A66,color:#fff
classDef hit fill:#27AE60,stroke:#1E8449,color:#fff
classDef miss fill:#D97B2A,stroke:#A35D1F,color:#fff
classDef decision fill:#F5D76E,stroke:#C5A83D,color:#333,font-weight:bold
classDef lru fill:#E74C3C,stroke:#C0392B,color:#fff
classDef meta fill:#8E44AD,stroke:#6C3483,color:#fff
classDef keygen fill:#1ABC9C,stroke:#148F77,color:#fff

class SB,IC,SC init
class QCS,PDS storage
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
| **Purpose** | Cache search result lists | Cache individual product details |
| **Key** | `base64(query + supplier)` | `MD5(url + supplier + params)` |
| **Stored data** | Array of serialized `ProductBuilder` snapshots | Single serialized `ProductBuilder` snapshot |
| **Invalidation** | When requested limit exceeds cached limit | LRU eviction only |
| **Written** | After `queryProducts()` returns results | After `getProductData()` fetches a product page |
| **Max entries** | 100 | 100 |
