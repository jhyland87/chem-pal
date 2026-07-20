import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SupplierStoreNotice } from "../SupplierStoreNotice";

const EBAY_URL = "https://www.ebay.com/str/dailybiousa";
const AMAZON_URL = "https://www.amazon.com/s?k=HiMedia";

const makeProduct = (overrides: Partial<Product>): Product =>
  ({
    title: "Sodium nitrite",
    supplier: "Daily Bio USA",
    ...overrides,
  }) as Product;

describe("SupplierStoreNotice", () => {
  it("names only eBay when that is the supplier's marketplace", () => {
    render(
      <SupplierStoreNotice
        product={makeProduct({
          paymentMethods: ["ebayonly"],
          supplierEbayStoreURL: EBAY_URL,
        })}
      />,
    );

    expect(screen.getByRole("note")).toHaveTextContent(/fewer restrictions from their eBay store/);
    expect(screen.getByRole("note")).not.toHaveTextContent(/Amazon/);

    const link = screen.getByRole("link", { name: /eBay store/ });
    expect(link).toHaveAttribute("href", EBAY_URL);
  });

  it("names only Amazon when that is the supplier's marketplace", () => {
    render(
      <SupplierStoreNotice
        product={makeProduct({
          supplier: "Himedia",
          paymentMethods: ["amazononly"],
          supplierAmazonStoreURL: AMAZON_URL,
        })}
      />,
    );

    expect(screen.getByRole("note")).toHaveTextContent(/fewer restrictions from their Amazon store/);
    expect(screen.getByRole("note")).not.toHaveTextContent(/eBay/);
    expect(screen.getByRole("link", { name: /Amazon store/ })).toHaveAttribute("href", AMAZON_URL);
  });

  it("uses the plural both-stores wording and links each store", () => {
    render(
      <SupplierStoreNotice
        product={makeProduct({
          paymentMethods: ["ebayonly", "amazononly"],
          supplierEbayStoreURL: EBAY_URL,
          supplierAmazonStoreURL: AMAZON_URL,
        })}
      />,
    );

    expect(screen.getByRole("note")).toHaveTextContent(
      /fewer restrictions from their eBay and Amazon stores/,
    );
    expect(screen.getByRole("link", { name: /eBay store/ })).toHaveAttribute("href", EBAY_URL);
    expect(screen.getByRole("link", { name: /Amazon store/ })).toHaveAttribute("href", AMAZON_URL);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("uses the informational 'more products' wording for a plain 'ebay' supplier", () => {
    render(
      <SupplierStoreNotice
        product={makeProduct({
          supplier: "Orbit Natural Product Derivatives",
          paymentMethods: ["mastercard", "visa", "ebay"],
          supplierEbayStoreURL: EBAY_URL,
        })}
      />,
    );

    // The soft notice, not the "fewer restrictions" warning that "ebayonly" triggers.
    expect(screen.getByRole("note")).toHaveTextContent(/More products are available/);
    expect(screen.getByRole("note")).not.toHaveTextContent(/fewer restrictions/);
    expect(screen.getByRole("link", { name: /eBay store/ })).toHaveAttribute("href", EBAY_URL);
  });

  it("omits the eBay link for a plain 'ebay' supplier that sets no store URL", () => {
    // The plain method's store URL is optional, so a missing one simply shows no notice.
    const { container } = render(
      <SupplierStoreNotice product={makeProduct({ paymentMethods: ["ebay"] })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a supplier with ordinary payment methods", () => {
    const { container } = render(
      <SupplierStoreNotice product={makeProduct({ paymentMethods: ["visa", "mastercard"] })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the product carries no payment methods at all", () => {
    const { container } = render(<SupplierStoreNotice product={makeProduct({})} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the payment method is set but the store URL is missing", () => {
    // A misconfigured supplier: showing the notice here would advertise a store we can't link to.
    const { container } = render(
      <SupplierStoreNotice product={makeProduct({ paymentMethods: ["ebayonly"] })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("ignores a store URL whose payment method is absent", () => {
    const { container } = render(
      <SupplierStoreNotice
        product={makeProduct({
          paymentMethods: ["visa"],
          supplierEbayStoreURL: EBAY_URL,
        })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the configured half when a supplier declares both but sets one URL", () => {
    render(
      <SupplierStoreNotice
        product={makeProduct({
          paymentMethods: ["ebayonly", "amazononly"],
          supplierEbayStoreURL: EBAY_URL,
        })}
      />,
    );

    // Falls back to the singular eBay sentence rather than promising an Amazon store with no link.
    expect(screen.getByRole("note")).toHaveTextContent(/fewer restrictions from their eBay store/);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
