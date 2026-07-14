import { createDOM } from "@/helpers/request";
import { parseQuantity } from "@/helpers/quantity";
import { isMinimalProduct } from "@/utils/typeGuards/common";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierLeroChem } from "../SupplierLeroChem";

const searchListingHtml = readFileSync(
  resolve(__dirname, "../__fixtures__/lerochem/search-listing.html"),
  "utf8",
);
const productPageHtml = readFileSync(
  resolve(__dirname, "../__fixtures__/lerochem/product-page.html"),
  "utf8",
);
const variantRefresh = JSON.parse(
  readFileSync(resolve(__dirname, "../__fixtures__/lerochem/variant-refresh.json"), "utf8"),
);

const makeSupplier = () => new SupplierLeroChem("acid", 5);

type LeroChemInternals = {
  parseSearchCards: (html: string) => Element[];
  initProductBuilders: (elements: Element[]) => ProductBuilder<Product>[];
  getUniqueProductKey: (el: Element) => string;
  titleSelector: (el: Element) => string | undefined;
  applyDataTable: (b: ProductBuilder<Product>, dom: Document) => void;
  applyDocumentLinks: (b: ProductBuilder<Product>, dom: Document) => void;
  descriptionToText: (html: unknown) => string | undefined;
  shortDescriptionToText: (html: unknown) => string | undefined;
  gradeFromName: (name: unknown) => string | undefined;
  parseVariants: (b: ProductBuilder<Product>, dom: Document) => Promise<Partial<Variant>[]>;
  parseTotalPages: (html: string) => number;
  queryProducts: (q: string, l?: number) => Promise<ProductBuilder<Product>[] | void>;
  getProductData: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
};

describe("SupplierLeroChem initProductBuilders", () => {
  it("extracts product fields from the search-result cards", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;

    const cards = supplier.parseSearchCards(searchListingHtml);
    const builders = supplier.initProductBuilders(cards);

    expect(builders).toHaveLength(2);
    const first = builders[0].dump();
    expect(first.title).toBe("SULFURIC ACID (tech grade), 98%, L");
    expect(first.url).toBe(
      "https://lerochem.eu/en/pagrindinis/208-sulfuric-acid-tech-grade-98-l.html",
    );
    expect(first.supplier).toBe("LeroChem");
    // The card price is the numeric microdata `content`, not the "5.00 €" display text.
    expect(first.price).toBe(5);
    expect(first.currencyCode).toBe("EUR");
    expect(first.currencySymbol).toBe("€");
    expect(first.images).toEqual([
      { href: "https://lerochem.eu/595-large_default/sulfuric-acid-tech-grade-98-l.webp", type: "image" },
    ]);
    expect(builders[1].dump().price).toBe(5.2);
  });
});

describe("SupplierLeroChem getUniqueProductKey", () => {
  it("uses data-id-product when present", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    const cards = supplier.parseSearchCards(searchListingHtml);
    expect(supplier.getUniqueProductKey(cards[0])).toBe("208");
  });

  it("falls back to the numeric id in the product URL when the card has no id", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    const dom = createDOM(
      '<article class="product-miniature"><h3 class="product-title">' +
        '<a href="https://lerochem.eu/en/pagrindinis/126-abs-acid-labsa-96-l.html">ABS ACID</a>' +
        "</h3></article>",
    );
    const card = dom.querySelector("article.product-miniature");
    expect(card).not.toBeNull();
    if (card) {
      expect(supplier.getUniqueProductKey(card)).toBe("126");
    }
  });
});

describe("SupplierLeroChem titleSelector", () => {
  it("reads the product title from a card", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    const cards = supplier.parseSearchCards(searchListingHtml);
    expect(supplier.titleSelector(cards[0])).toBe("SULFURIC ACID (tech grade), 98%, L");
  });
});

describe("SupplierLeroChem applyDataTable", () => {
  it("extracts CAS, formula, and molar mass from the #description spec table", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    const builder = new ProductBuilder<Product>("https://lerochem.eu");

    supplier.applyDataTable(builder, createDOM(productPageHtml));

    const dump = builder.dump();
    expect(dump.cas).toBe("27176-87-0");
    // <sub> atom counts are converted to Unicode subscripts.
    expect(dump.formula).toBe("C₁₈H₂₉NaO₃S");
    expect(dump.iupacName).toBe("Dodecylbenzenesulphonic acid");
    // "326,49" -> 326.49 (decimal comma).
    expect(dump.moleweight).toBe(326.49);
  });
});

describe("SupplierLeroChem descriptionToText", () => {
  it("strips every table and returns tag-free plain text", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    const html =
      "<h2>ABS acid</h2>" +
      "<table><tbody><tr><td>Formula</td><td>KOH</td></tr></tbody></table>" +
      "<p>An anionic surfactant.</p>" +
      "<table><tbody><tr><td>Signal word: DANGER</td></tr></tbody></table>" +
      "<p>Harmful if swallowed.</p>";

    const out = supplier.descriptionToText(html);

    expect(out).toContain("An anionic surfactant.");
    expect(out).toContain("Harmful if swallowed.");
    // Both tables removed.
    expect(out).not.toContain("Formula");
    expect(out).not.toContain("KOH");
    expect(out).not.toContain("DANGER");
    // No HTML tags remain.
    expect(out).not.toMatch(/<[^>]+>/);
  });

  it("returns undefined for empty/absent input", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    expect(supplier.descriptionToText(undefined)).toBeUndefined();
    expect(supplier.descriptionToText("")).toBeUndefined();
  });
});

describe("SupplierLeroChem shortDescriptionToText", () => {
  it("removes the COA/Declaration links and returns plain text", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    const html =
      '<p><strong><a href="https://lerochem.eu/img/cms/EN%20COA/COA%20ABS.pdf">CERTIFICATE OF ANALYSIS</a></strong></p>' +
      '<p><strong><a href="https://lerochem.eu/img/cms/PARSISIUNTIMAI/DECLARATION%20ABS.pdf">DECLARATION</a></strong></p>' +
      "<p>Alkyl benzene sulfonic acid, CAS 27176-87-0.</p>";

    const out = supplier.shortDescriptionToText(html);

    expect(out).toBe("Alkyl benzene sulfonic acid, CAS 27176-87-0.");
    expect(out).not.toContain("CERTIFICATE");
    expect(out).not.toContain("DECLARATION");
  });
});

describe("SupplierLeroChem gradeFromName", () => {
  it("extracts the grade tagged in a product name", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    expect(supplier.gradeFromName("SULFURIC ACID (tech grade), 98%, L")).toBe("tech grade");
    expect(supplier.gradeFromName("TARTARIC ACID DL (-+), food grade,99%, kg")).toBe("food grade");
    expect(supplier.gradeFromName("ABS ACID (LABSA) 96%, L")).toBeUndefined();
  });
});

describe("SupplierLeroChem applyDocumentLinks", () => {
  it("extracts the COA and SDS (Declaration) links from the short description", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    const builder = new ProductBuilder<Product>("https://lerochem.eu");

    supplier.applyDocumentLinks(builder, createDOM(productPageHtml));

    const dump = builder.dump();
    expect(dump.coaUrl).toBe("https://lerochem.eu/img/cms/EN%20COA/COA%20ABS%20Acid.pdf");
    expect(dump.sdsUrl).toBe(
      "https://lerochem.eu/img/cms/PARSISIUNTIMAI/DECLARATION%20ABS%20Acid.pdf",
    );
  });
});

describe("SupplierLeroChem parseVariants", () => {
  it("prices the default size from the page and other sizes via the refresh AJAX", async () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    vi.spyOn(supplier as never, "httpPostJson").mockResolvedValue(variantRefresh as never);

    const builder = new ProductBuilder<Product>("https://lerochem.eu");
    builder.setPrice(5.2);

    const variants = await supplier.parseVariants(builder, createDOM(productPageHtml));

    expect(variants).toHaveLength(2);
    // Default (checked) size inherits the page price.
    expect(variants[0]).toMatchObject({ id: "26", title: "1 L", quantity: 1, price: 5.2 });
    // Non-default size is priced from the refresh response's data-product.
    expect(variants[1]).toMatchObject({ id: "27", title: "5 L", quantity: 5, price: 22 });
    // Currency is left unset so variants inherit the parent product at build time.
    expect(variants[0].currencyCode).toBeUndefined();
  });
});

describe("SupplierLeroChem parseTotalPages", () => {
  const paginationHtml = (summary: string) =>
    `<nav class="pagination"><div>${summary}</div><ul class="page-list">` +
    '<li class="current"><a aria-label="Page 1">1</a></li>' +
    '<li><a aria-label="Page 2">2</a></li>' +
    '<li><span class="spacer">…</span></li>' +
    '<li><a aria-label="Page 9">9</a></li>' +
    '<li><a rel="next" aria-label="Next">Next</a></li></ul></nav>';

  it("derives the page count from the 'Showing X-Y of Z' summary", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    // 201 items at 24/page -> ceil(201/24) = 9 pages.
    expect(supplier.parseTotalPages(paginationHtml("Showing 1-24 of 201 item(s)"))).toBe(9);
  });

  it("returns 1 when there is no pagination", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    expect(supplier.parseTotalPages("<div>no pagination here</div>")).toBe(1);
  });

  it("falls back to the highest numbered page link when the summary is missing", () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    expect(supplier.parseTotalPages(paginationHtml("results"))).toBe(9);
  });
});

describe("SupplierLeroChem queryProducts", () => {
  it("fetches, fuzzy-filters, and builds from the search listing", async () => {
    const supplier = new SupplierLeroChem("sulfuric", 5);
    const internals = supplier as unknown as LeroChemInternals;
    vi.spyOn(supplier as never, "httpGetHtml").mockResolvedValue(searchListingHtml as never);

    const results = await internals.queryProducts("sulfuric", 5);

    expect(results).toBeTruthy();
    expect(results?.some((b) => b.dump().title?.includes("SULFURIC"))).toBe(true);
  });
});

describe("SupplierLeroChem getProductData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses the ld+json, data-product, spec table, and variants", async () => {
    const supplier = makeSupplier() as unknown as LeroChemInternals;
    vi.spyOn(supplier as never, "httpGetHtml").mockResolvedValue(productPageHtml as never);
    vi.spyOn(supplier as never, "httpPostJson").mockResolvedValue(variantRefresh as never);
    // Bypass the cache wrapper and run the fetcher directly.
    vi.spyOn(supplier as never, "getProductDataWithCache").mockImplementation(
      ((b: ProductBuilder<Product>, fetcher: (b: ProductBuilder<Product>) => unknown) =>
        fetcher(b)) as never,
    );

    const builder = new ProductBuilder<Product>("https://lerochem.eu");
    builder.setBasicInfo(
      "ABS ACID (LABSA) 96%, L",
      "https://lerochem.eu/en/pagrindinis/126-abs-acid-labsa-96-l.html",
      "LeroChem",
    );

    const result = await supplier.getProductData(builder as unknown as ProductBuilder<Product>);

    expect(result).toBe(builder);
    const dump = builder.dump();
    expect(dump.sku).toBe("126");
    expect(dump.price).toBe(5.2);
    expect(dump.currencyCode).toBe("EUR");
    expect(dump.currencySymbol).toBe("€");
    expect(dump.availability).toBe("preorder");
    expect(dump.quantity).toBe(1);
    expect(dump.uom?.toLowerCase()).toBe(parseQuantity("1 L")?.uom?.toLowerCase());
    expect(dump.cas).toBe("27176-87-0");
    expect(dump.formula).toBe("C₁₈H₂₉NaO₃S");
    expect(dump.iupacName).toBe("Dodecylbenzenesulphonic acid");
    expect(dump.moleweight).toBe(326.49);
    // Purity is pulled from the product name ("… 96%, L").
    expect(dump.purity).toBe("96%");
    expect(dump.coaUrl).toBe("https://lerochem.eu/img/cms/EN%20COA/COA%20ABS%20Acid.pdf");
    expect(dump.sdsUrl).toBe(
      "https://lerochem.eu/img/cms/PARSISIUNTIMAI/DECLARATION%20ABS%20Acid.pdf",
    );
    expect(dump.variants).toHaveLength(2);
    expect(dump.variants?.map((v) => v.price)).toEqual([5.2, 22]);
    // The finished product must clear build()'s validation gate (which requires
    // currencySymbol) or it would be silently dropped.
    expect(isMinimalProduct(dump)).toBe(true);
  });
});
