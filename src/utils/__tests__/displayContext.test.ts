import {
  resetChromeTabsMock,
  restoreChromeTabsMock,
  setupChromeTabsMock,
} from "@/__fixtures__/helpers/chrome/tabsMock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTabView, openExtensionTab, TAB_VIEW, VIEW_PARAM } from "../displayContext";

describe("displayContext", () => {
  const tabUrl = `chrome-extension://abc/index.html?${VIEW_PARAM}=${TAB_VIEW}`;

  beforeEach(() => {
    setupChromeTabsMock();
    chrome.runtime = {
      getURL: vi.fn((path: string) => `chrome-extension://abc/${path}`),
    } as unknown as typeof chrome.runtime;
    chrome.windows = {
      update: vi.fn().mockResolvedValue({}),
    } as unknown as typeof chrome.windows;
    vi.stubGlobal("close", vi.fn());
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    resetChromeTabsMock();
    restoreChromeTabsMock();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  describe("isTabView", () => {
    it("returns true when the view=tab query param is present", () => {
      window.history.replaceState({}, "", `/index.html?${VIEW_PARAM}=${TAB_VIEW}`);
      expect(isTabView()).toBe(true);
    });

    it("returns false when no view param is present (popup / side panel)", () => {
      window.history.replaceState({}, "", "/index.html");
      expect(isTabView()).toBe(false);
    });

    it("returns false for an unrelated view value", () => {
      window.history.replaceState({}, "", `/index.html?${VIEW_PARAM}=other`);
      expect(isTabView()).toBe(false);
    });
  });

  describe("openExtensionTab", () => {
    it("opens index.html with the tab param in a new tab and closes the popup", async () => {
      chrome.tabs.query = vi.fn().mockResolvedValue([]);

      await openExtensionTab();

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: tabUrl, active: true });
      expect(window.close).toHaveBeenCalled();
      expect(window.open).not.toHaveBeenCalled();
    });

    it("focuses an already-open extension tab instead of creating a duplicate", async () => {
      chrome.tabs.query = vi.fn().mockResolvedValue([{ id: 5, windowId: 9, url: tabUrl }]);

      await openExtensionTab();

      expect(chrome.tabs.update).toHaveBeenCalledWith(5, { active: true });
      expect(chrome.windows.update).toHaveBeenCalledWith(9, { focused: true });
      expect(chrome.tabs.create).not.toHaveBeenCalled();
      expect(window.close).toHaveBeenCalled();
    });

    it("falls back to window.open outside the extension runtime", async () => {
      vi.stubGlobal("chrome", undefined);

      await openExtensionTab();

      expect(window.open).toHaveBeenCalledWith(
        `/index.html?${VIEW_PARAM}=${TAB_VIEW}`,
        "_blank",
      );
    });
  });
});
