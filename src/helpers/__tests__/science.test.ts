import { describe, expect, it } from "vitest";
import { findFormulaInHtml, parseChemicalSpecs, parsePurity, subscript, superscript } from "../science";

describe("science helpers", () => {
  describe("subscript", () => {
    it("should convert numbers to subscript characters", () => {
      expect(subscript("H2O")).toBe("H₂O");
      expect(subscript("CO2")).toBe("CO₂");
      expect(subscript("Fe3O4")).toBe("Fe₃O₄");
    });

    it("should only convert numbers and leave other characters unchanged", () => {
      expect(subscript("ABC123xyz")).toBe("ABC₁₂₃xyz");
      expect(subscript("Test 456")).toBe("Test ₄₅₆");
    });

    it("should handle empty string", () => {
      expect(subscript("")).toBe("");
    });

    it("should handle string without numbers", () => {
      expect(subscript("ABC")).toBe("ABC");
    });
  });

  describe("superscript", () => {
    it("should convert all numbers to superscript characters", () => {
      expect(superscript("10")).toBe("¹⁰");
      expect(superscript("23")).toBe("²³");
      expect(superscript("54")).toBe("⁵⁴");
    });

    it("should convert numbers in expressions without considering notation", () => {
      expect(superscript("10^2")).toBe("¹⁰^²");
      expect(superscript("2^3")).toBe("²^³");
    });

    it("should only convert numbers and leave other characters unchanged", () => {
      expect(superscript("ABC123xyz")).toBe("ABC¹²³xyz");
      expect(superscript("Test 456")).toBe("Test ⁴⁵⁶");
    });

    it("should handle empty string", () => {
      expect(superscript("")).toBe("");
    });

    it("should handle string without numbers", () => {
      expect(superscript("ABC")).toBe("ABC");
    });
  });

  describe("findFormulaInHtml", () => {
    it("should find and format simple chemical formulas", () => {
      expect(findFormulaInHtml("H<sub>2</sub>O")).toBe("H₂O");
      expect(findFormulaInHtml("CO<sub>2</sub>")).toBe("CO₂");
    });

    it("should find and format complex chemical formulas", () => {
      expect(findFormulaInHtml("K<sub>2</sub>Cr<sub>2</sub>O<sub>7</sub>")).toBe("K₂Cr₂O₇");
      expect(findFormulaInHtml("Fe<sub>2</sub>O<sub>3</sub>")).toBe("Fe₂O₃");
    });

    it("should handle formulas with surrounding text", () => {
      expect(findFormulaInHtml("The formula is H<sub>2</sub>SO<sub>4</sub> in water")).toBe(
        "H₂SO₄",
      );
      expect(findFormulaInHtml("foobar K<sub>2</sub>Cr<sub>2</sub>O<sub>7</sub> baz")).toBe(
        "K₂Cr₂O₇",
      );
    });

    it("should return undefined for invalid chemical formulas", () => {
      expect(findFormulaInHtml("Not a formula")).toBeUndefined();
      expect(findFormulaInHtml("Hx2O because there is no Hx element")).toBeUndefined();
      expect(findFormulaInHtml("")).toBeUndefined();
    });

    it("should handle formulas with two-letter elements", () => {
      expect(findFormulaInHtml("Na<sub>2</sub>SO<sub>4</sub>")).toBe("Na₂SO₄");
      expect(findFormulaInHtml("Ca<sub>3</sub>PO<sub>4</sub>")).toBe("Ca₃PO₄");
    });

    it("should require at least two element-number combinations", () => {
      expect(findFormulaInHtml("Na<sub>2</sub>")).toBeUndefined();
      expect(findFormulaInHtml("H<sub>2</sub>")).toBeUndefined();
    });

    it("should handle formulas with superscripts", () => {
      expect(findFormulaInHtml("Fe<sup>2</sup>O<sub>3</sub>")).toBe("Fe²O₃");
      expect(findFormulaInHtml("Cu<sup>2</sup>SO<sub>4</sub>")).toBe("Cu²SO₄");
    });
    it("should return undefined when given non-existent elements in formula", () => {
      expect(findFormulaInHtml("Fx<sup>2</sup>Hp<sub>3</sub>")).toBeUndefined();
      expect(findFormulaInHtml("Cq<sup>6</sup>SD<sub>4</sub>")).toBeUndefined();
    });
  });

  describe("parsePurity", () => {
    it("should parse a plain percentage", () => {
      expect(parsePurity("95%")).toBe(95);
      expect(parsePurity("100%")).toBe(100);
    });

    it("should parse a percentage embedded in a product name", () => {
      expect(parsePurity("Sodium borohydride, min 95%")).toBe(95);
      expect(parsePurity("Acetone 99.9% ACS grade")).toBe(99.9);
    });

    it("should parse decimal percentages", () => {
      expect(parsePurity("98.5%")).toBe(98.5);
    });

    it("should tolerate whitespace before the percent sign", () => {
      expect(parsePurity("min 95 %")).toBe(95);
    });

    it("should return nothing when there is no percentage", () => {
      expect(parsePurity("Sodium borohydride")).toBeUndefined();
      expect(parsePurity("")).toBeUndefined();
    });

    it("should return nothing for out-of-range percentages", () => {
      expect(parsePurity("120%")).toBeUndefined();
      expect(parsePurity("0%")).toBeUndefined();
    });
  });

  describe("parseChemicalSpecs", () => {
    it("should parse BioFuran-style <p>-delimited specs from a description", () => {
      const html =
        "<p>Appearance: colorless powder</p><p>CAS: 19455-21-1</p><p>Purity: 98%+</p>" +
        "<p>Formula: C5H9KO2</p><p>MW: 140.22g/mol</p><p>SMILES: [K+].CCCCC([O-])=O</p>";
      expect(parseChemicalSpecs(html)).toEqual({
        purity: 98,
        formula: "C5H9KO2",
        molecularWeight: 140.22,
        smiles: "[K+].CCCCC([O-])=O",
      });
    });

    it("should parse BioFuran-style <br>-delimited bullets with 'Molecular mass'", () => {
      const html =
        "<p>White powder<br>•&nbsp;&nbsp; Purity : 99-100%<br>•&nbsp;&nbsp; CAS : 127-08-2" +
        "<br>•&nbsp;&nbsp; Molecular formula : C2H3KO2<br>•&nbsp;&nbsp; Molecular mass : 98.14g/mol" +
        "<br>•&nbsp;&nbsp; Mp : 288 - 296°C</p>";
      expect(parseChemicalSpecs(html)).toEqual({
        purity: 100,
        formula: "C2H3KO2",
        molecularWeight: 98.14,
      });
    });

    it("should parse FTF-style <li> bullets with 'MW -' and '+%' purity", () => {
      const html =
        "<ul><li>Purity - 99+%</li><li>MW - 136.169 G/MOL</li>" +
        "<li>Melting point - 197 Celsius</li><li>CAS No - 7646-93-7</li></ul>";
      expect(parseChemicalSpecs(html)).toEqual({ purity: 99, molecularWeight: 136.169 });
    });

    it("should ignore percentages that are not purity", () => {
      const html = "<p>50% brine deicing agent; pH 6.5</p>";
      expect(parseChemicalSpecs(html)).toEqual({});
    });

    it("should not mistake melting point ('Mp') for molecular weight", () => {
      expect(parseChemicalSpecs("<p>Mp : 288 - 296°C</p>")).toEqual({});
    });

    it("should reject an implausible SMILES value", () => {
      expect(parseChemicalSpecs("<p>SMILES: water</p>")).toEqual({});
    });

    it("should return an empty object for non-spec copy", () => {
      expect(parseChemicalSpecs("<p>Ships in 4-6 business days</p>")).toEqual({});
      expect(parseChemicalSpecs("")).toEqual({});
    });
  });
});
