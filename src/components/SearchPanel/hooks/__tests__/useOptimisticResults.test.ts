import { act, renderHook, waitFor } from "@testing-library/react";
import { startTransition } from "react";
import { describe, expect, it } from "vitest";
import {
  useOptimisticResults,
  useOptimisticResultsWithPending,
} from "../useOptimisticResults";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return { title: "Acetone", ...overrides } as unknown as Product;
}

/**
 * useOptimistic only retains optimistic values while an async transition is
 * pending; once the action settles (with confirmedResults unchanged) it reverts
 * to the base list. To observe the optimistic list we keep the transition
 * pending on a promise we resolve after asserting.
 */
function createGate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("useOptimisticResults", () => {
  it("returns the confirmed results initially", () => {
    const confirmed = [makeProduct({ title: "A" })];
    const { result } = renderHook(() => useOptimisticResults(confirmed));
    expect(result.current.results).toEqual(confirmed);
  });

  it("addResult appends an optimistic product with a positional id", async () => {
    const { result } = renderHook(() => useOptimisticResults([]));
    const gate = createGate();

    act(() => {
      startTransition(async () => {
        result.current.addResult(makeProduct({ title: "First" }));
        await gate.promise;
      });
    });

    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results[0]).toMatchObject({ title: "First", id: 0 });

    await act(async () => {
      gate.release();
    });
  });

  it("addResultsBatch appends several products with incrementing ids", async () => {
    const { result } = renderHook(() => useOptimisticResults([]));
    const gate = createGate();

    act(() => {
      startTransition(async () => {
        result.current.addResultsBatch([
          makeProduct({ title: "A" }),
          makeProduct({ title: "B" }),
        ]);
        await gate.promise;
      });
    });

    await waitFor(() => expect(result.current.results).toHaveLength(2));
    expect(result.current.results.map((r) => r.id)).toEqual([0, 1]);
    expect(result.current.results.map((r) => r.title)).toEqual(["A", "B"]);

    await act(async () => {
      gate.release();
    });
  });
});

describe("useOptimisticResultsWithPending", () => {
  it("returns the confirmed results initially", () => {
    const confirmed = [makeProduct({ title: "A" })];
    const { result } = renderHook(() => useOptimisticResultsWithPending(confirmed));
    expect(result.current.results).toEqual(confirmed);
  });

  it("addPendingResult inserts a product flagged isPending", async () => {
    const { result } = renderHook(() => useOptimisticResultsWithPending([]));
    const gate = createGate();

    act(() => {
      startTransition(async () => {
        result.current.addPendingResult(makeProduct({ title: "Pending" }));
        await gate.promise;
      });
    });

    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results[0]).toMatchObject({
      title: "Pending",
      id: 0,
      isPending: true,
    });

    await act(async () => {
      gate.release();
    });
  });

  it("confirmResult flips isPending to false for the matching id", async () => {
    const { result } = renderHook(() => useOptimisticResultsWithPending([]));
    const gate = createGate();

    act(() => {
      startTransition(async () => {
        result.current.addPendingResult(makeProduct({ title: "P" }));
        result.current.confirmResult(makeProduct({ title: "P", id: 0 }));
        await gate.promise;
      });
    });

    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results[0]).toMatchObject({ id: 0, isPending: false });

    await act(async () => {
      gate.release();
    });
  });

  it("removeFailedResult drops the matching product", async () => {
    const { result } = renderHook(() => useOptimisticResultsWithPending([]));
    const gate = createGate();

    act(() => {
      startTransition(async () => {
        result.current.addPendingResult(makeProduct({ title: "P" }));
        result.current.removeFailedResult(makeProduct({ title: "P", id: 0 }));
        await gate.promise;
      });
    });

    // The add then error should net to an empty list while pending.
    await waitFor(() => expect(result.current.results).toHaveLength(0));

    await act(async () => {
      gate.release();
    });
  });
});
