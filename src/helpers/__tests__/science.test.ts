import { describe, expect, it } from "vitest";
import {
  findFormulaInHtml,
  findFormulaInText,
  findMolarity,
  findMolarMass,
  formatFormula,
  parseChemicalSpecs,
  parseGrade,
  parsePurity,
  subscript,
  subscriptGlyph,
  superscript,
  superscriptGlyph,
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

  describe("subscriptGlyph", () => {
    it("should leave existing subscript glyphs unchanged", () => {
      expect(subscriptGlyph("H₂O")).toBe("H₂O");
      expect(subscriptGlyph("C₆H₁₂O₆")).toBe("C₆H₁₂O₆");
    });

    it("should not convert ASCII digits (that is subscript's job)", () => {
      expect(subscriptGlyph("H2O")).toBe("H2O");
      expect(subscriptGlyph("123")).toBe("123");
    });

    it("should handle empty string", () => {
      expect(subscriptGlyph("")).toBe("");
    });
  });

  describe("superscriptGlyph", () => {
    it("should leave existing superscript glyphs unchanged", () => {
      expect(superscriptGlyph("x²")).toBe("x²");
      expect(superscriptGlyph("10⁻³")).toBe("10⁻³");
    });

    it("should not convert ASCII digits (that is superscript's job)", () => {
      expect(superscriptGlyph("x2")).toBe("x2");
      expect(superscriptGlyph("123")).toBe("123");
    });

    it("should handle empty string", () => {
      expect(superscriptGlyph("")).toBe("");
    });
  });

  describe("formatFormula", () => {
    it("subscripts atom counts in a simple formula", () => {
      expect(formatFormula("C6H15NO3")).toBe("C₆H₁₅NO₃");
      expect(formatFormula("H2O")).toBe("H₂O");
      expect(formatFormula("C12H22O11")).toBe("C₁₂H₂₂O₁₁");
    });

    it("turns a period into an adduct dot for a salt with no coefficient", () => {
      expect(formatFormula("C6H15NO3.H3PO4")).toBe("C₆H₁₅NO₃⋅H₃PO₄");
    });

    it("keeps a leading hydrate/adduct coefficient full-size", () => {
      expect(formatFormula("C6H15NO3.5H3PO4")).toBe("C₆H₁₅NO₃⋅5H₃PO₄");
      expect(formatFormula("CuSO4.5H2O")).toBe("CuSO₄⋅5H₂O");
    });

    it("subscripts digits after closing brackets but not full-size groups", () => {
      expect(formatFormula("Ca3(PO4)2")).toBe("Ca₃(PO₄)₂");
      expect(formatFormula("KN(C(O)CH2)2")).toBe("KN(C(O)CH₂)₂");
    });

    it("leaves formulas without atom-count digits unchanged", () => {
      expect(formatFormula("NaOH")).toBe("NaOH");
      expect(formatFormula("KBr")).toBe("KBr");
    });

    it("handles an empty string", () => {
      expect(formatFormula("")).toBe("");
    });
  });

  describe("findFormulaInText", () => {
    it("should return unicode-glyph formulas unchanged", () => {
      expect(findFormulaInText("C₂₄H₂₀KN₅O₅S")).toBe("C₂₄H₂₀KN₅O₅S");
      expect(findFormulaInText("K₂SO₄")).toBe("K₂SO₄");
    });

    it("should find a glyph formula embedded in surrounding text", () => {
      expect(findFormulaInText("Here is a chemical formula: C₁₆H₃₃KO₂")).toBe("C₁₆H₃₃KO₂");
    });

    it("should convert <sub>/<sup> tags to unicode glyphs", () => {
      expect(findFormulaInText("K<sub>2</sub>SO<sub>4</sub>")).toBe("K₂SO₄");
      expect(findFormulaInText("Fe<sup>2</sup>O<sub>3</sub>")).toBe("Fe²O₃");
    });

    it("should convert multi-digit tagged subscripts", () => {
      expect(findFormulaInText("C<sub>16</sub>H<sub>33</sub>KO<sub>2</sub>")).toBe("C₁₆H₃₃KO₂");
    });

    it("should handle a tagged salt coefficient after a separator", () => {
      expect(
        findFormulaInText(
          "C<sub>33</sub>H<sub>25</sub>N<sub>3</sub>O<sub>12</sub>S • <sub>4</sub>K",
        ),
      ).toBe("C₃₃H₂₅N₃O₁₂S • ₄K");
    });

    it("should keep salt/hydrate components and variable coefficients", () => {
      expect(findFormulaInText("C₂₀H₂₀FN₆O₅·K")).toBe("C₂₀H₂₀FN₆O₅·K");
      expect(findFormulaInText("Here is a chemical formula: C₁₀H₇KN₆O·xH₂O")).toBe(
        "C₁₀H₇KN₆O·xH₂O",
      );
    });

    it("should keep a fractional hydrate coefficient", () => {
      expect(findFormulaInText("K₂CO₃·3/2H₂O")).toBe("K₂CO₃·3/2H₂O");
    });

    it("should handle parenthesised / bracketed groups", () => {
      expect(findFormulaInText("KN(C(O)CH₂)₂")).toBe("KN(C(O)CH₂)₂");
      expect(findFormulaInText("AlK(SO₄)₂·12H₂O")).toBe("AlK(SO₄)₂·12H₂O");
    });

    it("should keep tight '.'/'*' separators and ionic charge signs", () => {
      expect(findFormulaInText("C₃H₂N₂O₃.K")).toBe("C₃H₂N₂O₃.K");
      expect(findFormulaInText("C₈H₁₃BO₂F₃-.K+")).toBe("C₈H₁₃BO₂F₃-.K+");
      expect(findFormulaInText("C₉H₁₃O₄*K")).toBe("C₉H₁₃O₄*K");
    });

    it("should match a formula written with HTML entities but leave them verbatim", () => {
      // Entities gate the match, but only <sub>/<sup> tags are rewritten — entities pass through.
      expect(findFormulaInText("H&#8322;O")).toBe("H&#8322;O");
      expect(findFormulaInText("H&#x2082;O")).toBe("H&#x2082;O");
    });

    it("should match a clean multi-element formula like KBr", () => {
      // Two element units (K + Br) clear the gate, so a subscript-free salt is still matched.
      expect(findFormulaInText("KBr")).toBe("KBr");
    });

    it("should match a lone element when it is the entire input", () => {
      expect(findFormulaInText("Na")).toBe("Na");
      expect(findFormulaInText("  K+  ")).toBe("K+");
    });

    it("should pull a lone element out of prose", () => {
      // "Na" lives inside "Nature", and "I" is a word — neither is the whole input, so both reject.
      expect(findFormulaInText("I love Nature")).toBe("I");
      expect(findFormulaInText("Just some text")).toBeUndefined();
      expect(findFormulaInText("vitamin B12 supplement")).toBe("B12");
      expect(findFormulaInText("")).toBeUndefined();
    });

    it("should return the most likely formula when several substrings match", () => {
      // "EINECS" yields "IN" and "CS"; the real formula "NaOSOCH3" should win.
      const input =
        "Methanesulfinic acid sodium salt | A814374 | EINECS 243-669-6 | STR02097 | " +
        "AC-1087 | Methanesulfinic acid, sodium salt (1:1) | NaOSOCH3 |";
      expect(findFormulaInText(input)).toBe("NaOSOCH3");
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

    it("should match a bare element or an untagged single-element token", () => {
      // No subscript at all, or only an inline digit, isn't enough for a single element.
      expect(findFormulaInHtml("Na")).toBe("Na");
      expect(findFormulaInHtml("vitamin B12 supplement")).toBe("B12");
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
      expect(
        findFormulaInHtml("C<sub>23</sub>H<sub>28</sub>ClN<sub>3</sub>O<sub>5</sub>S • K"),
      ).toBe("C₂₃H₂₈ClN₃O₅S • K");
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
      expect(findFormulaInHtml('<SPAN STYLE="color:#000000;">CO<sub>2</sub></SPAN>')).toBe("CO₂");
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

  describe("findMolarMass", () => {
    it("parses a European comma-decimal value with a parenthetical label", () => {
      expect(findMolarMass("Molar mass (M) 149,19 g/mol")).toBe(149.19);
    });

    it("finds the molar mass buried in a larger block of text", () => {
      const text =
        "Empirical formula C6H15NO3\nMolar mass (M) 149,19 g/mol\nDensity (D) ca. 1,12\nCAS No.[102-71-6]";
      expect(findMolarMass(text)).toBe(149.19);
    });

    it("handles the common label and unit spellings", () => {
      expect(findMolarMass("MW: 140.22g/mol")).toBe(140.22);
      expect(findMolarMass("MW - 136.169 G/MOL")).toBe(136.169);
      expect(findMolarMass("Molecular mass : 98.14 g/mol")).toBe(98.14);
      expect(findMolarMass("Molecular Weight (MW): 254,32 g·mol⁻¹")).toBe(254.32);
      expect(findMolarMass("formula weight 100.2 g/mole")).toBe(100.2);
      expect(findMolarMass("molar mass 18 g mol-1")).toBe(18);
      expect(findMolarMass("58.44 Da")).toBe(58.44);
    });

    it("falls back to a labelled value with no unit", () => {
      expect(findMolarMass("M.W. 415.6")).toBe(415.6);
      expect(findMolarMass("Mr = 342.30")).toBe(342.3);
    });

    it("recognizes a bare 'mol :' label (LaboratoriumDiscounter catalog)", () => {
      expect(findMolarMass("CAS : 10017-56-8\nFormula : C6H15NO3.H3PO4\nmol : 247.18")).toBe(
        247.18,
      );
      expect(findMolarMass("mol = 156.98")).toBe(156.98);
    });

    it("does not treat the 'mol' in a g/mol unit as a bare label", () => {
      // No colon/equals after "mol", so the bare-mol label must not fire on the unit itself.
      expect(findMolarMass("dose is 5 moles per litre")).toBeUndefined();
    });

    it("disambiguates thousands vs decimal separators in both conventions", () => {
      expect(findMolarMass("1.234,56 g/mol")).toBe(1234.56);
      expect(findMolarMass("1,234.56 g/mol")).toBe(1234.56);
    });

    it("does not mistake unrelated numbers for a molar mass", () => {
      expect(findMolarMass("Mp : 288 - 296°C")).toBeUndefined();
      expect(findMolarMass("Density (D) ca. 1,12")).toBeUndefined();
      expect(findMolarMass("Ships in 4-6 business days")).toBeUndefined();
      expect(findMolarMass("")).toBeUndefined();
    });
  });

  describe("findMolarity", () => {
    it("pulls molarity out of the Searchanise title/description examples", () => {
      expect(
        findMolarity(
          "Briggs-Rauscher oscillating-reaction demo kit with 12% hydrogen peroxide, 0.2M potassium iodate",
        ),
      ).toBe("0.2 M");
      expect(findMolarity("Potassium Nitrate: EZ-Prep - Makes 150ml of 1.5M Solution")).toBe(
        "1.5 M",
      );
      expect(findMolarity("Potassium Iodide Solution, 1M, 500mL")).toBe("1 M");
    });

    it("handles the mol/L unit and a range", () => {
      expect(findMolarity("Buffer 1.5 mol/L stock")).toBe("1.5 mol/L");
      expect(findMolarity("Range 1-2 M working solution")).toBe("1-2 M");
      expect(findMolarity("titrant 0.1 to 0.5 M")).toBe("0.1-0.5 M");
    });

    it("requires a capital M so a lowercase 'm' (milli) never matches", () => {
      expect(findMolarity("Makes 150ml total")).toBeUndefined();
      expect(findMolarity("MAKES 150ML")).toBeUndefined();
      expect(findMolarity("500mL bottle")).toBeUndefined();
    });

    it("does not mistake a molar mass or unrelated text for molarity", () => {
      expect(findMolarity("Molar mass 149 g/mol")).toBeUndefined();
      expect(findMolarity("Sodium chloride, 500 g")).toBeUndefined();
      expect(findMolarity("")).toBeUndefined();
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

    it("should keep subscripted formulas intact instead of stopping at the first element", () => {
      // LaboratoriumDiscounter renders the formula with <sub> tags; stripping them to whitespace
      // used to split "C6H15NO3" into "C 6 H 15 NO 3", leaving the parser with just "C".
      const html =
        "<p>Empirical formula C<sub>6</sub>H<sub>15</sub>NO<sub>3</sub><br />" +
        "Molar mass (M) 149,19 g/mol</p>";
      expect(parseChemicalSpecs(html).formula).toBe("C6H15NO3");
    });

    it("should normalize unicode subscript glyphs so the whole formula is captured", () => {
      // Synthetika renders formulas with real subscript characters (₆₅₃₇); without normalization
      // FORMULA_REGEX stops at the first glyph and returns just "C".
      const html =
        "<p>CAS Number: 6132-04-3<br>Sum Formula: C₆H₅Na₃O₇<br>Molar Mass: 258.06 g/mol</p>";
      expect(parseChemicalSpecs(html)).toEqual({
        formula: "C6H5Na3O7",
        molecularWeight: 258.06,
      });
    });

    it("should capture a polymer repeating unit under a parenthetical-qualified label", () => {
      // Synthetika's Sodium Polyacrylate: the label carries "(Repeating Unit)" and the value is a
      // parenthesized repeat unit with a trailing variable subscript.
      const html = "<p><strong>Chemical Formula (Repeating Unit)</strong>: (C₃H₃NaO₂)ₙ</p>";
      expect(parseChemicalSpecs(html).formula).toBe("(C3H3NaO2)ₙ");
    });

    it("should parse a dot-joined salt formula and a bare 'mol :' molar mass", () => {
      const html =
        "CAS : 10017-56-8<br>Formula : C6H15NO3.H3PO4<br>mol : 247.18<br>Melting point : 106°C";
      expect(parseChemicalSpecs(html)).toEqual({
        formula: "C6H15NO3.H3PO4",
        molecularWeight: 247.18,
      });
    });

    it("should skip a shadowing 'formula is X' phrase and use the real Empirical formula", () => {
      const html =
        "<p>The rough formula is C6H15NO3.</p>" +
        "<p>Empirical formula C6H15NO3<br />Molar mass (M) 149,19 g/mol</p>";
      expect(parseChemicalSpecs(html)).toEqual({
        formula: "C6H15NO3",
        molecularWeight: 149.19,
      });
    });

    it("should capture a single-element formula that follows a label", () => {
      expect(
        parseChemicalSpecs("<p>Empirical formula Na<br />Molar mass (M) 22.99 g/mol</p>"),
      ).toEqual({ formula: "Na", molecularWeight: 22.99 });
      expect(parseChemicalSpecs("<p>Formula: K</p>")).toEqual({ formula: "K" });
    });

    it("should not pull a bare element out of surrounding prose (no formula label)", () => {
      expect(
        parseChemicalSpecs("<p>Sodium hydroxide is great. Potassium too. Contains Na and K.</p>"),
      ).toEqual({});
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
