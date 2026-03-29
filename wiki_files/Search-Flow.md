# Search Flow

This page details the end-to-end search flow from user input through to rendered results, including how the search execution layer orchestrates multiple suppliers in parallel via streaming.

## Key Concepts

- **Two entry points**: `SearchPage` (web app) and `SearchPanelHome` (Chrome extension) both feed into the same execution pipeline
- **Streaming results**: `SupplierFactory.executeAllStream()` yields products as they arrive from any supplier, enabling incremental UI updates
- **Session persistence**: The Chrome extension persists query state and results to `chrome.storage.session` for restore-on-mount
- **Supplier data strategies**: Each supplier implements one of three patterns depending on what the vendor's site exposes:
  - **JSON Only** (e.g. Wix) — GraphQL/REST API provides all product data in the search response; no detail page fetch needed
  - **HTML Only** (e.g. Loudwolf) — Both search results and product details are scraped from HTML pages via `DOMParser`
  - **Hybrid** (e.g. Onyxmet) — Search results come from a JSON endpoint, but product details require scraping the HTML product page

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
STREAM -->|"for await (product)"| PROCESS["Process Each Result\nupdate resultCount\nappend to searchResults\nsave to chrome.storage.session"]
end

CHROME[("chrome.storage.session\nquery, isNewSearch flag,\npersisted results")]
SPH -.->|"save query + isNewSearch flag"| CHROME
CHROME -.->|"load on mount\nif isNewSearch then performSearch"| ES
PROCESS -.->|"save incrementally"| CHROME

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
EXEC["execute()"]
SETUP["setup()\nsupplier-specific init\nauth tokens, headers, etc."]
QPC["queryProductsWithCache()\ncheck chrome.storage.local cache\nfallback to queryProducts()"]
QP["queryProducts()\nfetch search results\nsupplier-specific"]
FUZZ["fuzzyFilter()\nfuzzball WRatio scorer\nvia titleSelector()"]
IPB["initProductBuilders()\nparse raw data into\nProductBuilder instances"]
EXEC --> SETUP --> QPC
QPC -->|"cache miss"| QP
QP --> FUZZ --> IPB
subgraph DetailFetch["Product Detail Fetching - concurrent via async-await-queue"]
direction TB
GPDC["getProductDataWithCache()\nper product"]
GPD["getProductData()\nfetch individual product page\nsupplier-specific"]
FP["finishProduct()\nvalidate, set country/shipping,\ncall product.build()"]
GPDC -->|"cache miss"| GPD --> FP
end
IPB -->|"for each product builder"| DetailFetch
FP -->|"yield product"| YIELD(("yield"))
end

subgraph Strategies["Supplier Data Strategies"]
direction TB
subgraph JSONOnly["JSON Only - e.g. Wix Suppliers"]
direction TB
WS["setup: fetch Wix access token\nGET /_api/v1/access-tokens"]
WQ["queryProducts: GraphQL API call\nPOST /ecom query"]
WI["initProductBuilders:\nparse JSON product nodes"]
WG["getProductData: no-op\nall data already available"]
WS --> WQ --> WI --> WG
end
subgraph HTMLOnly["HTML Only - e.g. Loudwolf"]
direction TB
LQ["queryProducts: fetch search page\nGET /storefront/?search=..."]
LF["fuzzHtmlResponse:\nDOMParser + querySelectorAll\nfuzzy filter by title"]
LI["initProductBuilders:\nscrape price, URL, ID"]
LG["getProductData: fetch product page\nparse for CAS, quantity, grade"]
LQ --> LF --> LI --> LG
end
subgraph Hybrid["Hybrid JSON + HTML - e.g. Onyxmet"]
direction TB
OQ["queryProducts: fetch JSON endpoint\nGET index.php?term=..."]
OF["fuzzyFilter:\nfilter JSON results by label"]
OI["initProductBuilders:\nmap JSON items to builders"]
OG["getProductData: fetch product HTML\nscrape price, availability, CAS"]
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
class EXEC,SETUP,QPC,QP,FUZZ,IPB,GPDC,GPD,FP pipeline
class WS,WQ,WI,WG json
class LQ,LF,LI,LG html
class OQ,OF,OI,OG hybrid
class CHROME storage
class RT output
class PUBCHEM fallback
class YIELD yieldNode
```
