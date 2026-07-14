import { createDOM } from "@/helpers/request";
import {
  SchemaOrgData,
  isSchemaContext,
  stripSchemaEnumPrefix,
  toArray,
  typeList,
} from "@/helpers/schema-org";
import { describe, expect, it } from "vitest";

const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "LEROCHEM",
  url: "https://lerochem.eu/en/",
};

const BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://lerochem.eu/en/" },
    { "@type": "ListItem", position: 2, name: "POTASSIUM HYDROXIDE 90%, kg", item: "…/40.html" },
  ],
};

const PRODUCT = {
  "@context": "https://schema.org/",
  "@type": "Product",
  name: "POTASSIUM HYDROXIDE 90%, kg",
  sku: "CHEM027",
  mpn: "CHEM027",
  image: "https://lerochem.eu/1706-home_default/potassium-hydroxide-90-kg.jpg",
  offers: {
    "@type": "Offer",
    priceCurrency: "EUR",
    price: "5.8",
    availability: "https://schema.org/PreOrder",
    image: ["https://lerochem.eu/1706-large_default/potassium-hydroxide-90-kg.jpg"],
  },
};

const htmlOf = (...nodes: object[]) =>
  nodes
    .map((n) => `<script type="application/ld+json">${JSON.stringify(n)}</script>`)
    .join("\n");

describe("schema-org toArray", () => {
  it("wraps a single value, passes arrays through, and empties nullish", () => {
    expect(toArray("a.jpg")).toEqual(["a.jpg"]);
    expect(toArray(["a.jpg", "b.jpg"])).toEqual(["a.jpg", "b.jpg"]);
    expect(toArray(undefined)).toEqual([]);
    expect(toArray(null)).toEqual([]);
  });
});

describe("schema-org typeList", () => {
  it("reads @type as a string array", () => {
    expect(typeList({ "@type": "Product" })).toEqual(["Product"]);
    expect(typeList({ "@type": ["Book", "Product"] })).toEqual(["Book", "Product"]);
    expect(typeList({ name: "untyped" })).toEqual([]);
  });
});

describe("schema-org isSchemaContext", () => {
  it("accepts every schema.org context form and rejects others", () => {
    expect(isSchemaContext("https://schema.org")).toBe(true);
    expect(isSchemaContext("https://schema.org/")).toBe(true);
    expect(isSchemaContext("http://schema.org")).toBe(true);
    expect(isSchemaContext(["https://example.com", "https://schema.org"])).toBe(true);
    expect(isSchemaContext({ "@vocab": "https://schema.org/" })).toBe(true);
    expect(isSchemaContext("https://example.com")).toBe(false);
    expect(isSchemaContext(undefined)).toBe(false);
  });
});

describe("schema-org stripSchemaEnumPrefix", () => {
  it("strips a single schema.org enum segment and leaves other URLs alone", () => {
    expect(stripSchemaEnumPrefix("https://schema.org/PreOrder")).toBe("PreOrder");
    expect(stripSchemaEnumPrefix("http://schema.org/InStock")).toBe("InStock");
    // The bare context and off-site/multi-segment URLs are unchanged.
    expect(stripSchemaEnumPrefix("https://schema.org")).toBe("https://schema.org");
    expect(stripSchemaEnumPrefix("https://lerochem.eu/p/40.html")).toBe(
      "https://lerochem.eu/p/40.html",
    );
  });
});

describe("schema-org SchemaOrgData.fromDocument", () => {
  it("extracts schema.org nodes and queries the Product", () => {
    const dom = createDOM(htmlOf(ORGANIZATION, BREADCRUMB, PRODUCT));
    const data = SchemaOrgData.fromDocument(dom);

    expect(data.types()).toEqual(["Organization", "BreadcrumbList", "Product"]);
    expect(data.has("Product")).toBe(true);
    expect(data.has("Recipe")).toBe(false);
    expect(data.first("Product")?.sku).toBe("CHEM027");
    // The Offer is nested inside the Product, reachable via all().
    expect(data.all("Offer")[0]?.price).toBe("5.8");
    // Enum values are normalized: ".../PreOrder" -> "PreOrder".
    expect(data.all("Offer")[0]?.availability).toBe("PreOrder");
    expect(data.all("ListItem")).toHaveLength(2);
  });

  it("skips malformed JSON and non-schema.org contexts", () => {
    const html =
      '<script type="application/ld+json">{ not valid json }</script>' +
      '<script type="application/ld+json">{"@context":"https://example.com","@type":"Widget"}</script>' +
      htmlOf(PRODUCT);
    const data = SchemaOrgData.fromDocument(createDOM(html));

    expect(data.types()).toEqual(["Product"]);
  });
});

describe("schema-org SchemaOrgData.fromNodes", () => {
  it("builds from already-parsed objects", () => {
    const data = SchemaOrgData.fromNodes([ORGANIZATION, PRODUCT]);
    expect(data.get("Product")).toHaveLength(1);
    expect(data.first("Product")?.name).toBe("POTASSIUM HYDROXIDE 90%, kg");
  });

  it("flattens an @graph wrapper and inherits its context", () => {
    const graph: JsonObject = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Product", sku: "A" },
        { "@type": "Offer", price: "1" },
      ],
    };
    const data = SchemaOrgData.fromNodes(graph);
    expect(data.types()).toEqual(["Product", "Offer"]);
  });
});

describe("schema-org SchemaOrgData.all", () => {
  it("finds nested typed objects at any depth, optionally filtered", () => {
    const data = SchemaOrgData.fromNodes([PRODUCT]);
    expect(data.all("Offer")).toHaveLength(1);
    // Product + Offer are both typed objects.
    expect(data.all().length).toBeGreaterThanOrEqual(2);
  });
});

describe("schema-org SchemaOrgData.fromObject", () => {
  it("deep-scans an app-state blob for context-bearing nodes", () => {
    const pageState = { page: { widgets: [{ meta: PRODUCT }], breadcrumbs: BREADCRUMB } };
    const data = SchemaOrgData.fromObject(pageState);
    expect(data.types().sort()).toEqual(["BreadcrumbList", "Product"]);
    expect(data.first("Product")?.sku).toBe("CHEM027");
  });
});

describe("schema-org SchemaOrgData.toNested", () => {
  it("produces a type-keyed view", () => {
    const data = SchemaOrgData.fromNodes([BREADCRUMB, PRODUCT]);
    const nested = data.toNested();

    const product = nested.Product;
    expect(product).toMatchObject({ offers: { Offer: { price: "5.8" } } });

    const breadcrumb = nested.BreadcrumbList;
    expect(breadcrumb).toMatchObject({
      itemListElement: { ListItem: [{ name: "Home" }, { name: "POTASSIUM HYDROXIDE 90%, kg" }] },
    });
  });
});
