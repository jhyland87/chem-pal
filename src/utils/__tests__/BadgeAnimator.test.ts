import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetChromeActionMock,
  restoreChromeActionMock,
  setupChromeActionMock,
} from "../../__fixtures__/helpers/chrome/actionMock";
import BadgeAnimator from "../BadgeAnimator";

describe("BadgeAnimator", () => {
  let mockChromeAction: ReturnType<typeof setupChromeActionMock>;

  beforeEach(() => {
    mockChromeAction = setupChromeActionMock();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetChromeActionMock();
    vi.useRealTimers();
  });

  afterAll(() => {
    restoreChromeActionMock();
  });

  // Helper function to check badge text calls
  const expectBadgeTextCall = (
    expectedText: string,
    callIndex: number = 0,
    expectCallback: boolean = false,
  ) => {
    const calls = mockChromeAction.setBadgeText.mock.calls;
    if (!calls[callIndex]) {
      throw new Error(`No call found at index ${callIndex}. Total calls: ${calls.length}`);
    }
    expect(calls[callIndex][0]).toEqual({ text: expectedText });
    if (expectCallback) {
      expect(typeof calls[callIndex][1]).toBe("function");
    }
  };

  describe("animate", () => {
    it("should animate with custom characters", async () => {
      const chars = ["A", "B", "C"];
      BadgeAnimator.animate(chars, 100);

      // First clear call (no callback)
      expectBadgeTextCall("", 0, false);
      // First animation character (with callback)
      expectBadgeTextCall("A", 1, true);

      // Advance timer to see next character
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall("B", 2, true);

      // Advance timer to see next character
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall("C", 3, true);

      // Advance timer to see wrap back to first character
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall("A", 4, true);
    });

    it("should animate with predefined charsets", async () => {
      BadgeAnimator.animate("hourglass", 100);

      // First clear call (no callback)
      expectBadgeTextCall("", 0, false);
      // First animation character (with callback)
      expectBadgeTextCall("⏳", 1, true);

      // Advance timer to see next character
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall("⌛", 2, true);

      // Advance timer to see wrap back to first character
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall("⏳", 3, true);
    });

    it("should throw error for empty character array", () => {
      expect(() => BadgeAnimator.animate([])).toThrow(
        "At least one character is required for badge animation",
      );
    });

    it("should throw error for invalid charset name", () => {
      expect(() => BadgeAnimator.animate("invalid_charset" as any)).toThrow();
    });

    it("should clear existing animation when starting new one", async () => {
      // Start first animation
      BadgeAnimator.animate(["A", "B"], 100);
      expectBadgeTextCall("", 0, false); // Clear call
      expectBadgeTextCall("A", 1, true); // First animation character

      // Start second animation
      BadgeAnimator.animate(["X", "Y"], 100);
      expectBadgeTextCall("", 2, false); // Clear call
      expectBadgeTextCall("X", 3, true); // First animation character

      // Advance timer - should be on second animation
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall("Y", 4, true);
    });
  });

  describe("clear", () => {
    it("should clear badge immediately when no final text provided", () => {
      BadgeAnimator.clear();
      expectBadgeTextCall("", 0, false);
    });

    it("should show final text and then clear after duration", async () => {
      BadgeAnimator.clear("✓", 1000);

      // Should set final text immediately (with callback)
      expectBadgeTextCall("✓", 0, true);

      // Advance timer past duration
      await vi.advanceTimersByTimeAsync(1000);

      // Should clear after duration (no callback)
      expectBadgeTextCall("", 1, false);
    });

    it("should stop any existing animation when clearing", async () => {
      // Start an animation
      BadgeAnimator.animate(["A", "B"], 100);
      expectBadgeTextCall("", 0, false); // Clear call
      expectBadgeTextCall("A", 1, true); // First animation character

      // Clear it
      BadgeAnimator.clear();
      expectBadgeTextCall("", 2, false); // Final clear call

      // Advance timer - should not see next animation character
      await vi.advanceTimersByTimeAsync(100);
      expect(mockChromeAction.setBadgeText.mock.calls.length).toBe(3); // Only the initial clear, A, and final clear calls
    });
  });

  describe("setColor", () => {
    it("should set badge text color", () => {
      BadgeAnimator.setColor("#FFFFFF");
      expect(mockChromeAction.setBadgeTextColor).toHaveBeenCalledWith({ color: "#FFFFFF" });
    });

    it("should set badge background color", () => {
      BadgeAnimator.setColor(undefined, "#000000");
      expect(mockChromeAction.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#000000" });
    });

    it("should set both colors when both provided", () => {
      BadgeAnimator.setColor("#FFFFFF", "#000000");
      expect(mockChromeAction.setBadgeTextColor).toHaveBeenCalledWith({ color: "#FFFFFF" });
      expect(mockChromeAction.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#000000" });
    });
  });

  describe("setText", () => {
    it("should set badge text and clear any animation", async () => {
      // Start an animation
      BadgeAnimator.animate(["A", "B"], 100);
      expectBadgeTextCall("", 0, false); // Clear call
      expectBadgeTextCall("A", 1, true); // First animation character

      // Set text
      BadgeAnimator.setText("Test");
      expectBadgeTextCall("", 2, false); // Clear call
      expectBadgeTextCall("Test", 3, false); // Set text call (no callback)

      // Advance timer - should not see animation continue
      await vi.advanceTimersByTimeAsync(100);
      expect(mockChromeAction.setBadgeText.mock.calls.length).toBe(4); // Initial clear, A, clear, and Test calls
    });
  });

  describe("charsets", () => {
    it("should have all predefined charsets available", () => {
      expect(BadgeAnimator.charsets).toHaveProperty("hourglass");
      expect(BadgeAnimator.charsets).toHaveProperty("ellipsis");
      expect(BadgeAnimator.charsets).toHaveProperty("clock");
      expect(BadgeAnimator.charsets).toHaveProperty("arch");
      expect(BadgeAnimator.charsets).toHaveProperty("ball_wave");
    });

    it("should have non-empty arrays for each charset", () => {
      Object.values(BadgeAnimator.charsets).forEach((charset) => {
        expect(Array.isArray(charset)).toBe(true);
        expect(charset.length).toBeGreaterThan(0);
      });
    });
  });
});
