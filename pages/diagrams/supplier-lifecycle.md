# Supplier Lifecycle

This document provides mermaid diagrams covering the supplier system architecture: the execution lifecycle, class hierarchy, data strategy patterns, and the SupplierFactory orchestration.

## Supplier Execution Lifecycle

The core pipeline defined in `SupplierBase.execute()`. Every supplier follows this flow.

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
---
flowchart TD
    linkStyle default stroke-width:4px;

    A["execute()"] --> B["setup()"]
    B --> C["queryProductsWithCache()"]
    C -->|Cache hit| D["createFromCache()"]
    C -->|Cache miss| R["queryProductsResolved()\nnative-advanced: 1 query;\nkeyword-only advanced:\nOR-group union + dedupe"]
    R --> E["queryProducts()"]
    E --> F["fuzzyFilterAst()\nAST predicate + fuzz rank"]
    F --> G["ProductBuilder array"]
    G --> H["Cache results"]
    H --> I["products"]
    D --> I
    I -->|Empty| J["No results"]
    I -->|Has results| X["Drop excluded products\n(Ignore Product list)"]
    X --> K["Queue (per-supplier concurrency)"]
    K --> L["getProductData()"]
    L --> M{"Cached?"}
    M -->|Yes| O["finishProduct()"]
    M -->|No| N["getProductDataWithCache()\ncache write skipped if fetch hit a\nnoCacheStatusCode (429) or was aborted"]
    N --> O
    O -->|Valid| P["yield Product"]
    O -->|Invalid| Q["Skip product"]
    K -.->|"maxAllowableSearchTime elapsed"| TO["Abort outstanding fetches;\nyield remaining products with\nbasic data (uncached)"]
    TO --> P

    style A fill:#4a9eff,color:#fff
    style P fill:#2ecc71,color:#fff
    style J fill:#95a5a6,color:#fff
    style Q fill:#e67e22,color:#fff
    style TO fill:#e74c3c,color:#fff

    %% ── Descriptor notes: plain-English descriptions pinned next to key nodes ──
    classDef descriptor fill:#FFF8E1,stroke:#FBC02D,stroke-width:1.5px,color:#5D4037,stroke-dasharray:5 4,font-style:italic
    D_A("The factory calls this to stream one supplier's products")
    D_C("Checks the query cache first — a repeat search can skip the network")
    D_F("Ranks results and keeps only the ones that match the query well")
    D_X("Products the user chose to ignore are removed here")
    D_K("Each product's details are fetched in parallel, capped per supplier")
    D_M("Reuse a product's details if we already fetched them in another search")
    D_TO("If a supplier runs too long, stop and return whatever's ready")
    D_A ~~~ A
    D_C ~~~ C
    D_F ~~~ F
    D_X ~~~ X
    D_K ~~~ K
    D_M ~~~ M
    D_TO ~~~ TO
    class D_A,D_C,D_F,D_X,D_K,D_M,D_TO descriptor
    %% Hide the connector lines for the descriptor notes (the last 7 links).
    linkStyle 22,23,24,25,26,27,28 stroke-width:0px,stroke:transparent
```

## Class Hierarchy

The inheritance tree for all 25 active suppliers.

```mermaid
classDiagram
    class SupplierBase {
        <<abstract>>
        +supplierName: string
        +baseURL: string
        +shipping: ShippingRange
        +country: CountryCode
        +paymentMethods: PaymentMethod[]
        +execute() AsyncGenerator~T~
        #setup()
        #queryProducts(query, limit)*
        #titleSelector(data)*
        #fuzzyFilterAst(data, minMatchPercentage)
        #queryProductsWithCache(query, limit)
        #queryProductsResolved(query, limit)
        #deriveFallbackTerms()
        #getProductData(product)
        #getProductDataWithCache(product)
        #finishProduct(product)
    }

    class SupplierBaseWix {
        <<abstract>>
        Wix GraphQL API
    }
    class SupplierBaseSearchanise {
        <<abstract>>
        Searchanise API
    }
    class SupplierBaseShopify {
        <<abstract>>
        Shopify GraphQL API
    }
    class SupplierBaseWoocommerce {
        <<abstract>>
        WooCommerce REST API
    }
    class SupplierBaseMagento2 {
        <<abstract>>
        Magento 2 API
    }
    class SupplierBaseAmazon {
        <<abstract>>
        Amazon HTML scraping
    }

    SupplierBase <|-- SupplierBaseWix
    SupplierBase <|-- SupplierBaseSearchanise
    SupplierBase <|-- SupplierBaseShopify
    SupplierBase <|-- SupplierBaseWoocommerce
    SupplierBase <|-- SupplierBaseMagento2
    SupplierBase <|-- SupplierBaseAmazon

    SupplierBase <|-- Ambeed
    SupplierBase <|-- Carolina
    SupplierBase <|-- LaboratoriumDiscounter
    SupplierBase <|-- LiMac
    SupplierBase <|-- Loudwolf
    SupplierBase <|-- Macklin
    SupplierBase <|-- Onyxmet
    SupplierBase <|-- S3Chemicals
    SupplierBase <|-- Synthetika
    SupplierBase <|-- VWR
    SupplierBase <|-- Warchem

    SupplierBaseWix <|-- BioFuranChem
    SupplierBaseWix <|-- FtfScientific

    SupplierBaseSearchanise <|-- Laballey

    SupplierBaseShopify <|-- AsesChem
    SupplierBaseShopify <|-- BVV
    SupplierBaseShopify <|-- GoldAndSilverTesting
    SupplierBaseShopify <|-- TheLabStockroom

    SupplierBaseWoocommerce <|-- AlchemieLabs
    SupplierBaseWoocommerce <|-- AmarisChemicalSolutions
    SupplierBaseWoocommerce <|-- CarolinaChemical
    SupplierBaseWoocommerce <|-- LibertySci

    SupplierBaseMagento2 <|-- AladdinSci

    SupplierBaseAmazon <|-- Himedia
    SupplierBaseAmazon <|-- InnovatingScience
```

## Data Strategy Patterns

How each data strategy flows from search to finished product.

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
---
flowchart LR
    subgraph JSON["JSON Only (16)"]
        direction TB
        J1["queryProducts()
        Fetch JSON / GraphQL"]
        J2["Parse into
        ProductBuilder[]"]
        J3["getProductData()
        No-op / minimal"]
        J4["finishProduct()
        build()"]
        J1 --> J2 --> J3 --> J4
    end

    subgraph HTML["HTML Only (5)"]
        direction TB
        H1["queryProducts()
        Parse HTML via
        DOMParser"]
        H2["Extract links into
        ProductBuilder[]"]
        H3["getProductData()
        Fetch detail HTML"]
        H4["finishProduct()
        build()"]
        H1 --> H2 --> H3 --> H4
    end

    subgraph Hybrid["Hybrid (4)"]
        direction TB
        HY1["queryProducts()
        Fetch JSON / GraphQL endpoint"]
        HY2["Parse JSON into
        ProductBuilder[]"]
        HY3["getProductData()
        Fetch HTML detail
        (scrape SDS, specs, SMILES, etc.)"]
        HY4["finishProduct()
        build()"]
        HY1 --> HY2 --> HY3 --> HY4
    end

    JSON ~~~ HTML ~~~ Hybrid

    style JSON fill:#e8f5e9,stroke:#2e7d32
    style HTML fill:#fff3e0,stroke:#e65100
    style Hybrid fill:#e3f2fd,stroke:#1565c0
```

## Supplier Map

All 25 active suppliers by platform, country, and data strategy. Display names match each class's `supplierName` constant — see [Supplier System](../../wiki_files/Supplier-System.md) for the canonical table.

### Direct (SupplierBase) - 11 suppliers
- **Ambeed** - CN - JSON Only
- **Carolina** - US - Hybrid
- **Laboratorium Discounter** - NL - Hybrid
- **LiMac** - LV - HTML Only (FreeFind search + HTML detail; native advanced search)
- **Loudwolf** - US - HTML Only
- **Macklin** - CN - JSON Only
- **Onyxmet** - CA - HTML Only
- **S3 Chemicals** - DE - HTML Only
- **Synthetika** - PL - JSON Only
- **VWR** - US - JSON Only (JSON search + JSON detail enrichment)
- **Warchem** - PL - HTML Only

### Wix Platform - 2 suppliers
- **BioFuran Chem** - US - JSON Only
- **FTF Scientific** - US - JSON Only

### Searchanise Platform - 1 supplier
- **Laballey** - US - JSON Only

### Shopify Platform - 4 suppliers
- **AsesChem** - IN - Hybrid (GraphQL search + HTML detail scrape)
- **BVV** - US - JSON Only
- **Gold and Silver Testing** - US - JSON Only
- **The Lab Stockroom** - US - JSON Only

### WooCommerce Platform - 4 suppliers
- **Alchemie Labs** - US - JSON Only
- **Amaris Chemical Solutions** - US - JSON Only
- **Carolina Chemical** - US - JSON Only
- **LibertySci** - US - JSON Only

### Magento 2 Platform - 1 supplier
- **AladdinSci** - US - Hybrid (GraphQL search + HTML product-page scrape)

### Amazon Platform - 2 suppliers
- **Himedia** - IN - JSON Only
- **Innovating Science** - US - JSON Only

### Deprecated (not exported by `src/suppliers/index.ts`)
- **Akmekem** - Amazon - supplier was removed from Amazon
- **Bunmurra Labs** - Wix - site under reconstruction
- **Chemsavers** - Custom - disabled in the barrel export (reason not noted in code)
- **N2O3** - Custom - site offline since 2026-01-20

## SupplierFactory Orchestration

How `SupplierFactory` manages parallel supplier execution.

```mermaid
sequenceDiagram
    participant Caller
    participant SF as SupplierFactory
    participant Q as Queue (concurrency: 3)
    participant S1 as Supplier A
    participant S2 as Supplier B
    participant S3 as Supplier C
    participant SN as Supplier N...

    Caller->>SF: new SupplierFactory(query, limit, controller, filter?)
    Caller->>SF: for await (product of factory)

    SF->>SF: Resolve supplier list (all or filtered subset)

    par Concurrent execution (max 3)
        SF->>Q: Enqueue Supplier A
        Q->>S1: execute()
        S1-->>SF: yield Product 1a

        SF->>Q: Enqueue Supplier B
        Q->>S2: execute()
        S2-->>SF: yield Product 2a

        SF->>Q: Enqueue Supplier C
        Q->>S3: execute()
        S3-->>SF: yield Product 3a
    end

    SF-->>Caller: yield Product 1a
    SF-->>Caller: yield Product 2a
    SF-->>Caller: yield Product 3a

    Note over Q,S3: As slots free up, next suppliers start

    SF->>Q: Enqueue Supplier N
    Q->>SN: execute()
    SN-->>SF: yield Product Na
    SF-->>Caller: yield Product Na

    Note over Caller,SF: AbortController.abort() cancels all in-flight requests
```

## ProductBuilder Lifecycle

The fluent builder pattern for constructing validated products.

```mermaid
stateDiagram-v2
    [*] --> Created: new ProductBuilder(baseURL)

    Created --> Building: Set required fields

    state Building {
        [*] --> Title: setTitle()
        Title --> Price: setPricing()
        Price --> Quantity: setQuantity()
        Quantity --> Supplier: setSupplier()
        Supplier --> URL: setUrl()
        URL --> Optional: (optional fields)
        Optional --> Ready: All required fields set
    }

    Building --> Built: build()
    Building --> Failed: build() — missing required fields

    Built --> Cached: dump() — serialize
    Cached --> Restored: createFromCache() — deserialize
    Restored --> Building: Rebuild ProductBuilder

    Built --> [*]: Valid Product

    state Built {
        [*] --> Validate
        Validate --> ParsePrice: Price parsing + currency detection
        ParsePrice --> NormQty: Quantity normalization
        NormQty --> Final: Validated Product
    }
```
