import { useOptimistic } from "react";

/**
 * React v19 `useOptimistic` wrapper for streaming search results.
 * Provides optimistic updates so the UI reflects new products the
 * instant they arrive, before the full search has completed.
 * React automatically rolls back the optimistic state if a
 * transition that produced it is interrupted or errors.
 * @param confirmedResults - The server-confirmed product list (source of truth)
 * @returns An object with the current `results` array, an `addResult`
 *   function for single products, and `addResultsBatch` for bulk inserts.
 * @example
 * ```tsx
 * const { results, addResult } = useOptimisticResults(searchResults);
 *
 * for await (const product of stream) {
 *   addResult(product);   // UI updates immediately
 * }
 * // results => [{ ...product, id: 0 }, { ...product, id: 1 }, ...]
 * ```
 * @source
 */
export function useOptimisticResults(confirmedResults: Product[]) {
  const [optimisticResults, addOptimisticResult] = useOptimistic(
    confirmedResults,
    (state: Product[], newProduct: Product) => {
      return [...state, { ...newProduct, id: state.length }];
    },
  );

  /**
   * Optimistically append a single product to the results list.
   * The entry appears in the UI instantly and is later reconciled
   * when `confirmedResults` updates.
   * @param product - The product to add
   * @source
   */
  const addResult = (product: Product) => {
    addOptimisticResult(product);
  };

  /**
   * Optimistically append multiple products at once.
   * Useful when several results arrive in the same tick.
   * @param products - Array of products to add
   * @example
   * ```ts
   * addResultsBatch([productA, productB]);
   * // results => [...existing, productA, productB]
   * ```
   * @source
   */
  const addResultsBatch = (products: Product[]) => {
    products.forEach((product) => addOptimisticResult(product));
  };

  return {
    results: optimisticResults,
    addResult,
    addResultsBatch,
  };
}

/**
 * Extended optimistic-results hook that tracks a per-item pending state.
 * Each product passes through three lifecycle stages:
 * `add` (pending) → `confirm` (persisted) or `error` (removed).
 * This lets the UI render a loading indicator on rows that are not
 * yet confirmed.
 * @param confirmedResults - The server-confirmed product list (source of truth)
 * @returns An object with `results`, `addPendingResult`, `confirmResult`,
 *   and `removeFailedResult` functions.
 * @example
 * ```tsx
 * const { results, addPendingResult, confirmResult, removeFailedResult } =
 *   useOptimisticResultsWithPending(searchResults);
 *
 * addPendingResult(product);   // row appears with isPending: true
 * confirmResult(product);      // isPending flips to false
 * removeFailedResult(product); // row is removed from the list
 * ```
 * @source
 */
export function useOptimisticResultsWithPending(confirmedResults: Product[]) {
  const [optimisticResults, addOptimisticResult] = useOptimistic(
    confirmedResults,
    (
      state: Product[],
      action: { type: "add" | "confirm" | "error"; product: Product; tempId?: string },
    ) => {
      switch (action.type) {
        case "add":
          return [...state, { ...action.product, id: state.length, isPending: true }];

        case "confirm":
          return state.map((item) =>
            item.id === action.product.id ? { ...action.product, isPending: false } : item,
          );

        case "error":
          return state.filter((item) => item.id !== action.product.id);

        default:
          return state;
      }
    },
  );

  /**
   * Add a product in the pending state (`isPending: true`).
   * @param product - The product to insert optimistically
   * @source
   */
  const addPendingResult = (product: Product) => {
    addOptimisticResult({ type: "add", product });
  };

  /**
   * Mark a previously pending product as confirmed (`isPending: false`).
   * @param product - The confirmed product (must have a matching `id`)
   * @source
   */
  const confirmResult = (product: Product) => {
    addOptimisticResult({ type: "confirm", product });
  };

  /**
   * Remove a product that failed processing from the optimistic list.
   * @param product - The failed product (must have a matching `id`)
   * @source
   */
  const removeFailedResult = (product: Product) => {
    addOptimisticResult({ type: "error", product });
  };

  return {
    results: optimisticResults,
    addPendingResult,
    confirmResult,
    removeFailedResult,
  };
}
