import type { Row } from "@tanstack/react-table";

/**
 * TanStack sorting comparator that orders two product rows by their normalized
 * `baseQuantity` (a missing quantity sorts as 0).
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
