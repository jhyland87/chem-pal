# Supplier Lifecycle

This document provides mermaid diagrams covering the supplier system architecture: the execution lifecycle, class hierarchy, data strategy patterns, and the SupplierFactory orchestration.

> [!TIP]
> If the below graphs fail to load, try refreshing without cache (`shift`+`command`+`r` on OSX, `Ctrl`+`F5` on Windows virus)

## Supplier Execution Lifecycle

The core pipeline defined in `SupplierBase.execute()`. Every supplier follows this flow.

```mermaid
flowchart TD
    A["execute()"] --> B["setup()"]
    B --> C["queryProductsWithCache()"]
    C -->|Cache hit| D["createFromCache()"]
    C -->|Cache miss| E["queryProducts()"]
    E --> F["fuzzyFilter()"]
    F --> G["ProductBuilder array"]
    G --> H["Cache results"]
    H --> I["products"]
    D --> I
    I -->|Empty| J["No results"]
    I -->|Has results| K["Queue"]
    K --> L["getProductData()"]
    L --> M{"Cached?"}
    M -->|Yes| O["finishProduct()"]
    M -->|No| N["getProductDataWithCache()"]
    N --> O
    O -->|Valid| P["yield Product"]
    O -->|Invalid| Q["Skip product"]

    style A fill:#4a9eff,color:#fff
    style P fill:#2ecc71,color:#fff
    style J fill:#95a5a6,color:#fff
    style Q fill:#e67e22,color:#fff
```

## Class Hierarchy

The inheritance tree for all 18 active suppliers.

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
        #fuzzyFilter(query, data, cutoff)
        #queryProductsWithCache(query, limit)
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
    class SupplierBaseAmazon {
        <<abstract>>
        Amazon HTML scraping
    }

    SupplierBase <|-- SupplierBaseWix
    SupplierBase <|-- SupplierBaseSearchanise
    SupplierBase <|-- SupplierBaseShopify
    SupplierBase <|-- SupplierBaseWoocommerce
    SupplierBase <|-- SupplierBaseAmazon

    SupplierBase <|-- Ambeed
    SupplierBase <|-- Carolina
    SupplierBase <|-- Chemsavers
    SupplierBase <|-- LaboratoriumDiscounter
    SupplierBase <|-- Loudwolf
    SupplierBase <|-- Macklin
    SupplierBase <|-- Onyxmet
    SupplierBase <|-- Synthetika
    SupplierBase <|-- Warchem

    SupplierBaseWix <|-- BioFuranChem
    SupplierBaseWix <|-- FtfScientific

    SupplierBaseSearchanise <|-- HbarSci
    SupplierBaseSearchanise <|-- Laballey

    SupplierBaseShopify <|-- GoldAndSilverTesting

    SupplierBaseWoocommerce <|-- CarolinaChemical
    SupplierBaseWoocommerce <|-- LibertySci

    SupplierBaseAmazon <|-- Himedia
    SupplierBaseAmazon <|-- InnovatingScience
```

## Data Strategy Patterns

How each data strategy flows from search to finished product.

```mermaid
flowchart LR
    subgraph JSON["JSON Only (11)"]
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

    subgraph HTML["HTML Only (3)"]
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

    subgraph Hybrid["Hybrid (2)"]
        direction TB
        HY1["queryProducts()
        Fetch JSON endpoint"]
        HY2["Parse JSON into
        ProductBuilder[]"]
        HY3["getProductData()
        Fetch HTML detail"]
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

All 18 active suppliers by platform, country, and data strategy.

### Direct (SupplierBase) - 9 suppliers
- **Ambeed** - CN - JSON Only
- **Carolina** - US - Hybrid
- **ChemSavers** - US - JSON Only
- **Laboratorium Discounter** - NL - Hybrid
- **Loudwolf** - US - HTML Only
- **Macklin** - CN - JSON Only
- **Onyxmet** - CA - HTML Only
- **Synthetika** - PL - JSON Only
- **Warchem** - PL - HTML Only

### Wix Platform - 2 suppliers
- **BioFuranChem** - US - JSON Only
- **FTF Scientific** - US - JSON Only

### Searchanise Platform - 2 suppliers
- **H-Bar Scientific** - US - JSON Only
- **Lab Alley** - US - JSON Only

### Shopify Platform - 1 supplier
- **Gold and Silver Testing** - US - JSON Only

### WooCommerce Platform - 2 suppliers
- **Carolina Chemical** - US - JSON Only
- **Liberty Science** - US - JSON Only

### Amazon Platform - 2 suppliers
- **HiMedia** - IN - JSON Only
- **Innovating Science** - US - JSON Only

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
