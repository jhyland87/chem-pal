// ProductBuilder is imported first to satisfy the supplier module-init cycle that the
// transitive typeGuards import can otherwise trip.
import { ProductBuilder } from "@/utils/ProductBuilder";
import { findCAS } from "@/helpers/cas";
import { findMolarity, parseChemicalSpecs } from "@/helpers/science";
import { describe, expect, it } from "vitest";

/**
 * Synthetika descriptions carry the same fields in wildly different markup — labels in
 * <strong> with the colon inside or outside, in styled <span>s, or in plain text, and
 * formulas written with unicode subscript glyphs. These are trimmed real-response snippets
 * asserting the tolerant helpers the supplier now uses extract specs from each shape.
 */
const extract = (description: string, name = "") => ({
  cas: findCAS(description) ?? undefined,
  formula: parseChemicalSpecs(description).formula,
  moleweight: parseChemicalSpecs(description).molecularWeight,
  concentration: findMolarity(name) ?? findMolarity(description),
});

describe("Synthetika description spec extraction", () => {
  it("parses styled <span> fields (no <strong>)", () => {
    const html =
      '<p><span style="font-weight: 400;">CAS Number: 137-40-6</span>' +
      '<span style="font-weight: 400;"><br /></span>' +
      '<span style="font-weight: 400;">Sum Formula: C3H5NaO2</span>' +
      '<span style="font-weight: 400;"><br /></span>' +
      '<span style="font-weight: 400;">Molar Mass: 96.06 g/mol</span></p>';
    expect(extract(html)).toMatchObject({ cas: "137-40-6", formula: "C3H5NaO2", moleweight: 96.06 });
  });

  it("parses plain-text fields with unicode-subscript formulas", () => {
    const html =
      '<p>CAS Number: 6132-04-3<br /> Sum Formula: C₆H₅Na₃O₇<br /> Molar Mass: 258.06 g/mol</p>';
    expect(extract(html)).toMatchObject({
      cas: "6132-04-3",
      formula: "C6H5Na3O7",
      moleweight: 258.06,
    });
  });

  it("parses <strong> labels with the colon outside and a 'Chemical Formula' synonym", () => {
    const html =
      "<p><strong>CAS Number</strong>: 127-09-3<br />" +
      "<strong>Chemical Formula</strong>: CH₃COONa<br />" +
      "<strong>Molar Mass</strong>: 82.03 g/mol</p>";
    expect(extract(html)).toMatchObject({ cas: "127-09-3", formula: "CH3COONa", moleweight: 82.03 });
  });

  it("parses <strong> labels with the colon inside (Sum Formula + hydrate)", () => {
    const html =
      "<p><strong>CAS Number:</strong> 6155-57-3<br />" +
      "<strong>Sum Formula:</strong> C₇H₄NNaO₃S · 2H₂O<br />" +
      "<strong>Molar Mass:</strong> 241.19 g/mol</p>";
    expect(extract(html)).toMatchObject({
      cas: "6155-57-3",
      formula: "C7H4NNaO3S",
      moleweight: 241.19,
    });
  });

  it("captures a polymer repeating-unit formula (parenthetical label + (…)ₙ value)", () => {
    const html =
      "<p><strong>Other Names</strong>: Superabsorbent polymer (SAP)<br />" +
      "<strong>Chemical Formula (Repeating Unit)</strong>: (C₃H₃NaO₂)ₙ<br />" +
      "<strong>CAS Number</strong>: 9003-04-7</p>";
    expect(extract(html)).toMatchObject({ cas: "9003-04-7", formula: "(C3H3NaO2)ₙ" });
  });

  it("stores the polymer repeat-unit formula through ProductBuilder.setFormula", () => {
    // The parsed formula must survive setFormula (which re-validates); the repeat-unit index glyph
    // ₙ marks it as an already-formatted formula rather than something to re-parse or reject.
    const builder = new ProductBuilder<Product>("https://synthetikaeu.com");
    builder.setFormula("(C3H3NaO2)ₙ");
    expect(builder.get("formula")).toBe("(C3H3NaO2)ₙ");
  });

  it("captures molarity from a solution name", () => {
    expect(extract("<p>CAS Number: 7647-01-0</p>", "Hydrochloric Acid 1.5M Solution")).toMatchObject(
      { concentration: "1.5 M" },
    );
  });
});
