/**
 * The active supplier class names — the value exports of the `@/suppliers` barrel,
 * minus everything under `src/suppliers/disabled/`.
 *
 * This module deliberately imports **no supplier implementation**. It derives the
 * names from a *lazy* `import.meta.glob` of the supplier files: only the glob's
 * keys (file paths) are read and the import thunks are never called, so none of the
 * supplier classes — nor their zod/fuzzball/liqe/jszip deps — are pulled into an
 * importing entry point's bundle. UI that needs supplier *names* (the settings
 * toggle list, the settings-validation schema) reads them here instead of calling
 * `SupplierFactory.supplierList()`, which would drag the whole supplier layer in
 * and, for `typeGuards/common`, form an import cycle.
 *
 * Filenames match their exported class name one-to-one, so a class name is just the
 * file's basename. Non-supplier modules are excluded by pattern — the `SupplierBase*`
 * platform bases, `SupplierFactory`, and the `SupplierFoobar` template — and disabled
 * suppliers are excluded by living in `./disabled/` (glob `*` never crosses `/`).
 *
 * A unit test re-checks the result against the barrel, so adding a supplier file
 * without exporting it from the barrel (or vice versa) fails the suite.
 *
 * @category Constants
 * @group Suppliers
 * @source
 */

// Lazy glob (thunks never invoked) — reading only the keys keeps every supplier
// implementation out of the importing bundle. Mirrors the messages.json glob in
// helpers/i18n.ts.
const liveSupplierModules = import.meta.glob([
  '/src/suppliers/Supplier*.ts',
  '!/src/suppliers/SupplierBase*.ts',
  '!/src/suppliers/SupplierFactory.ts',
]);

/**
 * Extracts a supplier's class name from its module path — the file's basename
 * without extension, which equals the exported class name one-to-one.
 * @param path - A glob key, e.g. `"/src/suppliers/SupplierCarolina.ts"`.
 * @returns The class name, e.g. `"SupplierCarolina"`.
 * @example
 * ```ts
 * supplierClassNameFromPath('/src/suppliers/SupplierCarolina.ts'); // => "SupplierCarolina"
 * ```
 * @source
 */
function supplierClassNameFromPath(path: string): string {
  const file = path.slice(path.lastIndexOf('/') + 1);
  return file.slice(0, file.lastIndexOf('.'));
}

const liveSupplierNames = Object.keys(liveSupplierModules).map(supplierClassNameFromPath).sort();

const liveSupplierNameSet = new Set(liveSupplierNames);

/**
 * Type guard narrowing an arbitrary string to a live {@link SupplierClassName},
 * checked against the glob-derived live-supplier set — no supplier implementation is
 * imported. Also the mechanism by which {@link SUPPLIER_CLASS_NAMES} is typed without
 * an assertion.
 * @param value - Candidate string to test.
 * @returns True (and narrows `value`) when it names a live supplier.
 * @example
 * ```ts
 * isSupplierClassName('SupplierCarolina'); // => true
 * ```
 * @source
 */
function isSupplierClassName(value: string): value is SupplierClassName {
  return liveSupplierNameSet.has(value);
}

/**
 * The active supplier class names, sorted, mirroring the value exports of the
 * `@/suppliers` barrel. See the module header for how it stays dependency-free.
 * @category Constants
 * @group Suppliers
 * @source
 */
export const SUPPLIER_CLASS_NAMES: readonly SupplierClassName[] =
  liveSupplierNames.filter(isSupplierClassName);
