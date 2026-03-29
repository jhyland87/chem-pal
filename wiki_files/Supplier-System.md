# Supplier System

ChemPal aggregates results from 17 active chemical supplier websites. Each supplier is a class that extends `SupplierBase` and implements a standardized lifecycle for searching, parsing, and yielding products.

## Active Suppliers

| Supplier | Platform | Country | Data Strategy |
|----------|----------|---------|---------------|
| Ambeed | Custom | US | Hybrid (JSON search + HTML detail) |
| BioFuranChem | Wix | US | JSON Only |
| Carolina | Oracle ATG | US | JSON Only |
| Carolina Chemical | Custom | US | HTML Only |
| ChemSavers | Shopify | US | Hybrid |
| FTF Scientific | WooCommerce | US | Hybrid |
| H-Bar Scientific | Wix | US | JSON Only |
| HiMedia | Custom | IN | Hybrid |
| Innovating Science | Wix | US | JSON Only |
| Lab Alley | Shopify | US | Hybrid |
| Laboratorium Discounter | Custom | NL | Hybrid |
| Liberty Science | Custom | US | HTML Only |
| Loudwolf | Custom | US | HTML Only |
| Macklin | Custom | CN | JSON Only |
| Onyxmet | Custom | PL | Hybrid (JSON search + HTML detail) |
| Synthetika | Custom | EU | Hybrid |
| Warchem | Custom | PL | Hybrid |

## Data Strategies

Suppliers follow one of three patterns depending on what the vendor exposes:

### JSON Only
The search API returns all product data (title, price, quantity, CAS, etc.) in a single response. No detail page fetch is required.
- Examples: Wix-based suppliers, Carolina, Macklin

### HTML Only
Both search results and product details are scraped from HTML pages using `DOMParser`.
- Examples: Loudwolf, Carolina Chemical, Liberty Science

### Hybrid (JSON + HTML)
Search results come from a JSON/API endpoint, but full product details require fetching and scraping the individual product page.
- Examples: Onyxmet, Ambeed, ChemSavers, Lab Alley

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
  ▼
fuzzyFilter()
  │   Apply fuzzball WRatio scoring via titleSelector() to filter irrelevant results
  ▼
initProductBuilders()
  │   Parse raw results into ProductBuilder instances
  ▼
┌─ for each ProductBuilder ──────────────────┐
│  getProductDataWithCache(product)           │
│    │   Check cache → fallback to           │
│    ▼   getProductData(product)             │
│  finishProduct()                           │
│    │   Validate, set country/shipping,     │
│    ▼   call product.build()                │
│  yield product  ◄── back to caller         │
└────────────────────────────────────────────┘
```

## Platform Base Classes

Common e-commerce platforms have shared base classes that handle platform-specific boilerplate:

| Base Class | File | Handles |
|------------|------|---------|
| `SupplierBaseWix` | `SupplierBaseWix.ts` | Wix access token flow, GraphQL product queries |
| `SupplierBaseShopify` | `SupplierBaseShopify.ts` | Shopify storefront API, product JSON parsing |
| `SupplierBaseWoocommerce` | `SupplierBaseWoocommerce.ts` | WooCommerce REST API product queries |
| `SupplierBaseAmazon` | `SupplierBaseAmazon.ts` | Amazon product page scraping (currently unused) |

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
2. Extend the appropriate base class (`SupplierBase`, or a platform base like `SupplierBaseShopify`)
3. Implement required abstract members:
   - `supplierName`, `baseURL`, `shipping`, `country`, `paymentMethods`
   - `queryProducts()` — fetch and return raw search results
   - `initProductBuilders()` — convert raw results to `ProductBuilder` instances
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
