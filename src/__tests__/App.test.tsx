import "@testing-library/jest-dom";
import { fireEvent, queryHelpers, render, screen } from "@testing-library/react";
//import userEvent from '@testing-library/user-event'

import App from "../App";

let myMockedFunction: jest.Mock;
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

  // describe('Suppliers', () => {
  //   it('tab should activate the suppliers panel', () => {
  //     const tablist = screen.getByRole('tablist');
  //     const tab = queryHelpers.queryByAttribute('panel',tablist, 'suppliers-panel')
  //     expect(tab).toBeInTheDocument()
  //     fireEvent.click(tab as HTMLElement)
  //     expect((tab as HTMLElement).getAttribute('panel')).toEqual('suppliers-panel')
  //   });

  //   it('should open the suppliers panel', () => {
  //     const panel = screen.getByRole('tabpanel')
  //     expect(panel).toBeInTheDocument();
  //     expect(panel.getAttribute('name')).toEqual('suppliers-panel')
  //   })

  //   // it('should have the suppliers input', () => {
  //   //   const queryInput = screen.getByPlaceholderText('Search...')
  //   //   expect(queryInput).toBeInTheDocument();
  //   // })
  // })

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

    /*it('should have the search input', () => {
      const queryInput = screen.getByPlaceholderText('Search...')
      expect(queryInput).toBeInTheDocument();
    })*/
  });

  // describe('all tabs ', () => {
  //   it('testing each tab', () => {
  //     const tabs = screen.getAllByRole('tab');
  //     expect(tabs).toHaveLength(3)
  //     for (const tab of tabs) {
  //       const tabName = tab.getAttribute('panel')
  //       fireEvent.click(tab)
  //       const panel = screen.getByRole('tabpanel')
  //       expect(panel).toBeInTheDocument();
  //       expect(panel.getAttribute('name')).toEqual(tabName)
  //     }
  //   });

  //   // test('Snapshot', () => {
  //   //   const { asFragment } = render(<App />);
  //   //   expect(asFragment()).toMatchSnapshot();
  //   // })

  //   it('suppliers panel', () => {
  //     //const queryInput = screen.getByPlaceholderText('Search...')
  //     //expect(queryInput).toBeInTheDocument();
  //     const headerElement = screen.getByText('Suppliers');
  //     expect(headerElement).toBeInTheDocument();
  //     fireEvent.click(headerElement)
  //     const checkbox1 = screen.getByLabelText(/^Supplier.+/);
  //     expect(checkbox1).toBeInTheDocument();
  //   })
  // })
});
