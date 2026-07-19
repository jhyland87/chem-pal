import { CACHE } from "@/constants/common";
import { useJustUpdated } from "@/hooks/useJustUpdated";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import semver from "semver";

let store: Record<string, unknown> = {};

vi.mock("@/utils/storage", () => ({
  cstorage: {
    local: {
      get: (keys: string[]) =>
        Promise.resolve(Object.fromEntries(keys.map((key) => [key, store[key]]))),
      set: (items: Record<string, unknown>) => {
        Object.assign(store, items);
        return Promise.resolve();
      },
    },
  },
}));

/** A version older than the running build, so the hook sees an upgrade. */
const PREVIOUS = "1.0.0";

describe("useJustUpdated", () => {
  beforeEach(() => {
    store = {};
  });

  it("announces the release after an upgrade", async () => {
    store[CACHE.LAST_SEEN_VERSION] = PREVIOUS;
    const { result } = renderHook(() => useJustUpdated());

    await waitFor(() => expect(result.current.notice).toBeDefined());
    expect(result.current.notice).toMatchObject({
      version: __APP_VERSION__,
      previousVersion: PREVIOUS,
    });
    expect(result.current.notice?.notes.length).toBeGreaterThan(0);
  });

  // A changelog is meaningless to someone who has never used the extension.
  it("stays silent on a fresh install", async () => {
    const { result } = renderHook(() => useJustUpdated());

    await waitFor(() => expect(store[CACHE.LAST_SEEN_VERSION]).toBe(__APP_VERSION__));
    expect(result.current.notice).toBeUndefined();
  });

  it("stays silent when the version is unchanged", async () => {
    store[CACHE.LAST_SEEN_VERSION] = __APP_VERSION__;
    const { result } = renderHook(() => useJustUpdated());

    await waitFor(() => expect(store[CACHE.LAST_SEEN_VERSION]).toBe(__APP_VERSION__));
    expect(result.current.notice).toBeUndefined();
  });

  // Rolling back shouldn't present an older release's notes as news.
  it("stays silent on a downgrade", async () => {
    store[CACHE.LAST_SEEN_VERSION] = semver.inc(__APP_VERSION__, "major") ?? "99.0.0";
    const { result } = renderHook(() => useJustUpdated());

    await waitFor(() => expect(store[CACHE.LAST_SEEN_VERSION]).toBe(__APP_VERSION__));
    expect(result.current.notice).toBeUndefined();
  });

  // Recorded up front, so a user who closes the popup without acknowledging
  // isn't shown the same release notes again on the next open.
  it("records the running version even before acknowledgement", async () => {
    store[CACHE.LAST_SEEN_VERSION] = PREVIOUS;
    renderHook(() => useJustUpdated());

    await waitFor(() => expect(store[CACHE.LAST_SEEN_VERSION]).toBe(__APP_VERSION__));
  });

  it("clears the notice on acknowledge", async () => {
    store[CACHE.LAST_SEEN_VERSION] = PREVIOUS;
    const { result } = renderHook(() => useJustUpdated());
    await waitFor(() => expect(result.current.notice).toBeDefined());

    result.current.acknowledge();

    await waitFor(() => expect(result.current.notice).toBeUndefined());
  });
});
