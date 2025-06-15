import { useOptimistic } from "react";

/**
 * React v19 useOptimistic hook for streaming search results.
 *
 * This hook provides optimistic updates for search results as they stream in,
 * giving users immediate feedback while the search is still running.
 *
 * Benefits:
 * - Immediate UI updates as results arrive
 * - Automatic rollback on errors
 * - Better perceived performance
 * - Reduced complex state synchronization
 */
export function useOptimisticResults(confirmedResults: Product[]) {
  const [optimisticResults, addOptimisticResult] = useOptimistic(
    confirmedResults,
    (state: Product[], newProduct: Product) => {
      // Add the new result optimistically while it's being processed
      // This gives immediate feedback to the user
      return [...state, { ...newProduct, id: state.length }];
    },
  );

  const addResult = (product: Product) => {
    // Optimistically add the result immediately for better UX
    // The UI will update instantly, then be confirmed/rolled back later
    addOptimisticResult(product);
  };

  const addResultsBatch = (products: Product[]) => {
    // For batch updates (useful when multiple results arrive simultaneously)
    products.forEach((product) => addOptimisticResult(product));
  };

  return {
    results: optimisticResults,
    addResult,
    addResultsBatch,
  };
}

/**
 * Enhanced version that includes pending state indicators
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
          // Add with pending indicator
          return [...state, { ...action.product, id: state.length, isPending: true }];

        case "confirm":
          // Remove pending indicator when confirmed
          return state.map((item) =>
            item.id === action.product.id ? { ...action.product, isPending: false } : item,
          );

        case "error":
          // Remove failed items
          return state.filter((item) => item.id !== action.product.id);

        default:
          return state;
      }
    },
  );

  const addPendingResult = (product: Product) => {
    addOptimisticResult({ type: "add", product });
  };

  const confirmResult = (product: Product) => {
    addOptimisticResult({ type: "confirm", product });
  };

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
