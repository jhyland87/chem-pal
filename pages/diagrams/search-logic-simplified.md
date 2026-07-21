# Search Logic (Plain-English Walkthrough)

A friendly, non-developer overview of what actually happens when someone runs a search.
It names the key classes and methods so a developer can find the code, but the boxes are
written in everyday language. For the deep technical version, see
[search-flow.md](./search-flow.md) and [search-cache-flow.md](./search-cache-flow.md).

## The story in one paragraph

You type a search. The app spins up a coordinator (`SupplierFactory`) that asks **every**
chemical supplier the same question **at the same time**. If your search was a chemical
*structure* (like a SMILES string) instead of a name, the app first looks up the common
name so ordinary suppliers can understand it. Each supplier checks its own memory (cache)
before hitting the internet, finds matching products, keeps the best matches, then fetches
the finer details (price, size, CAS number) for each one. Results are shown the moment
they arrive — you don't wait for the slowest supplier to finish.

## Key ideas (in plain terms)

- **Everything runs in parallel.** Suppliers are queried in batches (3 at a time) and
  products stream onto the screen as they're ready — no waiting for everyone.
- **The app has a memory.** Before making any web request, a supplier asks "have I looked
  this up recently?" A cache hit means instant results and no network call.
- **Two layers of memory.** One remembers *the list of products* for a search term; a
  separate one remembers *the details of each individual product* by its unique ID.
- **Structure searches get translated.** A SMILES/InChIKey structure is turned into a real
  chemical name **and CAS number** once, up front (via NCI Cactus, falling back to PubChem),
  and that translation is shared with every supplier.
- **Each supplier searches the format it understands.** Before searching, the app asks *what
  kind of query is this, and can this supplier read it natively?* A plain name or CAS goes
  straight to the supplier's search. A boolean `AND/OR/NOT` query is either handled natively
  or split into one search per word. A raw chemical structure can't be searched directly, so
  the name/CAS looked up from Cactus/PubChem is used to pick out the genuine matches instead.
- **Results are ranked by relevance.** Each product title is scored against your query and
  the list is **sorted best-match-first**, keeping the top results — so the closest matches
  surface first no matter what order the supplier returned them in.

## Diagram

Read it top-to-bottom through the three numbered stages. Inside the supplier stage, each phase reads left-to-right. The **diamonds are decisions** — follow the labelled arrow that
matches. The shape of each box hints at what it is: **stacked boxes** = one action repeated
many times (per supplier / per word / per product), **slanted boxes** = a network call out
to a supplier, **cylinders** = the caches (memory), the **screen-shaped box** = what you see,
and the **card** at the end = the "nothing found" fallback.

```mermaid
---
config:
  layout: elk
  htmlLabels: true
  markdownAutoWrap: true
  look: neo
  theme: dark
  elk:
    mergeEdges: true
    nodePlacementStrategy: BRANDES_KOEPF
  flowchart:
    curve: basis
    nodeSpacing: 42
    rankSpacing: 58
---

flowchart TB
linkStyle default stroke-width:3px;

START@{ shape: stadium, label: "🔍 You type a search query" }
FANOUT@{ shape: st-rect, label: "Ask every selected supplier at once<br/><i>executeAllStream()</i> — 3 in parallel<br/>skip suppliers that can't ship to you<br/>or don't have permission" }

subgraph Setup["1 · Getting Ready"]
direction LR
  FACTORY["Start the search coordinator<br/><b>SupplierFactory</b><br/>it will ask every supplier at once"]
  STRUCT@{ shape: diam, label: "Is the query a chemical<br/><b>structure</b> (SMILES/InChIKey)<br/>instead of a name?" }
  LOOKUP@{ shape: doc, label: "Look up the common name + CAS<br/><i>resolveStructuresOnce()</i><br/>NCI Cactus → PubChem fallback<br/>shared with every supplier" }

  FACTORY --> STRUCT
  STRUCT -->|"Yes"| LOOKUP
end

START --> FACTORY
STRUCT -->|"No — a normal name/CAS"| FANOUT
LOOKUP --> FANOUT

subgraph SUPPLIER["2 · What each supplier does — SupplierBase.execute()"]
direction TB

  subgraph SEARCH_PHASE["A · Prepare, cache, and search"]
  direction LR
    IGNORE["Load your ignored-products list<br/>& over-fetch to backfill hidden slots"]
    QCACHE@{ shape: diam, label: "Searched this term recently?<br/><i>queryProductsWithCache()</i>" }
    FORMAT@{ shape: diam, label: "What kind of query is this — and can<br/>this supplier read it natively?<br/><i>queryProductsResolved()</i>" }
    NATIVE@{ shape: lean-r, label: "Search the supplier's own API / site<br/><i>queryProducts()</i><br/>JSON, GraphQL, or scraped HTML" }

    IGNORE --> QCACHE
    QCACHE -->|"Miss"| FORMAT

    subgraph FORMATS["Query handling"]
    direction TB
      subgraph FORMAT_ROW_1[" "]
      direction LR
        PLAIN["<b>Plain name or CAS</b><br/>search it directly<br/>(most engines accept these)"]
        BOOLNATIVE["<b>Boolean AND/OR/NOT</b><br/>supplier supports it natively<br/>(Wix, Shopify, Magento 2,<br/>Chemsavers, LabChem, LiMac)"]
      end
      subgraph FORMAT_ROW_2[" "]
      direction LR
        BOOLFAN@{ shape: st-rect, label: "<b>Boolean AND/OR/NOT</b><br/>keyword-only supplier → search each word,<br/>then merge & de-dupe<br/><i>deriveFallbackTerms()</i>" }
        STRUCTQ["<b>Chemical structure</b><br/>use the resolved name + CAS<br/>to spot genuine matches<br/><i>resolvedStructures</i>"]
      end
    end

    FORMAT --> PLAIN & BOOLNATIVE & BOOLFAN & STRUCTQ
    PLAIN & BOOLNATIVE & BOOLFAN & STRUCTQ --> NATIVE
  end

  subgraph RANK_PHASE["B · Rank, build, and cache the product list"]
  direction LR
    SCORE["Rank by relevance<br/><i>fuzzyFilterAst()</i><br/>score titles, sort best-first,<br/>keep the top N"]
    BUILD@{ shape: st-rect, label: "Build a product for each match<br/><i>initProductBuilders()</i><br/>title, link, unique ID, base price" }
    SAVEQ@{ shape: cyl, label: "💾 Cache this product list<br/>for the search term" }
    DROP["Drop ignored products<br/>and trim to your result limit"]

    SCORE --> BUILD
    BUILD --> SAVEQ --> DROP
  end

  subgraph DETAIL_PHASE["C · Fill in each product's details — in parallel"]
  direction LR
    DCACHE@{ shape: diam, label: "Already have this product's details?<br/><i>getProductDataWithCache()</i>" }
    FETCH@{ shape: lean-r, label: "Fetch the product page / API<br/><i>getProductData()</i><br/>price, sizes, CAS #, grade, stock" }
    FINISH["Finalize the product<br/><i>finishProduct() → build()</i>"]
    SAVED@{ shape: cyl, label: "💾 Cache the details<br/>by product ID" }
    YIELD@{ shape: f-circ, label: "yield" }

    DCACHE -->|"Miss"| FETCH --> FINISH --> SAVED
    DCACHE -->|"Hit — reuse saved details"| FINISH
    FINISH --> YIELD
  end

  QCACHE -->|"Hit — reuse saved list"| DROP
  NATIVE --> SCORE
  DROP -->|"for each product"| DCACHE
end

FANOUT ==>|"for each supplier, in parallel"| IGNORE

subgraph OUTPUT["3 · Stream results to the user"]
direction LR
  RESULTS@{ shape: curv-trap, label: "📋 Results table fills in live<br/>products appear as each supplier finishes;<br/>newest arrivals are added immediately" }
  SUGGEST@{ shape: notch-rect, label: "Suggest alternative search<br/>terms via PubChem" }
  RESULTS -->|"if nothing found"| SUGGEST
end

YIELD ==>|"streamed as soon as ready"| RESULTS

classDef start fill:#8E44AD,stroke:#5B2C6F,color:#fff,font-weight:bold
classDef setup fill:#4A90D9,stroke:#2C5F8A,color:#fff
classDef decision fill:#E8A838,stroke:#B8841F,color:#000,font-weight:bold
classDef work fill:#5A7D8B,stroke:#3E5A66,color:#fff
classDef native fill:#2EAD6B,stroke:#1F7A4A,color:#fff
classDef storage fill:#D97B2A,stroke:#A35D1F,color:#fff
classDef output fill:#3498DB,stroke:#2176AC,color:#fff,font-weight:bold
classDef fallback fill:#95A5A6,stroke:#6E7B7C,color:#fff
classDef junction fill:#27AE60,stroke:#1E8449,color:#fff

class START start
class FACTORY,LOOKUP,FANOUT setup
class STRUCT,QCACHE,DCACHE,FORMAT decision
class IGNORE,SCORE,BUILD,DROP,FINISH,PLAIN,BOOLNATIVE,BOOLFAN,STRUCTQ work
class NATIVE,FETCH native
class SAVEQ,SAVED storage
class YIELD junction
class RESULTS output
class SUGGEST fallback
```

## How to read it

1. **Getting Ready** — one coordinator (`SupplierFactory`) is created and, if your query is a
   chemical structure, it's translated once into a name + CAS (Cactus → PubChem).
2. **Each supplier** runs the same routine independently and in parallel. The supplier box is split into three horizontal bands: search, ranking, and product details.
3. **Ranking** scores every result title against your query and sorts best-match-first,
   keeping the top ones.
4. **The two 💾 cylinders** are the caches — the reason a repeated search feels instant.
5. **Results** stream onto the screen (the display-shaped box) one product at a time; if a
   supplier finds nothing, the card at the end suggests alternative terms.
