# Supplier System

ChemPal aggregates results from 21 active chemical supplier websites. Each supplier is a class that extends `SupplierBase` (or a platform-specific base class) and implements a standardized lifecycle for searching, parsing, and yielding products. The canonical list lives in [`src/suppliers/index.ts`](../src/suppliers/index.ts) — the barrel-export there is the source of truth that `SupplierFactory` iterates over.

## Active Suppliers

Display names below match each class's `supplierName` constant (what's shown in the UI and used as the cache/stats key). Class names follow the `Supplier*` convention in `src/suppliers/`.

| Supplier | Class | Platform (base class) | Country | Data Strategy |
|----------|-------|-----------------------|---------|---------------|
| AladdinSci | `SupplierAladdinSci` | Magento 2 | US | JSON Only |
| Alchemie Labs | `SupplierAlchemieLabs` | WooCommerce | US | JSON Only |
| Ambeed | `SupplierAmbeed` | Custom | CN | JSON Only |
| BioFuran Chem | `SupplierBioFuranChem` | Wix | US | JSON Only |
| BVV | `SupplierBVV` | Shopify | US | JSON Only |
| Carolina | `SupplierCarolina` | Custom | US | Hybrid (JSON search + HTML detail) |
| Carolina Chemical | `SupplierCarolinaChemical` | WooCommerce | US | JSON Only |
| Chemsavers | `SupplierChemsavers` | Custom | US | JSON Only |
| FTF Scientific | `SupplierFtfScientific` | Wix | US | JSON Only |
| Gold and Silver Testing | `SupplierGoldAndSilverTesting` | Shopify | US | JSON Only |
| HbarSci | `SupplierHbarSci` | Searchanise | US | JSON Only |
| Himedia | `SupplierHimedia` | Amazon | IN | JSON Only |
| Innovating Science | `SupplierInnovatingScience` | Amazon | US | JSON Only |
| Laballey | `SupplierLaballey` | Searchanise | US | JSON Only |
| Laboratorium Discounter | `SupplierLaboratoriumDiscounter` | Custom | NL | Hybrid (JSON search + HTML/JSON detail) |
| LibertySci | `SupplierLibertySci` | WooCommerce | US | JSON Only |
| Loudwolf | `SupplierLoudwolf` | Custom | US | HTML Only |
| Macklin | `SupplierMacklin` | Custom | CN | JSON Only |
| Onyxmet | `SupplierOnyxmet` | Custom | CA | HTML Only |
| Synthetika | `SupplierSynthetika` | Custom | PL | JSON Only |
| Warchem | `SupplierWarchem` | Custom | PL | HTML Only |

## Deprecated Suppliers

These supplier classes exist in `src/suppliers/` but are commented out of the barrel export in `src/suppliers/index.ts`, so `SupplierFactory` does not include them in search execution. Kept around in case the underlying sites come back online.

| Supplier | Class | Platform | Reason |
|----------|-------|----------|--------|
| Akmekem | `SupplierAkmekem` | Amazon | Supplier was removed from Amazon |
| Bunmurra Labs | `SupplierBunmurraLabs` | Wix | Site under reconstruction; new storefront not live |
| N2O3 | `SupplierN2O3` | Custom | Site offline since 2026-01-20 |

## Data Strategies

Suppliers follow one of three patterns depending on what the vendor exposes:

### JSON Only
The search API returns all product data (title, price, quantity, CAS, etc.) in a single response. No detail page fetch is required.
- Examples: Wix-based suppliers, Searchanise-based suppliers, Shopify-based suppliers, WooCommerce-based suppliers, Magento 2-based suppliers, Amazon-based suppliers, Ambeed, Chemsavers, Macklin, Synthetika

### HTML Only
Both search results and product details are scraped from HTML pages using `DOMParser`.
- Examples: Loudwolf, Onyxmet, Warchem

### Hybrid (JSON + HTML)
Search results come from a JSON/API endpoint, but full product details require fetching and scraping the individual product page.
- Examples: Carolina, Laboratorium Discounter

## Supplier Lifecycle

Every supplier follows this execution pipeline, defined in `SupplierBase.execute()`:

```
setup()
  │   Supplier-specific initialization (auth tokens, headers, etc.)
  ▼
queryProductsWithCache(query, limit)
  │   Check chrome.storage.local cache → fallback to queryProducts()
  ▼
queryProducts(query, limit)
  │   Fetch search results from the supplier's website
  │   Apply fuzzyFilter() using titleSelector() to filter irrelevant results
  │   Return ProductBuilder[] instances
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

## Platform Base Classes

Common e-commerce platforms have shared base classes that handle platform-specific boilerplate:

| Base Class | File | Handles |
|------------|------|---------|
| `SupplierBaseWix` | `SupplierBaseWix.ts` | Wix access token flow, GraphQL product queries (BioFuran Chem, FTF Scientific) |
| `SupplierBaseSearchanise` | `SupplierBaseSearchanise.ts` | Searchanise API, product JSON parsing (HbarSci, Laballey) |
| `SupplierBaseShopify` | `SupplierBaseShopify.ts` | Shopify GraphQL Storefront API product queries (BVV, Gold and Silver Testing) |
| `SupplierBaseWoocommerce` | `SupplierBaseWoocommerce.ts` | WooCommerce REST API product queries (Alchemie Labs, Carolina Chemical, LibertySci) |
| `SupplierBaseMagento2` | `SupplierBaseMagento2.ts` | Magento 2 REST/GraphQL product queries (AladdinSci) |
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
