---
name: add-supplier
description: Add, implement, re-enable, or disable a chemical supplier in src/suppliers. Use whenever a new supplier store is being wired into ChemPal, an existing supplier class is being created from a storefront URL, or a supplier is being commented out of the barrel. Covers the full set of files a supplier touches beyond its own class — the barrel, generated constants, manifest host permissions, fixtures, tests, and CHANGELOG.
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

Give the class a TSDoc block with `@category Suppliers`, an `@example`, and `@source` — see
the `typedoc-comments` skill. Copy-pasting from a sibling supplier is fine, but fix the
class name and store description in the doc comment; several files already carry a
sibling's text.

## 3. Export it from `src/suppliers/index.ts`

Alphabetical, inside the export block. This barrel is the single source of truth for which
suppliers are live.

To disable a supplier, comment out its export **with a dated reason**, matching the
existing style at the top of the file:

```ts
// N2O3 is offline since 01/20/2026
//export { SupplierN2O3 } from "./SupplierN2O3";
```

## 4. Regenerate the supplier constants

```bash
pnpm run generate-supplier-constants
```

This rewrites `src/constants/suppliers.ts` (auto-generated, but committed). A unit test
re-checks it against the barrel, so a stale file fails the suite.

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
