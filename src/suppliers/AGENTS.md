# Suppliers — agent notes

Loaded when working in this directory. Overview: [README.md](README.md). Checklists: the
`add-supplier` and `fix-supplier` skills. Repo-wide rules: [../../AGENTS.md](../../AGENTS.md).

- Extend a platform base (`SupplierBaseShopify`, `…Woocommerce`, `…Magento2`, `…Searchanise`,
  `…Wix`, `…Amazon`, `…MySimpleStore`) before reaching for `SupplierBase`.
- Declare the whole config block (static display/shipping fields, URLs) at the **top of the
  class**. Static metadata must be literals on the supplier's own class — the codegen reads them
  via the AST and does not follow inheritance.
- Never hand-edit `src/constants/supplierMeta.generated.ts`; run `pnpm run generate`.
- `ProductBuilder` optional setters take `unknown`; pass raw scraped values straight in.
- Tests that import `SupplierBase` import `ProductBuilder` **first** (module-init cycle).
- A supplier's hosts must be in `public/manifest.json` or every request fails.
- Parked suppliers live in `disabled/` and are not wired into `index.ts`.
