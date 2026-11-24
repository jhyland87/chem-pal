/**
 * The active supplier class names — the value exports of the `@/suppliers` barrel,
 * minus everything under `src/suppliers/disabled/`.
 *
 * This module deliberately imports **no supplier implementation**. The names are the keys of
 * the generated `SUPPLIER_META` registry, so none of the supplier classes (nor their
 * valibot/fuzzball/liqe deps) are pulled into an importing bundle. UI that needs supplier
 * *names* (the settings toggle list, the settings-validation schema) reads them here instead
 * of calling `SupplierFactory.supplierList()`, which would drag the whole supplier layer in
 * and, for `typeGuards/common`, form an import cycle.
 *
 * It must not use `import.meta.glob` either: the service worker is a single IIFE, where even a
 * lazy glob inlines every matched supplier.
 *
 * A unit test re-checks the result against the barrel, so a registry that wasn't regenerated
 * after adding or disabling a supplier fails the suite.
 *
 * @category Constants
 * @group Suppliers
 * @source
 */

import { SUPPLIER_META } from './supplierMeta.generated';

const liveSupplierNames = Object.keys(SUPPLIER_META).sort();

const liveSupplierNameSet = new Set(liveSupplierNames);

/**
 * Type guard narrowing an arbitrary string to a live {@link SupplierClassName},
 * checked against the generated live-supplier set — no supplier implementation is
 * imported. Also the mechanism by which {@link SUPPLIER_CLASS_NAMES} is typed without
 * an assertion.
 *
 * Prefer this over `SupplierFactory.isSupplierClassName` anywhere that isn't already
 * running a search: the factory's copy is equivalent but reaching it pulls the whole
 * supplier layer into the caller's bundle.
 * @param value - Candidate string to test.
 * @returns True (and narrows `value`) when it names a live supplier.
 * @example
 * ```ts
 * isSupplierClassName('SupplierCarolina'); // => true
 * ```
 * @category Constants
 * @group Suppliers
 * @source
 */
export function isSupplierClassName(value: string): value is SupplierClassName {
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
