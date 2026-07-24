import { getUnitPrice } from '@/helpers/price';
import { sortablePurityGrade } from '@/helpers/science';
import type { Row } from '@tanstack/react-table';

/**
 * @category Tanstack Sorting Functions
 * @showCategories
 * @categoryDescription Scientific formula parsing and chemical notation utilities.
 * @source
 */

/**
 * TanStack sorting comparator that orders two product rows by their normalized
 * `baseQuantity` (a missing quantity sorts as 0).
 * @category Tanstack Sorting Functions
 * @param rowA - The first row to compare.
 * @param rowB - The second row to compare.
 * @returns `1` if rowA ranks after rowB, `-1` if before, `0` if equal.
 * @example
 * ```ts
 * useReactTable({ sortingFns: { quantity: quantitySortingFn }, ... });
 * // A row with baseQuantity 500 sorts after one with 100.
 * ```
 * @source
 */
export function quantitySortingFn(rowA: Row<Product>, rowB: Row<Product>) {
  const a = rowA.original.baseQuantity ?? 0;
  const b = rowB.original.baseQuantity ?? 0;
  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * Custom sorting function for match percentage comparison between two product rows.
 * Compares the match percentage of products and returns a sort order value.
 * @category Tanstack Sorting Functions
 * @param rowA - The first row to compare.
 * @param rowB - The second row to compare.
 * @returns `1` if rowA ranks after rowB, `-1` if before, `0` if equal.
 * @example
 * ```ts
 * useReactTable({ sortingFns: { match: matchPercentageSortingFn }, ... });
 * // A row with matchPercentage 90 sorts after one with 70.
 * ```
 * @source
 */
export function matchPercentageSortingFn(rowA: Row<Product>, rowB: Row<Product>) {
  const a = rowA.original.matchPercentage ?? 0;
  const b = rowB.original.matchPercentage ?? 0;
  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * Custom sorting function for price comparison between two product rows.
 * Compares the USD prices of products (falling back to raw price) and returns
 * a sort order value.
 * @category Tanstack Sorting Functions
 * @param rowA - The first row to compare.
 * @param rowB - The second row to compare.
 * @returns `1` if rowA ranks after rowB, `-1` if before, `0` if equal.
 * @example
 * ```ts
 * useReactTable({ sortingFns: { price: priceSortingFn }, ... });
 * // A row with usdPrice 29.99 sorts after one with 9.99.
 * ```
 * @source
 */
export function priceSortingFn(rowA: Row<Product>, rowB: Row<Product>) {
  const a = rowA.original.usdPrice ?? rowA.original.price ?? 0;
  const b = rowB.original.usdPrice ?? rowB.original.price ?? 0;
  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * TanStack sorting comparator that orders two product rows by their price per
 * base unit ({@link getUnitPrice}). Rows whose unit price can't be computed
 * (missing price/quantity or an unconvertible unit) sort to the bottom rather
 * than appearing as the cheapest.
 * @category Tanstack Sorting Functions
 * @param rowA - The first row to compare.
 * @param rowB - The second row to compare.
 * @returns `1` if rowA ranks after rowB, `-1` if before, `0` if equal.
 * @example
 * ```ts
 * useReactTable({ sortingFns: { unitPriceSortingFn }, ... });
 * // A row at $0.10/g sorts after one at $0.02/g.
 * ```
 * @source
 */
export function unitPriceSortingFn(rowA: Row<Product>, rowB: Row<Product>) {
  const a = getUnitPrice(rowA.original) ?? Number.POSITIVE_INFINITY;
  const b = getUnitPrice(rowB.original) ?? Number.POSITIVE_INFINITY;
  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * TanStack sorting comparator that orders two product rows by purity. The column mixes two
 * kinds of value — a chemical grade (`"ACS Grade"`) and a percentage (`"≥99.8%"`) — so both
 * are put on one numeric scale by {@link sortablePurityGrade}. Reads `grade ?? purity`, the
 * same precedence the purity column's accessor uses, so the sort order matches what the cell
 * shows. A row with neither (or an unrecognized grade, e.g. `"Ungraded"`) sorts as 0.
 * @category Tanstack Sorting Functions
 * @param rowA - The first row to compare.
 * @param rowB - The second row to compare.
 * @returns `1` if rowA ranks after rowB, `-1` if before, `0` if equal.
 * @example
 * ```ts
 * useReactTable({ sortingFns: { puritySortingFn }, ... });
 * // "ACS Grade" (99.8) sorts after "Technical Grade" (90), which sorts after "95%".
 * ```
 * @source
 */
export function puritySortingFn(rowA: Row<Product>, rowB: Row<Product>) {
  const a = sortablePurityGrade(rowA.original.grade ?? rowA.original.purity ?? '');
  const b = sortablePurityGrade(rowB.original.grade ?? rowB.original.purity ?? '');
  return a > b ? 1 : a < b ? -1 : 0;
}
