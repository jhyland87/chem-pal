# Suppliers

Each file in this directory teaches ChemPal how to search one chemical store and normalize
its results into the app's common `Product` shape. This README is the conceptual overview —
how a supplier is structured and the two shapes most suppliers take. For the operational
checklist (barrel, manifest, fixtures, tests, CHANGELOG) see the
[`add-supplier` skill](../../.claude/skills/add-supplier/SKILL.md) and its
[reference](../../.claude/skills/add-supplier/reference.md).

> **Humans and agents:** read the [AGENTS.md](../../AGENTS.md) invariants and
> [STYLEGUIDE.md](../../STYLEGUIDE.md) before writing a supplier. The one that bites people:
> **no `as` / `!` assertions outside test files**, and **every function — including private
> helpers — needs a TSDoc block.**

## What a supplier is

A supplier is a class that extends [`SupplierBase`](SupplierBase.ts) (or one of the platform
bases) and is exported from [`index.ts`](index.ts). `SupplierBase` owns the whole
search lifecycle — caching, fuzzy matching, query fallback, rate-limit handling, the abort
budget, currency conversion — and calls down into a few methods your subclass provides.

The lifecycle, all driven by the base class's `execute()` async generator:

```
new Supplier(query, limit, controller)
        │
        ▼
  queryProducts(query, limit)   ← you implement: run the search, return ProductBuilder[]
        │                          (base wraps this with caching + keyword fallback)
        ▼
  fuzzyFilterAst(candidates)    ← base ranks/filters by title against the query
        │
        ▼
  getProductData(builder)       ← you implement (or inherit): fetch the detail page,
        │                          fill in the remaining fields
        ▼
  finishProduct(builder)        ← base validates, converts currency, computes base quantity
        │
        ▼
  yield Product                 ← consumed via `for await (const p of supplier)`
```

You never call these yourself. Consumers iterate the supplier:

```typescript
const supplier = new SupplierOnyxmet('sodium chloride', 10, new AbortController());
for await (const product of supplier) {
  console.log(product.title, product.price, product.quantity, product.uom);
}
```

## SupplierFactory — the search orchestrator

In the running app nothing constructs a single supplier directly.
[`SupplierFactory`](SupplierFactory.ts) is the one entry point the UI (via the service
worker) uses to search: you hand it a query plus options, and it fans the search out across
every selected supplier, then either streams each supplier's products as they arrive
(`executeAllStream()`) or collects them all into one array (`executeAll()`). It doesn't sort,
combine, or dedupe across suppliers — products come out per-supplier in arrival order.

```typescript
const factory = new SupplierFactory('sodium chloride', {
  controller: new AbortController(),
  limit: 5,
  suppliers: ['SupplierCarolina', 'SupplierOnyxmet'], // omit/[] = all live suppliers
});

// Stream products from every supplier as they arrive:
for await (const product of factory.executeAllStream()) {
  console.log(product.supplier, product.title, product.price);
}
```

What the factory owns that an individual supplier doesn't:

- **Selection** — reads the barrel ([`index.ts`](index.ts)), then applies the user's
  include-list, deny-list (`disabledSuppliers`), shipping filter (drops suppliers that don't
  ship to the user's location), and a passive host-permission check.
- **Instantiation & config** — constructs each chosen supplier with the shared `query`,
  `limit`, and `AbortController`, then pushes per-search settings onto it (cache options,
  fuzz-scorer override, parsed AST, time budget).
- **One-time identifier resolution** — resolves CAS / formula / SMILES terms to chemical
  names **once** and shares the result with every supplier, so no supplier re-hits the
  network (this is what feeds each supplier's `effectiveQuery`).
- **Concurrency & output** — runs suppliers in parallel through a bounded queue and emits
  each supplier's `execute()` products (streamed or collected), applying the per-product
  purchase-restriction filter. No cross-supplier sorting or dedupe.

Two consumption methods: `executeAll()` collects everything into one array; `executeAllStream()`
yields products as each supplier produces them (what the UI uses). The upshot for supplier
authors: **your class just implements the lifecycle methods** — the factory decides whether
you run, with what query, and how your results are combined. It also exposes `static` metadata
helpers (`supplierList`, `supplierDisplayNames`, `supplierShipsTo`, `supplierRequiredHosts`)
the UI reads without instantiating anything.

## Pick a base class first

Fetch the storefront and look at what powers it **before** writing anything. A platform base
already implements `queryProducts`, `titleSelector`, and `getUniqueProductKey`, so the
subclass is usually just identity fields — the difference between a 35-line file and a
350-line one.

| Storefront signal | Base class | Subclass provides |
| --- | --- | --- |
| `cdn.shopify.com`, `*.myshopify.com`, `/products.json` | `SupplierBaseShopify` | identity + `apiURL` |
| `/wp-json/wc/`, WooCommerce markup | `SupplierBaseWoocommerce` | identity |
| `searchserverapi.com` requests | `SupplierBaseSearchanise` | identity + API key |
| `wixstatic.com`, `_api/wix-ecommerce` | `SupplierBaseWix` | identity |
| `/rest/V1/` or `/graphql`, Magento markup | `SupplierBaseMagento2` | identity |
| Amazon storefront | `SupplierBaseAmazon` | identity + storefront id |
| MySimpleStore-hosted | `SupplierBaseMySimpleStore` | identity + `storeId` |
| **Anything bespoke** (custom API or plain HTML) | **`SupplierBase`** | the whole lifecycle |

See [`SupplierGoldAndSilverTesting.ts`](SupplierGoldAndSilverTesting.ts) for a minimal
platform-based supplier. The rest of this doc covers the bespoke `SupplierBase` case, since
that's where the two example shapes live.

## Required members (every supplier)

The identity fields are declared `static readonly` (the base exposes matching instance
getters, so `this.supplierName` still works):

```typescript
public static readonly supplierName: string;      // display name, shown in the UI and logs
public static readonly baseURL: string;           // https, no trailing slash; drives host permissions
public static readonly shipping: ShippingRange;   // "domestic" | "international" | "worldwide" | ...
public static readonly country: CountryCode;      // ISO 3166-1 alpha-2; drives currency
public static readonly paymentMethods: PaymentMethod[];
```

Extending `SupplierBase` directly means you also implement three abstract members:

| Method | Purpose |
| --- | --- |
| `queryProducts(query, limit)` | Run the search; return `ProductBuilder[]` with the basic fields set. |
| `titleSelector(data)` | Pull the title out of one raw result — the string fuzzy matching scores against. |
| `getUniqueProductKey(data)` | Stable per-product identity, for dedupe, caching, and exclusions. |

Optional `setup()` runs once before the search (seed a cookie, flip the store to list view).
`getProductData(builder)` is where you fetch the detail page and fill in the rest — override it
for HTML/detail-fetch suppliers, or let the store's search response carry everything and set
`skipProductDetailCache = true`.

## Building products

Assemble every result with [`ProductBuilder`](../utils/ProductBuilder.ts) rather than plain
objects — its optional-field setters take `unknown` and validate internally, so you can pass
raw scraped values straight through without pre-checking. Chain the setters; each returns the
builder.

```typescript
new ProductBuilder<Product>(this.baseURL)
  .setBasicInfo(title, url, this.supplierName)   // title, product URL, supplier name
  .setPricing(price, currencyCode, currencySymbol)
  .setQuantity(500, 'g')                         // display pair; see the quantity note below
  .setCAS('7647-14-5')
  .setID(productId)
  .setCacheKey(this.getUniqueProductKey(item));  // ALWAYS stamp the cache key
```

Common setters: `setBasicInfo`, `setPricing`, `setQuantity`, `setDescription`, `setCAS`,
`setFormula`, `setPurity`, `setGrade`, `setID`, `setSku`, `setImage`/`addImages`,
`setSmiles`, `setIupacName`, `setInChI`/`setInChIKey`, `setPubchemId`, `setMoleweight`,
`setAvailability`, `setVariants`, `setSDSUrl`. See [`ProductBuilder.ts`](../utils/ProductBuilder.ts)
for the full list.

**Reuse the shared parsers — don't write new ones:**

- `parsePrice` from [`@/helpers/currency`](../helpers/currency.ts) → `{ price, currencyCode, currencySymbol }`
- `parseQuantity` from [`@/helpers/quantity`](../helpers/quantity.ts) → `{ quantity, uom }`
- `findCAS` from [`@/helpers/cas`](../helpers/cas.ts) — checksum-validated CAS extraction
- `parsePurity`, `findFormulaInText`, `formatFormula` from [`@/helpers/science`](../helpers/science.ts)
- `mapDefined` (map + drop `undefined`) and `firstMap` (first candidate that parses) from
  [`@/helpers/utils`](../helpers/utils.ts)

**Quantity has two layers** (an AGENTS.md invariant): `quantity` + `uom` are the friendly
*display* pair; `baseQuantity` is the *sort* scale. `setQuantity` handles both — don't add a
display-layer formatter.

## HTTP: always go through the base helpers

Never call `fetch` directly — the base helpers route through the background service worker
(the only context allowed cross-origin requests), count against the request budget, and honor
the abort signal. They take a `{ path, params, headers, host }` object; `params` is
serialized to a query string and `path` may be relative to `baseURL`.

| Helper | Returns |
| --- | --- |
| `httpGetHtml({ path, params })` | response body as a `string` |
| `httpGetJson({ path, params })` | parsed JSON (`JsonValue`) |
| `httpPostJson({ path, body, headers })` | parsed JSON from a POST |
| `httpGet({ path, rethrowErrors })` | the raw response (branch on status / content type yourself) |

The query the store actually searches is `this.effectiveQuery` — when the user's input is a
CAS/formula/SMILES identifier the base swaps it for the resolved chemical name, unless the
supplier sets `supportsCAS` / `supportsFormula` / `supportsSMILES` (its search understands
that identifier natively). Use `this.effectiveQuery` in `queryProducts` unless you've opted in.

---

## Example 1 — a supplier with a custom JSON API

Many stores expose a search endpoint that returns JSON. Fetch it with `httpGetJson`, validate
each item with a type guard (no `as`), and turn the array into builders. This mirrors
[`SupplierOnyxmet.ts`](SupplierOnyxmet.ts), which fetches a JSON search endpoint and then
scrapes each product's HTML detail page.

```typescript
import { parsePrice } from '@/helpers/currency';
import { parseQuantity } from '@/helpers/quantity';
import { findCAS } from '@/helpers/cas';
import { mapDefined } from '@/helpers/utils';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { isPopulatedObject } from '@/utils/typeGuards/common';
import { isSearchResultItem } from '@/utils/typeGuards/acme';
import { SupplierBase } from './SupplierBase';

/**
 * Supplier implementation for Acme Chemicals, which exposes a JSON search API
 * at `/api/search` and full product detail at `/api/product/:id`.
 *
 * @category Suppliers
 * @source
 */
export class SupplierAcme extends SupplierBase<AcmeSearchItem, Product> implements ISupplier {
  public static readonly supplierName: string = 'Acme Chemicals';
  public static readonly baseURL: string = 'https://www.acmechem.com';
  public static readonly shipping: ShippingRange = 'worldwide';
  public static readonly country: CountryCode = 'US';
  public static readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  // Class properties go at the top, above the methods (AGENTS.md invariant).
  protected httpRequestHardLimit: number = 50;
  protected maxConcurrentRequests: number = 5;

  /**
   * Runs Acme's JSON search and returns a builder per result. Detail fields are
   * filled in later by {@link getProductData}, so only the fields the search
   * response carries are set here.
   * @param query - The (fuzzy) search term
   * @param limit - Max results to return
   * @returns Builders for the matching products, or void when the search fails
   * @example
   * ```typescript
   * const builders = await this.queryProducts('acetone', 10);
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const response = await this.httpGetJson({
      path: '/api/search',
      // Use effectiveQuery: for an identifier query the base resolves it to a name.
      params: { q: this.effectiveQuery, limit: 100 },
    });

    if (!isPopulatedObject(response) || !Array.isArray(response.items)) {
      this.logger.error('No search results', { query });
      return;
    }

    // Rank/filter the raw items by title before building — the base scores each
    // via titleSelector, so pass the raw shape straight in.
    const matches = this.fuzzyFilterAst<AcmeSearchItem>(response.items);
    return this.initProductBuilders(matches.slice(0, limit));
  }

  /**
   * Maps validated search items to builders, dropping anything malformed.
   * @param items - Raw search items that survived fuzzy filtering
   * @returns One builder per valid item
   * @example
   * ```typescript
   * const builders = this.initProductBuilders(items);
   * ```
   * @source
   */
  protected initProductBuilders(items: AcmeSearchItem[]): ProductBuilder<Product>[] {
    return mapDefined(items, (item) => {
      if (!isSearchResultItem(item)) {
        this.logger.warn('Invalid search item', { item });
        return;
      }

      const price = parsePrice(item.price);
      if (price === undefined) {
        return;
      }

      return new ProductBuilder<Product>(this.baseURL)
        .setBasicInfo(item.name, item.url, this.supplierName)
        // Carry the fuzzy/AST match score (stamped on the item by fuzzyFilterAst) onto the product.
        .setMatchPercentage(this.matchScoreOf(item))
        .setPricing(price.price, price.currencyCode, price.currencySymbol)
        .setCAS(findCAS(item.name))
        .setID(item.id)
        .setCacheKey(this.getUniqueProductKey(item));
    });
  }

  /**
   * Enriches a product from Acme's JSON detail endpoint. Wrapped in the shared
   * cache so each product is fetched at most once per TTL.
   * @param product - The builder to enrich
   * @returns The enriched builder, or void when the detail fetch fails
   * @example
   * ```typescript
   * const enriched = await this.getProductData(builder);
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      const detail = await this.httpGetJson({ path: `/api/product/${builder.get('id')}` });
      if (!isPopulatedObject(detail)) {
        return builder;
      }

      const quantity = parseQuantity(detail.pack_size);
      if (quantity) {
        builder.setQuantity(quantity.quantity, quantity.uom);
      }

      return builder
        .setPurity(detail.purity)
        .setFormula(detail.formula)
        .setSDSUrl(detail.sds_url);
    });
  }

  /**
   * Title used for fuzzy matching — Acme's search item carries it as `name`.
   * @param data - A raw Acme search item
   * @returns The product name
   * @example
   * ```typescript
   * this.titleSelector({ name: 'Acetone, 99%' }); // "Acetone, 99%"
   * ```
   * @source
   */
  protected titleSelector(data: AcmeSearchItem): string {
    return data.name;
  }

  /**
   * Stable identity for dedupe/caching — Acme's numeric product id.
   * @param data - A raw Acme search item
   * @returns The product id as a string
   * @example
   * ```typescript
   * this.getUniqueProductKey({ id: '1234' }); // "1234"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: AcmeSearchItem): string {
    return String(data.id);
  }
}
```

Key points:

- **`httpGetJson`**, never `fetch`. `params` becomes the query string.
- **Validate with a type guard** (`isSearchResultItem`), don't cast — assertions are banned
  outside tests. Guards live in [`src/utils/typeGuards/`](../utils/typeGuards/).
- **`fuzzyFilterAst`** does the ranking; you just feed it the raw items and it calls your
  `titleSelector` on each.
- **`getProductDataWithCache`** wraps the detail fetch so a product page is pulled once per
  cache TTL. If the search response already carries every field, skip `getProductData`
  entirely and set `protected readonly skipProductDetailCache = true`.

## Example 2 — an HTML-only supplier

When the store has no API, request the search page HTML, parse it with `DOMParser`, and select
product nodes. This mirrors [`SupplierLoudwolf.ts`](SupplierLoudwolf.ts).

```typescript
import { parsePrice } from '@/helpers/currency';
import { parseQuantity } from '@/helpers/quantity';
import { mapDefined } from '@/helpers/utils';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { SupplierBase } from './SupplierBase';

/**
 * Supplier implementation for Beaker Supply, a plain HTML storefront with a
 * keyword search page and per-product detail pages.
 *
 * @category Suppliers
 * @source
 */
export class SupplierBeakerSupply
  extends SupplierBase<Element, Product>
  implements ISupplier
{
  public static readonly supplierName: string = 'Beaker Supply';
  public static readonly baseURL: string = 'https://www.beakersupply.com';
  public static readonly shipping: ShippingRange = 'domestic';
  public static readonly country: CountryCode = 'US';
  public static readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  protected httpRequestHardLimit: number = 50;
  protected maxConcurrentRequests: number = 5;

  /**
   * Requests Beaker's keyword search page and returns a builder per matching
   * listing. The store only does keyword search, so it's queried with the
   * resolved chemical name via {@link effectiveQuery}.
   * @param query - The (fuzzy) search term
   * @param limit - Max results to return
   * @returns Builders for the matching listings, or void when the search fails
   * @example
   * ```typescript
   * const builders = await this.queryProducts('acetone', 10);
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const html = await this.httpGetHtml({
      path: '/search',
      params: { q: encodeURIComponent(this.effectiveQuery) },
    });

    if (!html) {
      this.logger.error('No search response', { query });
      return;
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nodes = Array.from(doc.querySelectorAll('div.product-list .product'));

    // fuzzyFilterAst runs titleSelector on each Element to score it.
    const matches = this.fuzzyFilterAst<Element>(nodes);
    return this.initProductBuilders(matches.slice(0, limit));
  }

  /**
   * Turns matched listing elements into builders, dropping any without a price
   * or product link.
   * @param elements - Product-listing elements that survived fuzzy filtering
   * @returns One builder per usable element
   * @example
   * ```typescript
   * const builders = this.initProductBuilders(elements);
   * ```
   * @source
   */
  protected initProductBuilders(elements: Element[]): ProductBuilder<Product>[] {
    return mapDefined(elements, (element) => {
      const anchor = element.querySelector('h4 a');
      const href = anchor?.getAttribute('href');
      const price = parsePrice(element.querySelector('.price')?.textContent ?? '');

      if (!href || price === undefined) {
        return;
      }

      const url = new URL(href, this.baseURL);

      return new ProductBuilder<Product>(this.baseURL)
        .setBasicInfo(anchor?.textContent?.trim() ?? '', String(url), this.supplierName)
        // Carry the fuzzy/AST match score (stamped on the element by fuzzyFilterAst) onto the product.
        .setMatchPercentage(this.matchScoreOf(element))
        .setPricing(price.price, price.currencyCode, price.currencySymbol)
        .setCacheKey(this.getUniqueProductKey(element));
    });
  }

  /**
   * Fetches and scrapes a product detail page for quantity, CAS, and grade.
   * @param product - The builder to enrich
   * @returns The enriched builder, or void when the page can't be fetched
   * @example
   * ```typescript
   * const enriched = await this.getProductData(builder);
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      const html = await this.httpGetHtml({ path: builder.get('url') });
      if (!html) {
        return builder;
      }

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const specText = doc.querySelector('.spec-table')?.textContent ?? '';

      const quantity = parseQuantity(specText);
      if (quantity) {
        builder.setQuantity(quantity.quantity, quantity.uom);
      }

      return builder.setCAS(doc.querySelector('[data-spec="cas"]')?.textContent);
    });
  }

  /**
   * Title used for fuzzy matching — the listing's link text.
   * @param data - A product-listing element
   * @returns The listing title, or an empty string when absent
   * @example
   * ```typescript
   * this.titleSelector(element); // "Acetone, ACS, 500 mL"
   * ```
   * @source
   */
  protected titleSelector(data: Element): string {
    return data.querySelector('h4 a')?.textContent?.trim() ?? '';
  }

  /**
   * Stable identity derived from the product link's `id` query param, falling
   * back to the href so the key is never empty.
   * @param data - A product-listing element
   * @returns The product id, or its href when no id is present
   * @example
   * ```typescript
   * this.getUniqueProductKey(element); // "1234"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: Element): string {
    const href = data.querySelector('h4 a')?.getAttribute('href') ?? '';
    const url = new URL(href, this.baseURL);
    return url.searchParams.get('id') ?? this.href(href);
  }
}
```

Key points:

- **`httpGetHtml`** returns the body string; parse it with the DOM's `DOMParser` (already
  available in the extension context — no cheerio/jsdom).
- The supplier's generic `S` type is `Element` — that's the raw shape flowing through
  `titleSelector`, `getUniqueProductKey`, and `fuzzyFilterAst`.
- Same `getProductDataWithCache` detail-fetch pattern as the JSON case.
- Guard every `querySelector`/`getAttribute` (`?.` and `?? ''`) — the DOM returns `null`
  liberally, and asserting it away with `!` is banned outside tests.

---

## Config flags worth knowing

Set these as `protected readonly` fields when a store needs them (see
[`SupplierBase.ts`](SupplierBase.ts) for the full set and their docs):

| Flag | Default | Set when |
| --- | --- | --- |
| `skipProductDetailCache` | `false` | The search returns every field; `getProductData` is a passthrough. |
| `minMatchPercentage` | `65` | The store's search is noisy (raise) or too strict (lower). |
| `fuzzyFilterRankOnly` | `false` | Fuzzy matching should rank but never exclude results. |
| `supportsCAS` / `supportsFormula` / `supportsSMILES` | `false` | The store's search natively accepts that identifier — keep the raw query. |
| `supportsNativeAdvancedSearch` | `false` | `queryProducts` handles a boolean/AST query itself in one request. |
| `apiURL` | — | Search hits a different host than `baseURL` (auto-added to host permissions). |
| `challengeRetryLimit` | `0` | The store 403s the first hit while planting a session cookie. |
| `httpRequestHardLimit` / `maxConcurrentRequests` | — | Cap total requests / throttle parallel detail fetches for fragile stores. |

## Wiring it in (don't stop at the class)

A supplier file alone won't appear in the UI. The full checklist is in the
[`add-supplier` skill](../../.claude/skills/add-supplier/SKILL.md); the essentials:

1. **Export** it (alphabetically) from [`index.ts`](index.ts) — the barrel is the single
   source of truth for which suppliers are live.
2. **Host permissions** — add `https://<host>/*` for `baseURL` (and any distinct `apiURL`) to
   [`public/manifest.json`](../../public/manifest.json). `requiredHosts.test.ts` enforces this.
3. **Fixture + test** — capture a real search response into `__fixtures__/<name>/` and add
   `__tests__/supplier<Name>.test.ts`. **Import `ProductBuilder` before `SupplierBase`** —
   there's a module-init cycle between them.
4. **CHANGELOG** — a user-facing line under `## [Unreleased]` → `### Added`.

To **disable** a supplier, move its file into [`disabled/`](disabled/) (fix the
`./SupplierBase…` → `../SupplierBase…` imports and add a `// DISABLED: <dated reason>` header)
and remove its barrel export. That folder is excluded from the live-supplier glob.

Verify with: `pnpm type-check && pnpm lint && pnpm test:run`.
