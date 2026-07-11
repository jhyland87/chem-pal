import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { THREE_DAYS_MS, withTtlCache } from "@/helpers/requestCache";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("withTtlCache", () => {
  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls the wrapped fn on a miss and caches the result", async () => {
    const fn = vi.fn(async (x: number) => x * 2);
    const cached = withTtlCache(fn, { namespace: "double" });

    expect(await cached(3)).toBe(6);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("serves a hit from cache without calling the wrapped fn again", async () => {
    const fn = vi.fn(async (x: number) => x * 2);
    const cached = withTtlCache(fn, { namespace: "double" });

    await cached(3);
    const second = await cached(3);

    expect(second).toBe(6);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("keys distinct arguments to distinct cache entries", async () => {
    const fn = vi.fn(async (x: number) => x * 2);
    const cached = withTtlCache(fn, { namespace: "double" });

    expect(await cached(3)).toBe(6);
    expect(await cached(4)).toBe(8);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("isolates namespaces so identical args don't collide", async () => {
    const a = vi.fn(async () => "a");
    const b = vi.fn(async () => "b");
    const cachedA = withTtlCache(a, { namespace: "alpha" });
    const cachedB = withTtlCache(b, { namespace: "beta" });

    expect(await cachedA()).toBe("a");
    expect(await cachedB()).toBe("b");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("re-invokes the wrapped fn once the entry has expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const fn = vi.fn(async (x: number) => x * 2);
    const cached = withTtlCache(fn, { namespace: "double", ttlMs: THREE_DAYS_MS });

    await cached(3);
    expect(fn).toHaveBeenCalledTimes(1);

    // Just before expiry: still a hit.
    vi.setSystemTime(new Date(Date.now() + THREE_DAYS_MS - 1000));
    await cached(3);
    expect(fn).toHaveBeenCalledTimes(1);

    // Past expiry: re-fetches.
    vi.setSystemTime(new Date(Date.now() + 2000));
    await cached(3);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not cache undefined results (no negative caching)", async () => {
    const fn = vi.fn(async () => undefined);
    const cached = withTtlCache(fn, { namespace: "nothing" });

    await cached();
    await cached();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("falls back to the wrapped fn when the storage read fails", async () => {
    const getSpy = vi
      .spyOn(chrome.storage.local, "get")
      .mockRejectedValueOnce(new Error("storage unavailable"));

    const fn = vi.fn(async (x: number) => x * 2);
    const cached = withTtlCache(fn, { namespace: "double" });

    expect(await cached(5)).toBe(10);
    expect(fn).toHaveBeenCalledTimes(1);

    getSpy.mockRestore();
  });
});
