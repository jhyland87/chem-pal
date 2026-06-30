import { describe, expect, it } from "vitest";
import {
  findFormulaInHtml,
  parseChemicalSpecs,
  parseGrade,
  parsePurity,
  subscript,
  superscript,
} from "../science";

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

    it("should match a single element that carries a tagged subscript", () => {
      expect(findFormulaInHtml("H<sub>2</sub>")).toBe("H₂");
      expect(findFormulaInHtml("Na<sub>2</sub>")).toBe("Na₂");
    });

    it("should still reject a bare element or an untagged single-element token", () => {
      // No subscript at all, or only an inline digit, isn't enough for a single element.
      expect(findFormulaInHtml("Na")).toBeUndefined();
      expect(findFormulaInHtml("vitamin B12 supplement")).toBeUndefined();
    });

    it("should handle multi-digit subscripts (10 and above)", () => {
      expect(
        findFormulaInHtml(
          "C<sub>18</sub>H<sub>14</sub>N<sub>2</sub>Na<sub>2</sub>O<sub>8</sub>S<sub>2</sub>",
        ),
      ).toBe("C₁₈H₁₄N₂Na₂O₈S₂");
      expect(findFormulaInHtml("C<sub>12</sub>H<sub>22</sub>O<sub>11</sub>")).toBe("C₁₂H₂₂O₁₁");
    });

    it("should tolerate trailing markup after the formula", () => {
      expect(findFormulaInHtml("Summenformel: C<sub>10</sub>H<sub>16</sub>O</span>")).toBe(
        "C₁₀H₁₆O",
      );
    });

    it("should leave untagged inline numbers as regular digits (not subscript)", () => {
      // Inline atom/molecule counts are matched but never converted — only <sub>/<sup> are.
      expect(findFormulaInHtml("Compound NaCl2 here")).toBe("NaCl2");
    });

    it("should keep salt/hydrate components after a separator", () => {
      expect(findFormulaInHtml("C<sub>20</sub>H<sub>20</sub>FN<sub>6</sub>O<sub>5</sub>·K")).toBe(
        "C₂₀H₂₀FN₆O₅·K",
      );
      expect(findFormulaInHtml("C<sub>23</sub>H<sub>28</sub>ClN<sub>3</sub>O<sub>5</sub>S • K")).toBe(
        "C₂₃H₂₈ClN₃O₅S • K",
      );
    });

    it("should handle a separator with a leading coefficient (tagged or variable)", () => {
      // A <sub>-tagged coefficient denotes how many of the whole salt; it is still a subscript.
      expect(
        findFormulaInHtml("C<sub>4</sub>H<sub>8</sub>N<sub>3</sub>O<sub>5</sub>P • <sub>2</sub>K"),
      ).toBe("C₄H₈N₃O₅P • ₂K");
      // A variable hydrate coefficient (x/n) stays a regular letter.
      expect(findFormulaInHtml("C<sub>10</sub>H<sub>7</sub>KN<sub>6</sub>O·xH<sub>2</sub>O")).toBe(
        "C₁₀H₇KN₆O·xH₂O",
      );
    });

    it("should handle parenthesised / bracketed groups", () => {
      expect(findFormulaInHtml("KN(C(O)CH<sub>2</sub>)<sub>2</sub>")).toBe("KN(C(O)CH₂)₂");
    });

    it("should handle a parenthesised group with a multi-digit hydrate coefficient", () => {
      expect(findFormulaInHtml("AlK(SO<sub>4</sub>)<sub>2</sub>·12H<sub>2</sub>O")).toBe(
        "AlK(SO₄)₂·12H₂O",
      );
    });

    it("should keep a tight '.' separator and ionic charge signs", () => {
      expect(findFormulaInHtml("C<sub>3</sub>H<sub>2</sub>N<sub>2</sub>O<sub>3</sub>.K")).toBe(
        "C₃H₂N₂O₃.K",
      );
      expect(findFormulaInHtml("CHBF<sub>5</sub>-.K+")).toBe("CHBF₅-.K+");
      expect(findFormulaInHtml("C<sub>8</sub>H<sub>13</sub>BO<sub>2</sub>F<sub>3</sub>-.K+")).toBe(
        "C₈H₁₃BO₂F₃-.K+",
      );
    });

    it("should keep a fractional hydrate coefficient", () => {
      expect(findFormulaInHtml("K<sub>2</sub>CO<sub>3</sub>·3/2H<sub>2</sub>O")).toBe(
        "K₂CO₃·3/2H₂O",
      );
      expect(
        findFormulaInHtml("C<sub>4</sub>H<sub>4</sub>O<sub>6</sub>K<sub>2</sub>·1/2H<sub>2</sub>O"),
      ).toBe("C₄H₄O₆K₂·1/2H₂O");
    });

    it("should not treat sentence periods or decimals as a separator", () => {
      // "." only separates when immediately followed by a component, so prose/decimals are safe.
      expect(findFormulaInHtml("Contains H<sub>2</sub>O. The product is pure.")).toBe("H₂O");
      expect(findFormulaInHtml("density 1.5 only")).toBeUndefined();
    });

    it("should handle formulas with superscripts", () => {
      expect(findFormulaInHtml("Fe<sup>2</sup>O<sub>3</sub>")).toBe("Fe²O₃");
      expect(findFormulaInHtml("Cu<sup>2</sup>SO<sub>4</sub>")).toBe("Cu²SO₄");
    });
    it("should return undefined when given non-existent elements in formula", () => {
      expect(findFormulaInHtml("Fx<sup>2</sup>Hp<sub>3</sub>")).toBeUndefined();
      expect(findFormulaInHtml("Cq<sup>6</sup>SD<sub>4</sub>")).toBeUndefined();
    });

    it("should extract a formula nested inside other HTML elements", () => {
      const html =
        '<P STYLE="margin:0 0 0 0;font-family:Arial;font-size:10pt;">' +
        '<SPAN STYLE="color:#000000;">Summenformel: ' +
        "C<sub>18</sub>H<sub>14</sub>N<sub>2</sub>Na<sub>2</sub>O<sub>8</sub>S<sub>2</sub></SPAN></P>";
      expect(findFormulaInHtml(html)).toBe("C₁₈H₁₄N₂Na₂O₈S₂");
    });

    it("should not match element-like sequences inside HTML tags", () => {
      // Tag names and attributes look element-ish ("P", "SPAN", "STYLE" -> S,T,Y,L,E,
      // "Arial" -> Ar, "color" -> Co) but live inside tags, so they must be ignored.
      expect(
        findFormulaInHtml('<P STYLE="font-family:Arial;"><SPAN STYLE="color:#000000;"></SPAN></P>'),
      ).toBeUndefined();
      // The real formula is still found even though "STYLE"/"SPAN" precede it inside tags.
      expect(
        findFormulaInHtml('<SPAN STYLE="color:#000000;">CO<sub>2</sub></SPAN>'),
      ).toBe("CO₂");
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

    it("should ignore a leading qualifier like ≥", () => {
      expect(parsePurity("Hydroquinone ≥99.8%, extra pure")).toBe(99.8);
      expect(parsePurity("Sodium bicarbonate ≥99 %, Ph.Eur.")).toBe(99);
    });

    it("should parse a trailing 'or better' plus", () => {
      expect(parsePurity("Lithium Carbonate 99+% Extra Pure")).toBe(99);
      expect(parsePurity("Potassium Sulphate 99 +%, Foodgrade")).toBe(99);
      expect(parsePurity("Sodium carbonate 99.7 +%, pure")).toBe(99.7);
    });

    it("should parse a European comma decimal", () => {
      expect(parsePurity("Potassium hydrogen tartrate ≥99,5 %")).toBe(99.5);
      expect(parsePurity("Sodium acetate trihydrate 99,5+% pure")).toBe(99.5);
    });

    it("should not read a non-percentage code (E515) as purity", () => {
      expect(parsePurity("Potassium Sulphate 99 +%, Ph. Eur, E515")).toBe(99);
      expect(parsePurity("Food Grade, FCC, E500i")).toBeUndefined();
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

  describe("parseGrade", () => {
    it("should parse standalone grade abbreviations", () => {
      expect(parseGrade("Sodium sulfate AR")).toBe("AR");
      expect(parseGrade("Acetonitrile HPLC - 1 L")).toBe("HPLC");
      expect(parseGrade("Citric acid USP")).toBe("USP");
      expect(parseGrade("Magnesium stearate NF")).toBe("NF");
      expect(parseGrade("Sodium bicarbonate FCC")).toBe("FCC");
    });

    it("should parse word grades case-insensitively", () => {
      expect(parseGrade("SODIUM CHLORITE, 80% TECHNICAL - 2.5 KG")).toBe("Technical");
      expect(parseGrade("sodium chloride reagent grade")).toBe("Reagent");
    });

    it("should prefer the specific standard when several are present", () => {
      expect(parseGrade("SODIUM, REAGENT (ACS) - 500 G")).toBe("ACS");
      expect(parseGrade("Citric acid, BP/USP")).toBe("USP");
    });

    it("should accept spelled-out pharmacopoeia names", () => {
      expect(parseGrade("Caffeine, British Pharmacopoeia")).toBe("BP");
      expect(parseGrade("Glucose, Japanese Pharmacopeia")).toBe("JP");
    });

    it("should return nothing when no grade is present", () => {
      expect(parseGrade("SODIUM NITRATE, 99.999% - 50 G")).toBeUndefined();
      expect(parseGrade("")).toBeUndefined();
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
