import { findFormulaInHtml, subscript, superscript } from "../science";

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
});
