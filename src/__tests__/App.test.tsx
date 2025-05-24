import "@testing-library/jest-dom";
import { fireEvent, queryHelpers, render, screen } from "@testing-library/react";
//import userEvent from '@testing-library/user-event'

import App from "../App";

describe("App", () => {
  beforeEach(() => render(<App />));

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
