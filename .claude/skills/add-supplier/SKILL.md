---
name: add-supplier
description: Add, implement, re-enable, or disable a chemical supplier in src/suppliers. Use whenever a new supplier store is being wired into ChemPal, an existing supplier class is being created from a storefront URL, or a supplier is being commented out of the barrel. Covers the full set of files a supplier touches beyond its own class — the barrel, the disabled/ folder, manifest host permissions, fixtures, tests, and CHANGELOG.
---

# Adding a supplier

A supplier is more than its class file. Miss a step here and the supplier either won't
appear in the UI, will fail every request with a permissions error, or will break
`requiredHosts.test.ts`. Work the checklist in order.

See [reference.md](reference.md) for the base-class comparison and the full list of
`SupplierBase` members you can override.

## 1. Identify the storefront platform first

Fetch the site and look at what powers it before writing anything — picking the right base
class is the difference between a 35-line file and a 350-line one.

| Signal | Base class |
| --- | --- |
| `cdn.shopify.com`, `*.myshopify.com`, `/products.json` | `SupplierBaseShopify` |
| `/wp-json/wc/`, `wp-content`, WooCommerce markup | `SupplierBaseWoocommerce` |
| `searchserverapi.com` requests | `SupplierBaseSearchanise` |
| `wixstatic.com`, `_api/wix-ecommerce` | `SupplierBaseWix` |
| `/rest/V1/`, Magento markup | `SupplierBaseMagento2` |
| Amazon storefront | `SupplierBaseAmazon` |
| MySimpleStore-hosted | `SupplierBaseMySimpleStore` |
| Anything bespoke | `SupplierBase` |

Platform bases already implement `queryProducts`, `titleSelector`, and
`getUniqueProductKey`, so the subclass is usually just identity fields. Read
`src/suppliers/SupplierGoldAndSilverTesting.ts` for a minimal platform-based supplier and
`src/suppliers/SupplierLoudwolf.ts` for a minimal bespoke one.

## 2. Write `src/suppliers/Supplier<Name>.ts`

Always required:

```ts
public readonly supplierName: string;      // display name
public readonly baseURL: string;           // https, no trailing slash
public readonly shipping: ShippingRange;   // "domestic" | "worldwide" | ...
public readonly country: CountryCode;
public readonly paymentMethods: PaymentMethod[];
```

Extending `SupplierBase` directly also requires `titleSelector`, `getUniqueProductKey`,
and `queryProducts`. Platform bases may require one more field (`apiURL` for Shopify,
`storeId` for MySimpleStore).

Reuse the existing parsers — do not write new ones:

- `parsePrice` from `@/helpers/currency`
- `parseQuantity` from `@/helpers/quantity`
- `mapDefined` from `@/helpers/utils`
- `ProductBuilder` from `@/utils/ProductBuilder` to assemble products

`ProductBuilder`'s optional-field setters accept `unknown` and guard internally, so pass
raw scraped values straight through rather than pre-checking them.

**Carry the match score.** In `initProductBuilders`, chain
`.setMatchPercentage(this.matchScoreOf(item))` (where `item` is the scored raw search item).
`fuzzyFilterAst` stamps the fuzzy/AST score onto the raw item for ranking, but it's dropped
unless you copy it onto the builder — `matchScoreOf` reads it back cast-free, and
`setMatchPercentage` no-ops if the item wasn't scored. Forgetting this leaves
`product.matchPercentage` undefined.

Give the class a TSDoc block with `@category Suppliers`, an `@example`, and `@source` — see
the `typedoc-comments` skill. Copy-pasting from a sibling supplier is fine, but fix the
class name and store description in the doc comment; several files already carry a
sibling's text.

## 3. Export it from `src/suppliers/index.ts`

Alphabetical, inside the export block. This barrel is the single source of truth for which
suppliers are live — it provides both `SupplierFactory`'s `import * as suppliers` and the
`SupplierClassName` type (`keyof typeof import('@/suppliers')`).

**To disable a supplier, move its file into `src/suppliers/disabled/` and remove its barrel
export.** Fix the moved file's relative imports (`./SupplierBase…` → `../SupplierBase…`) and
add a `// DISABLED: <dated reason>` header. The disabled folder is excluded from the
live-supplier glob, so this is what marks a supplier dead — there are no commented-out
barrel exports anymore. To re-enable, reverse it: move the file back up and restore the
export.

## 4. Supplier name list (no build step)

`src/constants/suppliers.ts` derives `SUPPLIER_CLASS_NAMES` at load from a lazy
`import.meta.glob` of the supplier files — **nothing to regenerate.** It relies on each
supplier's filename matching its exported class name exactly (case included); the glob keys
are the filenames. A unit test (`src/constants/__tests__/suppliers.test.ts`) asserts the
glob-derived list equals the barrel's exports, so a name-only file (no barrel export), a
filename/class-name mismatch, or a disabled supplier left in `src/suppliers/` fails the suite.

## 5. Add host permissions to `public/manifest.json`

Add `https://<host>/*` entries for the supplier's `baseURL` and any distinct `apiURL`.
`src/suppliers/__tests__/requiredHosts.test.ts` asserts that every supplier's hosts are
covered and match the `https://…/*` shape.

## 6. Fixture and test

Capture a real search response into `src/suppliers/__fixtures__/<name>/` (or
`__mocks__/<name>/` for request-level mocks), then add
`src/suppliers/__tests__/supplier<Name>.test.ts` modelled on an existing one for the same
base class.

**Import `ProductBuilder` before `SupplierBase`** — there is a module-initialization cycle
and the wrong order produces a confusing undefined-class error.

## 7. Locale keys — only if the supplier needs new UI copy

Supplier names are not localized, so most suppliers need no locale work. A supplier that
needs a notice (an eBay/Amazon storefront caveat, a shipping restriction) adds keys to all
7 locales — hand off to the `add-i18n-key` skill. See
`src/components/SearchPanel/SupplierStoreNotice.tsx` for the pattern.

## 8. CHANGELOG

Under `## [Unreleased]` → `### Added`:

```markdown
- New supplier: <Display Name>.
```

Written for users, not for the commit log — this text ships in the in-extension update
prompt.

## 9. Verify

```bash
pnpm type-check && pnpm lint && pnpm test:run
```

Ignore the `public/static/images/logo/*` churn if you ran a build — `pnpm run generate`
rewrites those every time.
