import type { Row } from "@tanstack/react-table";

export function quantitySortingFn(rowA: Row<Product>, rowB: Row<Product>) {
  const a = rowA.original.baseQuantity as number;
  const b = rowB.original.baseQuantity as number;
  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * Custom sorting function for match percentage comparison between two product rows.
 * Compares the match percentage of products and returns a sort order value.
 *
 * @returns Returns 1 if rowA -gt rowB, -1 if rowA -lt rowB, 0 if equal
 */
export function matchPercentageSortingFn(rowA: Row<Product>, rowB: Row<Product>) {
  const a = rowA.original.matchPercentage ?? 0;
  const b = rowB.original.matchPercentage ?? 0;
  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * Custom sorting function for price comparison between two product rows.
 * Compares the USD prices of products and returns a sort order value.
 *
 * @returns Returns 1 if rowA -gt rowB, -1 if rowA -lt rowB, 0 if equal
 */
export function priceSortingFn(rowA: Row<Product>, rowB: Row<Product>) {
  const a = (rowA.original.usdPrice ?? rowA.original.price) as number;
  const b = (rowB.original.usdPrice ?? rowB.original.price) as number;
  return a > b ? 1 : a < b ? -1 : 0;
}
