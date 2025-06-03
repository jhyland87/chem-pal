import {
  resetChromeActionMock,
  restoreChromeActionMock,
  setupChromeActionMock,
} from "@/__fixtures__/helpers/chromeActionMock";
import {
  resetChromeStorageMock,
  restoreChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chromeStorageMock";
import "@testing-library/jest-dom";
import { fireEvent, queryHelpers, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Set up chrome.action mock before any imports that might use it
if (!global.chrome) {
  global.chrome = {} as typeof chrome;
}

import App from "../App";

describe("App", () => {
  beforeAll(() => {
    setupChromeActionMock();
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
    resetChromeActionMock();
    render(<App />);
  });

  afterAll(() => {
    restoreChromeStorageMock();
    restoreChromeActionMock();
  });

  describe("Settings tab", () => {
    it("should be visible", () => {
      const tablist = screen.getByRole("tablist");
      const tab = queryHelpers.queryByAttribute("panel", tablist, "settings-panel");
      expect(tab).toBeInTheDocument();
    });

    it("should open the settings panel", () => {
      const tablist = screen.getByRole("tablist");
      const tab = queryHelpers.queryByAttribute("panel", tablist, "settings-panel");
      expect(tab).toBeInTheDocument();
      if (!tab) return;
      fireEvent.click(tab);
      const tabName = tab.getAttribute("panel");
      const panel = screen.getByRole("tabpanel");
      expect(panel).toBeInTheDocument();
      expect(panel.getAttribute("name")).toEqual(tabName);
    });
  });

  describe("Suppliers tab", () => {
    it("should be visible", () => {
      const tablist = screen.getByRole("tablist");
      const tab = queryHelpers.queryByAttribute("panel", tablist, "suppliers-panel");
      expect(tab).toBeInTheDocument();
    });

    it("should open the suppliers panel", () => {
      const tablist = screen.getByRole("tablist");
      const tab = queryHelpers.queryByAttribute("panel", tablist, "suppliers-panel");
      expect(tab).toBeInTheDocument();
      if (!tab) return;
      fireEvent.click(tab);
      const tabName = tab.getAttribute("panel");
      const panel = screen.getByRole("tabpanel");
      expect(panel).toBeInTheDocument();
      expect(panel.getAttribute("name")).toEqual(tabName);
    });
  });

  describe("Search", () => {
    it("tab should activate the search panel", () => {
      const tablist = screen.getByRole("tablist");
      const tab = queryHelpers.queryByAttribute("panel", tablist, "search-panel");
      expect(tab).toBeInTheDocument();
      fireEvent.click(tab as HTMLElement);
      expect((tab as HTMLElement).getAttribute("panel")).toEqual("search-panel");
    });

    it("should open the search panel", () => {
      const panel = screen.getByRole("tabpanel");
      expect(panel).toBeInTheDocument();
      expect(panel.getAttribute("name")).toEqual("search-panel");
    });
  });
});
