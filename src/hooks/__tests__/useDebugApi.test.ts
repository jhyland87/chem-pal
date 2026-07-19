import { useDebugApi } from "@/hooks/useDebugApi";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exposeDebugApi = vi.fn(() => {
  (window as { chempal?: unknown }).chempal = { help: () => {} };
});
const removeDebugApi = vi.fn(() => {
  delete (window as { chempal?: unknown }).chempal;
});

vi.mock("@/utils/debugConsole", () => ({ exposeDebugApi, removeDebugApi }));
// The hook skips its work in dev builds, where main.tsx already exposes the API.
vi.mock("@/utils/isDevBuild", () => ({ IS_DEV_BUILD: false }));

describe("useDebugApi", () => {
  beforeEach(() => {
    delete (window as { chempal?: unknown }).chempal;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (window as { chempal?: unknown }).chempal;
  });

  it("does nothing while advanced mode is off", async () => {
    renderHook(() => useDebugApi(false));
    await waitFor(() => expect(exposeDebugApi).not.toHaveBeenCalled());
    expect(window.chempal).toBeUndefined();
  });

  it("exposes the helpers when advanced mode turns on", async () => {
    renderHook(() => useDebugApi(true));
    await waitFor(() => expect(exposeDebugApi).toHaveBeenCalledTimes(1));
    expect(window.chempal).toBeDefined();
  });

  it("removes them again when advanced mode turns off", async () => {
    const { rerender } = renderHook(({ on }) => useDebugApi(on), {
      initialProps: { on: true },
    });
    await waitFor(() => expect(window.chempal).toBeDefined());

    rerender({ on: false });

    await waitFor(() => expect(removeDebugApi).toHaveBeenCalled());
    expect(window.chempal).toBeUndefined();
  });

  it("removes them on unmount", async () => {
    const { unmount } = renderHook(() => useDebugApi(true));
    await waitFor(() => expect(window.chempal).toBeDefined());

    unmount();

    await waitFor(() => expect(removeDebugApi).toHaveBeenCalled());
  });
});

describe("useDebugApi in a dev build", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // Dev builds expose the helpers at startup, so toggling advanced mode off
  // must not yank a convenience the developer never opted into.
  it("leaves the startup-exposed helpers alone", async () => {
    vi.doMock("@/utils/isDevBuild", () => ({ IS_DEV_BUILD: true }));
    const { useDebugApi: devHook } = await import("@/hooks/useDebugApi");

    const { unmount } = renderHook(() => devHook(true));
    unmount();

    expect(exposeDebugApi).not.toHaveBeenCalled();
    expect(removeDebugApi).not.toHaveBeenCalled();
  });
});
