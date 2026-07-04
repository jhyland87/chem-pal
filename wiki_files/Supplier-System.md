# Supplier System

ChemPal aggregates results from 25 active chemical supplier websites. Each supplier is a class that extends `SupplierBase` (or a platform-specific base class) and implements a standardized lifecycle for searching, parsing, and yielding products. The canonical list lives in [`src/suppliers/index.ts`](../src/suppliers/index.ts) — the barrel-export there is the source of truth that `SupplierFactory` iterates over.

## Active Suppliers

Display names below match each class's `supplierName` constant (what's shown in the UI and used as the cache/stats key). Class names follow the `Supplier*` convention in `src/suppliers/`.

| Supplier | Class | Platform (base class) | Country | Data Strategy |
|----------|-------|-----------------------|---------|---------------|
| AladdinSci | `SupplierAladdinSci` | Magento 2 | US | Hybrid (GraphQL search + HTML detail) |
| Alchemie Labs | `SupplierAlchemieLabs` | WooCommerce | US | JSON Only |
| Amaris Chemical Solutions | `SupplierAmarisChemicalSolutions` | WooCommerce | US | JSON Only |
| Ambeed | `SupplierAmbeed` | Custom | CN | JSON Only |
| AsesChem | `SupplierAsesChem` | Shopify | IN | Hybrid (GraphQL search + HTML detail) |
| BioFuran Chem | `SupplierBioFuranChem` | Wix | US | JSON Only |
| BVV | `SupplierBVV` | Shopify | US | JSON Only |
| Carolina | `SupplierCarolina` | Custom | US | Hybrid (JSON search + HTML detail) |
| Carolina Chemical | `SupplierCarolinaChemical` | WooCommerce | US | JSON Only |
| FTF Scientific | `SupplierFtfScientific` | Wix | US | JSON Only |
| Gold and Silver Testing | `SupplierGoldAndSilverTesting` | Shopify | US | JSON Only |
| Himedia | `SupplierHimedia` | Amazon | IN | JSON Only |
| Innovating Science | `SupplierInnovatingScience` | Amazon | US | JSON Only |
| Laballey | `SupplierLaballey` | Searchanise | US | JSON Only |
| Laboratorium Discounter | `SupplierLaboratoriumDiscounter` | Custom | NL | Hybrid (JSON search + HTML/JSON detail) |
| LibertySci | `SupplierLibertySci` | WooCommerce | US | JSON Only |
| LiMac | `SupplierLiMac` | Custom (FreeFind) | LV | HTML Only (native advanced search) |
| Loudwolf | `SupplierLoudwolf` | Custom | US | HTML Only |
| Macklin | `SupplierMacklin` | Custom | CN | JSON Only |
| Onyxmet | `SupplierOnyxmet` | Custom | CA | HTML Only |
| S3 Chemicals | `SupplierS3Chemicals` | Custom | DE | HTML Only |
| Synthetika | `SupplierSynthetika` | Custom | PL | JSON Only |
| The Lab Stockroom | `SupplierTheLabStockroom` | Shopify | US | Hybrid (GraphQL search + per-product SDS probe) |
| VWR | `SupplierVWR` | Custom | US | JSON Only (JSON search + JSON detail enrichment) |
| Warchem | `SupplierWarchem` | Custom | PL | HTML Only |

## Deprecated Suppliers

These supplier classes exist in `src/suppliers/` but are commented out of the barrel export in `src/suppliers/index.ts`, so `SupplierFactory` does not include them in search execution. Kept around in case the underlying sites come back online.

| Supplier | Class | Platform | Reason |
|----------|-------|----------|--------|
| Akmekem | `SupplierAkmekem` | Amazon | Supplier was removed from Amazon |
| Bunmurra Labs | `SupplierBunmurraLabs` | Wix | Site under reconstruction; new storefront not live |
| Chemsavers | `SupplierChemsavers` | Custom (Typesense) | Disabled in the barrel export (reason not noted in code) |
| N2O3 | `SupplierN2O3` | Custom | Site offline since 2026-01-20 |

## Data Strategies

Suppliers follow one of three patterns depending on what the vendor exposes:

### JSON Only
The search API returns all product data (title, price, quantity, CAS, etc.) in the search response, so no HTML detail-page scrape is required. (A JSON-Only supplier may still make a lightweight JSON follow-up — e.g. WooCommerce batch-fetches variant details, VWR enriches the top matches — but it never parses HTML.)
- Examples: Wix-, Searchanise-, and most Shopify-based suppliers, WooCommerce-based suppliers (Alchemie Labs, Amaris Chemical Solutions, Carolina Chemical, LibertySci), Amazon-based suppliers, Ambeed, Macklin, Synthetika, VWR

### HTML Only
Both search results and product details are scraped from HTML pages using `DOMParser`.
- Examples: LiMac, Loudwolf, Onyxmet, S3 Chemicals, Warchem

### Hybrid (JSON + HTML)
Search results come from a JSON/GraphQL endpoint, but full product details require fetching and scraping the individual HTML product page.
- Examples: AsesChem (Shopify GraphQL search + HTML detail scrape for SDS/COA docs), Carolina, Laboratorium Discounter, AladdinSci (Magento 2 — `getProductData()` scrapes the product page for SDS / spec-sheet links, SMILES, IUPAC name, InChIKey, INChI, PubChem CID, molecular weight, and purity, with escalating HTTP 429 backoff)

## Supplier Lifecycle

Every supplier follows this execution pipeline, defined in `SupplierBase.execute()`:

```
setup()
  │   Supplier-specific initialization (auth tokens, headers, etc.)
  ▼
queryProductsWithCache(query, limit)
  │   Check IndexedDB query cache → fallback to queryProductsResolved()
  ▼
queryProductsResolved(query, limit)
  │   Plain query, or a supplier with supportsNativeAdvancedSearch → one queryProducts() call.
  │   Keyword-only backend + advanced (boolean) query → one search per positive OR-group term
  │   (deriveFallbackTerms, capped at maxFallbackQueries), unioned and deduped by URL/ID.
  ▼
queryProducts(query, limit)
  │   Fetch search results from the supplier's website
  │   Apply fuzzyFilterAst() — enforce the AND/OR/NOT predicate and rank by fuzz score
  │   (via titleSelector(); default scorer `ratio`, overridable in settings)
  │   Return ProductBuilder[] instances
  ▼
Drop products on the user's "Ignore Product" list, slice back to limit
  ▼
┌─ for each ProductBuilder (via async-await-queue) ─┐
│  getProductData(product)                          │
│    │   Check cache → fallback to                  │
│    ▼   getProductDataWithCache(product)            │
│  finishProduct()                                  │
│    │   Validate, set country/shipping,            │
│    ▼   call product.build()                       │
│  yield product  ◄── back to caller                │
└───────────────────────────────────────────────────┘
```

**Detail-fetch resilience.** `getProductData()` is a no-op for JSON-only suppliers but fetches the product page for HTML/Hybrid suppliers. Two safeguards apply to that phase:

- **Search-time budget** — a supplier may set `maxAllowableSearchTime` (overridable via `userSettings.maxAllowableSearchTime`; `SupplierBaseMagento2` defaults to 45s). When it elapses, `execute()` aborts outstanding fetches and yields any remaining products with their basic search-response data. Those incomplete products are **not** cached, so a later search re-fetches and completes them.
- **Rate-limit handling** — when a detail fetch returns a status in `noCacheStatusCodes` (default `[429]`), that product is left uncached. AladdinSci additionally applies an escalating 429 backoff (pause-all → wait n, 2n, 3n… → probe one → resume) and throttles detail fetches to 2 concurrent, ≥350 ms apart.

## Platform Base Classes

Common e-commerce platforms have shared base classes that handle platform-specific boilerplate:

| Base Class | File | Handles |
|------------|------|---------|
| `SupplierBaseWix` | `SupplierBaseWix.ts` | Wix access token flow, GraphQL product queries (BioFuran Chem, FTF Scientific) |
| `SupplierBaseSearchanise` | `SupplierBaseSearchanise.ts` | Searchanise API, product JSON parsing (Laballey) |
| `SupplierBaseShopify` | `SupplierBaseShopify.ts` | Shopify GraphQL Storefront API product queries (AsesChem, BVV, Gold and Silver Testing, The Lab Stockroom) |
| `SupplierBaseWoocommerce` | `SupplierBaseWoocommerce.ts` | WooCommerce Store API product queries; batches variant-detail fetches via the `include` endpoint (Alchemie Labs, Amaris Chemical Solutions, Carolina Chemical, LibertySci) |
| `SupplierBaseMagento2` | `SupplierBaseMagento2.ts` | Magento 2 GraphQL product search (query in `src/queries/magento2-product-query.gql`); throttled, 429-backoff product-detail fetches with a `maxAllowableSearchTime` budget (AladdinSci) |
| `SupplierBaseAmazon` | `SupplierBaseAmazon.ts` | Amazon product page scraping (Himedia, Innovating Science) |

## SupplierFactory

`SupplierFactory` orchestrates parallel execution of multiple suppliers:

```typescript
const factory = new SupplierFactory("sodium chloride", 5, controller, ["SupplierCarolina"]);

for await (const product of factory) {
  console.log(product.supplier, product.title, product.price);
}
```

- Uses `async-await-queue` with a configurable concurrency limit (default: 3)
- Implements `AsyncGenerator` — yields products as they stream in from any supplier
- Accepts an `AbortController` for cancellation
- Optionally filters to a subset of suppliers by class name

## Adding a New Supplier

1. Create `src/suppliers/SupplierMyVendor.ts`
2. Extend the appropriate base class (`SupplierBase`, or a platform base like `SupplierBaseSearchanise`, `SupplierBaseShopify`)
3. Implement required abstract members:
   - `supplierName`, `baseURL`, `shipping`, `country`, `paymentMethods`
   - `queryProducts()` — fetch search results, apply fuzzy filtering, and return `ProductBuilder[]` instances
   - `getProductData()` — fetch individual product details (can be a no-op for JSON Only)
   - `titleSelector()` — return the product title for fuzzy matching
4. Export from `src/suppliers/index.ts`
5. The supplier will automatically appear in the SupplierFactory and settings UI

## ProductBuilder

Products are constructed using `ProductBuilder`, a fluent builder that enforces required fields:

```typescript
const product = new ProductBuilder(baseURL)
  .setTitle("Sodium Chloride")
  .setPrice("$12.99")
  .setQuantity("500g")
  .setCas("7647-14-5")
  .setSupplier("MyVendor")
  .setUrl("/products/nacl")
  .build();
```

`ProductBuilder` also handles:
- Serialization (`dump()`) and deserialization (`createFromCache()`) for caching
- Price parsing and currency detection
- Quantity normalization
- Validation of required fields before `build()`
