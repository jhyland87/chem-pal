import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HotkeyConfig } from "../types";
import { getHotkeyConfigs, useHotkeys } from "../useHotkeys";

// jsdom's navigator.platform is empty -> isMac() is false, so `mod` resolves to
// ctrl and the { mac, other } binding takes the `other` branch.

function dispatchKey(init: KeyboardEventInit, target: EventTarget = document): void {
  const event = new KeyboardEvent("keydown", { cancelable: true, bubbles: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
}

describe("getHotkeyConfigs", () => {
  it("returns the configs from config.json in declaration order", () => {
    const configs = getHotkeyConfigs();
    expect(Array.isArray(configs)).toBe(true);
    expect(configs.length).toBeGreaterThan(0);
    expect(configs[0].id).toBe("showHotkeyHelp");
    for (const c of configs) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.description).toBe("string");
    }
  });
});

describe("useHotkeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("invokes the handler for a matching bare-key binding (shift+?)", () => {
    const showHotkeyHelp = vi.fn();
    renderHook(() => useHotkeys({ showHotkeyHelp }));

    dispatchKey({ key: "?", shiftKey: true });

    expect(showHotkeyHelp).toHaveBeenCalledTimes(1);
  });

  it("invokes the handler for a modifier combo (ctrl+shift+r)", () => {
    const clearAndRetrySearch = vi.fn();
    renderHook(() => useHotkeys({ clearAndRetrySearch }));

    dispatchKey({ key: "r", ctrlKey: true, shiftKey: true });

    expect(clearAndRetrySearch).toHaveBeenCalledTimes(1);
  });

  it("calls preventDefault + stopPropagation when a binding fires", () => {
    renderHook(() => useHotkeys({ showHotkeyHelp: vi.fn() }));

    const event = new KeyboardEvent("keydown", {
      key: "?",
      shiftKey: true,
      cancelable: true,
    });
    const stopSpy = vi.spyOn(event, "stopPropagation");
    act(() => {
      document.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(stopSpy).toHaveBeenCalled();
  });

  it("does not fire when the modifiers do not match (strict)", () => {
    const clearAndRetrySearch = vi.fn();
    renderHook(() => useHotkeys({ clearAndRetrySearch }));

    // ctrl+r (missing shift) must NOT match ctrl+shift+r
    dispatchKey({ key: "r", ctrlKey: true });

    expect(clearAndRetrySearch).not.toHaveBeenCalled();
  });

  it("ignores events originating from an input element", () => {
    const showHotkeyHelp = vi.fn();
    renderHook(() => useHotkeys({ showHotkeyHelp }));

    const input = document.createElement("input");
    document.body.appendChild(input);
    dispatchKey({ key: "?", shiftKey: true }, input);

    expect(showHotkeyHelp).not.toHaveBeenCalled();
  });

  it("ignores events from a textarea", () => {
    const showHotkeyHelp = vi.fn();
    renderHook(() => useHotkeys({ showHotkeyHelp }));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    dispatchKey({ key: "?", shiftKey: true }, textarea);

    expect(showHotkeyHelp).not.toHaveBeenCalled();
  });

  it("ignores events from a select element", () => {
    const showHotkeyHelp = vi.fn();
    renderHook(() => useHotkeys({ showHotkeyHelp }));

    const select = document.createElement("select");
    document.body.appendChild(select);
    dispatchKey({ key: "?", shiftKey: true }, select);

    expect(showHotkeyHelp).not.toHaveBeenCalled();
  });

  it("ignores events from a contentEditable host", () => {
    const showHotkeyHelp = vi.fn();
    renderHook(() => useHotkeys({ showHotkeyHelp }));

    const div = document.createElement("div");
    div.contentEditable = "true";
    // jsdom does not compute isContentEditable from the attribute; force it.
    Object.defineProperty(div, "isContentEditable", { value: true });
    document.body.appendChild(div);
    dispatchKey({ key: "?", shiftKey: true }, div);

    expect(showHotkeyHelp).not.toHaveBeenCalled();
  });

  it("does not fire for a matching binding with no registered handler", () => {
    // No handler for showHotkeyHelp; should be a no-op (and not throw).
    expect(() => {
      renderHook(() => useHotkeys({}));
      dispatchKey({ key: "?", shiftKey: true });
    }).not.toThrow();
  });

  it("fires onTriggered for a flash-only hotkey with no registered handler", () => {
    // clearAndRetrySearch (ctrl+shift+r) declares a flash in config.json; even
    // with no handler it should still notify so the flash message shows.
    const onTriggered = vi.fn();
    renderHook(() => useHotkeys({}, { onTriggered }));

    dispatchKey({ key: "r", ctrlKey: true, shiftKey: true });

    expect(onTriggered).toHaveBeenCalledTimes(1);
    expect(onTriggered.mock.calls[0][0]).toMatchObject({ id: "clearAndRetrySearch" });
  });

  it("does not fire onTriggered for a hotkey with neither handler nor flash", () => {
    // showHotkeyHelp has no flash; with no handler it stays a no-op.
    const onTriggered = vi.fn();
    renderHook(() => useHotkeys({}, { onTriggered }));

    dispatchKey({ key: "?", shiftKey: true });

    expect(onTriggered).not.toHaveBeenCalled();
  });

  it("calls onTriggered with the matched config after a sync handler", () => {
    const onTriggered = vi.fn();
    const showHotkeyHelp = vi.fn();
    renderHook(() => useHotkeys({ showHotkeyHelp }, { onTriggered }));

    dispatchKey({ key: "?", shiftKey: true });

    expect(onTriggered).toHaveBeenCalledTimes(1);
    expect(onTriggered.mock.calls[0][0]).toMatchObject({ id: "showHotkeyHelp" });
  });

  it("logs and swallows a synchronous handler error", () => {
    const showHotkeyHelp = vi.fn(() => {
      throw new Error("boom");
    });
    renderHook(() => useHotkeys({ showHotkeyHelp }));

    expect(() => dispatchKey({ key: "?", shiftKey: true })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(
      'Hotkey handler "showHotkeyHelp" threw',
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it("awaits an async handler and logs a rejected promise", async () => {
    const rejection = new Error("async boom");
    const showHotkeyHelp = vi.fn(() => Promise.reject(rejection));
    renderHook(() => useHotkeys({ showHotkeyHelp }));

    dispatchKey({ key: "?", shiftKey: true });
    // Let the microtask queue drain so the .catch runs.
    await Promise.resolve();
    await Promise.resolve();

    expect(console.error).toHaveBeenCalledWith(
      'Hotkey handler "showHotkeyHelp" failed',
      expect.objectContaining({ error: rejection }),
    );
  });

  it("resolves an async handler without logging on success", async () => {
    const showHotkeyHelp = vi.fn(() => Promise.resolve());
    const onTriggered = vi.fn();
    renderHook(() => useHotkeys({ showHotkeyHelp }, { onTriggered }));

    dispatchKey({ key: "?", shiftKey: true });
    await Promise.resolve();

    expect(onTriggered).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const showHotkeyHelp = vi.fn();
    const { unmount } = renderHook(() => useHotkeys({ showHotkeyHelp }));

    unmount();
    dispatchKey({ key: "?", shiftKey: true });

    expect(showHotkeyHelp).not.toHaveBeenCalled();
  });

  it("does not fire for a non-matching key", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ showHotkeyHelp: handler }));

    dispatchKey({ key: "z" });

    expect(handler).not.toHaveBeenCalled();
  });

  describe("sequential hotkeys", () => {
    const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight"];

    it("fires a sequential hotkey when keys are entered in order", () => {
      const konami = vi.fn();
      renderHook(() => useHotkeys({ konami }));

      KONAMI.forEach((key) => dispatchKey({ key }));

      expect(konami).toHaveBeenCalledTimes(1);
    });

    it("does not fire when the sequence order is wrong", () => {
      const konami = vi.fn();
      renderHook(() => useHotkeys({ konami }));

      // Swap the first two directions.
      ["ArrowDown", "ArrowUp", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].forEach((key) =>
        dispatchKey({ key }),
      );

      expect(konami).not.toHaveBeenCalled();
    });

    it("still completes when the correct sequence follows stray keys", () => {
      const konami = vi.fn();
      renderHook(() => useHotkeys({ konami }));

      dispatchKey({ key: "x" });
      KONAMI.forEach((key) => dispatchKey({ key }));

      expect(konami).toHaveBeenCalledTimes(1);
    });

    it("declares konami with no flash so its handler owns the status message", () => {
      const konami = getHotkeyConfigs().find((c) => c.id === "konami");
      // The handler flashes "advanced mode on/off" itself; a config `flash` would
      // fire a second, state-blind message on top via onTriggered.
      expect(konami?.flash).toBeUndefined();
      // Stays an easter egg — excluded from the help modal.
      expect(konami?.unlisted).toBe(true);
      expect(konami?.sequential).toBe(true);
    });

    it("fires the arrow chord binding (mod+shift+up) without touching the sequence", () => {
      const scrollResultsToTop = vi.fn();
      const konami = vi.fn();
      renderHook(() => useHotkeys({ scrollResultsToTop, konami }));

      // mod resolves to ctrl off macOS.
      dispatchKey({ key: "ArrowUp", ctrlKey: true, shiftKey: true });

      expect(scrollResultsToTop).toHaveBeenCalledTimes(1);
      expect(konami).not.toHaveBeenCalled();
    });
  });
});
