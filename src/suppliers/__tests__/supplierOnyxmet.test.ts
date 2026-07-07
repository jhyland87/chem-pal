import { createDOM } from "@/helpers/request";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { describe, expect, it } from "vitest";
import { SupplierOnyxmet } from "../SupplierOnyxmet";

// Exposes the private option-parsing method for direct testing.
type OnyxmetInternals = {
  parseVariants: (content: Element) => Partial<Variant>[];
};

const makeSupplier = () => new SupplierOnyxmet("sodium", 1) as unknown as OnyxmetInternals;

// Mirrors the real "Available Options" markup: an amount and a parenthesized price
// split across lines inside each radio's label, plus the unrelated Qty field which
// must not be picked up as an option.
const productHtml = (options: string) => `
<div id="content">
  <div id="product">
    <h3 class="product-option">Available Options</h3>
    <div class="form-group required">
      <label class="control-label">Amount</label>
      <div id="input-option260">${options}</div>
    </div>
    <div class="form-group qty">
      <label class="control-label" for="input-quantity">Qty</label>
      <input type="text" name="quantity" value="1" id="input-quantity" />
    </div>
  </div>
</div>`;

const radio = (value: string, amount: string, price: string) => `
  <div class="radio">
    <label>
      <input type="radio" name="option[260]" value="${value}" />
      ${amount}
      (${price})
    </label>
  </div>`;

const contentOf = (html: string): Element => {
  const content = createDOM(html).querySelector("#content");
  if (!content) throw new Error("fixture missing #content");
  return content;
};

describe("SupplierOnyxmet parseVariants", () => {
  it("parses each size radio into a variant, pairing amount with its parenthesized price", () => {
    const supplier = makeSupplier();

    const variants = supplier.parseVariants(
      contentOf(productHtml(radio("1416", "10g", "5.00€") + radio("146", "100g", "30.00€"))),
    );

    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({ id: "1416", title: "10g", quantity: 10, uom: "g", price: 5 });
    expect(variants[1]).toMatchObject({
      id: "146",
      title: "100g",
      quantity: 100,
      uom: "g",
      price: 30,
    });
    // Currency is left unset so it inherits the parent product at build time.
    expect(variants[0].currencyCode).toBeUndefined();
  });

  it("ignores the Qty field and returns an empty array when there are no options", () => {
    const supplier = makeSupplier();

    expect(supplier.parseVariants(contentOf(productHtml("")))).toEqual([]);
  });

  it("skips an option whose label is missing a quantity or price", () => {
    const supplier = makeSupplier();

    const variants = supplier.parseVariants(
      contentOf(productHtml(radio("1", "10g", "5.00€") + radio("2", "sample", ""))),
    );

    expect(variants).toHaveLength(1);
    expect(variants[0]).toMatchObject({ id: "1", quantity: 10, price: 5 });
  });
});
