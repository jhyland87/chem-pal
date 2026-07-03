# Search Flow

This diagram details the end-to-end search flow from user input through to rendered results, including how the search execution layer orchestrates multiple suppliers in parallel via streaming.

## Key Concepts

- **Two entry points**: `SearchPage` (web app) and `SearchPanelHome` (Chrome extension) both feed into the same execution pipeline
- **Streaming results**: `SupplierFactory.executeAllStream()` yields products as they arrive from any supplier, enabling incremental UI updates
- **Session persistence**: The Chrome extension persists query state to `chrome.storage.session` (via `cstorage`) and search results to IndexedDB for restore-on-mount
- **Advanced (boolean) search**: queries support `AND`/`OR`/`NOT` and quoted phrases, parsed into an AST by `parseSearchQuery`. `queryProductsResolved()` resolves each supplier's search against that AST — a plain query, or a supplier that can translate the query server-side (`supportsNativeAdvancedSearch`: Wix, Shopify, Magento 2, LiMac), runs a single `queryProducts()`; a keyword-only backend fans out one search per positive OR-group term (`deriveFallbackTerms`, capped at `maxFallbackQueries`) and unions/dedupes the results. The full boolean predicate is always enforced client-side by `fuzzyFilterAst()`
- **Fuzzy matching**: each candidate's `titleSelector()` title is scored with `fuzzball` (default scorer `ratio`, user-selectable via `userSettings.fuzzScorerOverride`). By default `fuzzyFilterAst()` ranks candidates by score rather than hard-cutting at `minMatchPercentage`, and the pipeline keeps the top `limit`; `userSettings.fuzzyFilteringDisabled` turns scoring off entirely
- **Excluded products**: items the user has "Ignore"d (`loadExcludedProductKeys`) are dropped before the detail-fetch phase; `execute()` over-fetches by the excluded count so the removed slots are backfilled
- **Supplier data strategies**: Each supplier implements one of three patterns depending on what the vendor's site exposes:
  - **JSON Only** (e.g. Wix) — GraphQL/REST API provides all product data in the search response; no detail page fetch needed
  - **HTML Only** (e.g. Loudwolf) — Both search results and product details are scraped from HTML pages via `DOMParser`
  - **Hybrid** (e.g. Onyxmet, AladdinSci) — Search results come from a JSON/GraphQL endpoint, but product details require scraping the HTML product page. AladdinSci (Magento 2) fetches each product's page in `getProductData()` to scrape SDS / spec-sheet links, SMILES, IUPAC name, InChIKey, INChI, PubChem CID, molecular weight, and purity
- **Search-time budget**: a supplier may set `maxAllowableSearchTime` (overridable via settings; `SupplierBaseMagento2` defaults to 45s). When it elapses, the `AbortController` cancels outstanding detail fetches and the search yields only the products collected so far — un-enriched products still appear with their basic search-response data, and their incomplete enrichment is not cached so a later search retries it
- **Rate-limit backoff**: when a product-detail fetch hits HTTP 429, Magento/AladdinSci pauses all further detail requests, waits an escalating interval (n, 2n, 3n …), then probes one request before resuming. AladdinSci also throttles detail fetches to 2 concurrent, ≥350 ms apart

## Diagram

```mermaid
flowchart TB

subgraph Entry["Entry Points"]
direction LR
SP["SearchPage\n(Web App)"]
SPH["SearchPanelHome\n(Chrome Extension)"]
end

SP -->|"onSearch(query)"| SF["SearchForm"]
SPH -->|"onSearch(query)"| SF

subgraph InputLayer["UI Input Layer"]
SF
SI["SearchInput\n(alternative input)"]
USI["useSearchInput Hook\nmanages input state and\nchrome.storage.session persistence"]
SI --- USI
end

SF -->|"query string"| ES
SI -->|"query string"| ES

subgraph Execution["Search Execution Layer"]
ES["executeSearch(query)\nuseSearch hook"]
ES -->|"startTransition"| PS["performSearch()"]
PS -->|"1. Instantiate"| SFACT["SupplierFactory\nnew SupplierFactory(query, limit, controller, suppliers?)"]
SFACT -->|"2. Stream results"| STREAM["executeAllStream(concurrency=3)\nAsyncGenerator - yields products\nas they arrive from any supplier"]
STREAM -->|"for await (product)"| PROCESS["Process Each Result\nupdate resultCount\nappend to searchResults\nsave to IndexedDB"]
end

IDB[("IndexedDB\nsearchResults store\ncurrent result set")]
CHROME[("chrome.storage.session\nquery, isNewSearch flag")]
SPH -.->|"save query + isNewSearch flag"| CHROME
CHROME -.->|"load on mount\nif isNewSearch then performSearch"| ES
PROCESS -.->|"save incrementally"| IDB
IDB -.->|"load on mount\nrestore results"| ES

subgraph Factory["SupplierFactory"]
direction TB
SFACT2["Instantiate selected suppliers\nfrom supplier index module"]
QUEUE["async-await-queue\nparallel execution with\nconcurrency limit"]
CHAN["Channel array\ncollect yielded products\nfrom all suppliers"]
SFACT2 --> QUEUE --> CHAN
end
STREAM -.-> Factory

CHAN -->|"per supplier"| EXEC

subgraph SupplierPipeline["SupplierBase.execute - AsyncGenerator Pipeline"]
direction TB
EXEC["execute()\nload excluded-product list;\nover-fetch by excluded count"]
SETUP["setup()\nsupplier-specific init\nauth tokens, headers, etc."]
QPC["queryProductsWithCache()\ncheck IndexedDB cache\nfallback to queryProductsResolved()"]
QPR["queryProductsResolved()\nplain / native-advanced: 1 query\nkeyword-only advanced: 1 search per\nOR-group term, unioned + deduped"]
QP["queryProducts()\nfetch search results\nsupplier-specific"]
FUZZ["fuzzyFilterAst()\nAST-aware (AND/OR/NOT, phrases)\nscore titleSelector() with active\nfuzz scorer (default ratio); rank-only"]
IPB["initProductBuilders()\nparse raw data into\nProductBuilder instances"]
EXCL["drop excluded products\n(Ignore Product list),\nslice back to limit"]
EXEC --> SETUP --> QPC
QPC -->|"cache miss"| QPR
QPR --> QP
QP --> FUZZ --> IPB --> EXCL
subgraph DetailFetch["Product Detail Fetching - concurrent via async-await-queue"]
direction TB
GPDC["getProductDataWithCache()\nper product"]
GPD["getProductData()\nfetch individual product page\nsupplier-specific"]
FP["finishProduct()\nvalidate, set country/shipping,\ncall product.build()"]
GPDC -->|"cache miss"| GPD --> FP
end
EXCL -->|"for each product builder"| DetailFetch
FP -->|"yield product"| YIELD(("yield"))
end

subgraph Strategies["Supplier Data Strategies"]
direction TB
subgraph JSONOnly["JSON Only - e.g. Wix Suppliers"]
direction TB
WS["setup: fetch Wix access token\nGET /_api/v1/access-tokens"]
WQ["queryProducts: GraphQL API call\nPOST /ecom query\ngetFilteredProductsWithHasDiscount"]
WI["initProductBuilders:\nparse JSON product nodes\nitems, variants, prices\nselections, quantities/sizes\nextract CAS numbers"]
WG["getProductData: no-op\nall data already available\nfrom search response"]
WS --> WQ --> WI --> WG
end
subgraph HTMLOnly["HTML Only - e.g. Loudwolf"]
direction TB
LQ["queryProducts: fetch search page\nGET /storefront/?search=..."]
LF["fuzzHtmlResponse:\nDOMParser then querySelectorAll\ndiv.product-layout.product-list\nfuzzy filter by title"]
LI["initProductBuilders:\nscrape .caption p.price\nand .caption h4 a for URL/ID"]
LG["getProductData: fetch product page\nparse MsoTableGrid for\nCAS, quantity, grade\nchunk-based key/value extraction"]
LQ --> LF --> LI --> LG
end
subgraph Hybrid["Hybrid JSON + HTML - e.g. Onyxmet"]
direction TB
OQ["queryProducts: fetch JSON endpoint\nGET index.php?term=..."]
OF["fuzzyFilter:\nfilter JSON results by label"]
OI["initProductBuilders:\nmap JSON items to builders\nlabel, href, description"]
OG["getProductData: fetch product page HTML\nscrape .desc for availability\n.product-price for price\ntitle for quantity, desc for CAS"]
OQ --> OF --> OI --> OG
end
end

QP -.->|"JSON path"| JSONOnly
QP -.->|"HTML path"| HTMLOnly
QP -.->|"Hybrid path"| Hybrid

YIELD -->|"streamed back through\nexecuteAllStream"| PROCESS
PROCESS --> RT["ResultsTable\nSearchPanel renders table\nwith column filters"]

PROCESS -->|"if no results"| PUBCHEM["PubChem API\nsuggest alternative\nsearch terms"]

classDef entry fill:#4A90D9,stroke:#2C5F8A,color:#fff,font-weight:bold
classDef input fill:#5BA3CF,stroke:#3A7CA5,color:#fff
classDef exec fill:#4A90D9,stroke:#2C5F8A,color:#fff
classDef factory fill:#6B8E9B,stroke:#4A6B78,color:#fff
classDef pipeline fill:#5A7D8B,stroke:#3E5A66,color:#fff
classDef json fill:#2EAD6B,stroke:#1F7A4A,color:#fff
classDef html fill:#D97B2A,stroke:#A35D1F,color:#fff
classDef hybrid fill:#9B59B6,stroke:#6F3D8A,color:#fff
classDef storage fill:#E8A838,stroke:#B8841F,color:#fff
classDef output fill:#3498DB,stroke:#2176AC,color:#fff
classDef fallback fill:#95A5A6,stroke:#6E7B7C,color:#fff
classDef yieldNode fill:#27AE60,stroke:#1E8449,color:#fff

class SP,SPH entry
class SF,SI,USI input
class ES,PS,SFACT,STREAM,PROCESS exec
class SFACT2,QUEUE,CHAN factory
class EXEC,SETUP,QPC,QPR,QP,FUZZ,IPB,EXCL,GPDC,GPD,FP pipeline
class WS,WQ,WI,WG json
class LQ,LF,LI,LG html
class OQ,OF,OI,OG hybrid
class IDB,CHROME storage
class RT output
class PUBCHEM fallback
class YIELD yieldNode
```
