import { describe, expect, it, vi } from 'vitest';
import {
  findFormulaInHtml,
  findFormulaInText,
  findMolarity,
  findMolarMass,
  findPurity,
  formatFormula,
  isMoleForm,
  parseChemicalSpecs,
  parseGrade,
  parseLocalizedNumber,
  parsePurity,
  pickBroadestName,
  subscriptToAscii,
  purityGradeToPercentage,
  sortablePurityGrade,
  subscript,
  subscriptGlyph,
  superscript,
  superscriptGlyph,
} from '../science';
import gradeCorpus from './__fixtures__/grade-corpus.json';

describe('science helpers', () => {
  describe('subscript', () => {
    it('should convert numbers to subscript characters', () => {
      expect(subscript('H2O')).toBe('H₂O');
      expect(subscript('CO2')).toBe('CO₂');
      expect(subscript('Fe3O4')).toBe('Fe₃O₄');
    });

    it('should only convert numbers and leave other characters unchanged', () => {
      expect(subscript('ABC123xyz')).toBe('ABC₁₂₃xyz');
      expect(subscript('Test 456')).toBe('Test ₄₅₆');
    });

    it('should handle empty string', () => {
      expect(subscript('')).toBe('');
    });

    it('should handle string without numbers', () => {
      expect(subscript('ABC')).toBe('ABC');
    });
  });

  describe('subscriptToAscii', () => {
    it('converts subscript digits in a formula back to ASCII', () => {
      expect(subscriptToAscii('Na₆O₁₈P₆')).toBe('Na6O18P6');
      expect(subscriptToAscii('H₂O')).toBe('H2O');
      expect(subscriptToAscii('C₁₂H₂₂O₁₁')).toBe('C12H22O11');
    });

    it('leaves plain text and ASCII digits unchanged', () => {
      expect(subscriptToAscii('acetone')).toBe('acetone');
      expect(subscriptToAscii('Na6O18P6')).toBe('Na6O18P6');
      expect(subscriptToAscii('')).toBe('');
    });
  });

  describe('superscript', () => {
    it('should convert all numbers to superscript characters', () => {
      expect(superscript('10')).toBe('¹⁰');
      expect(superscript('23')).toBe('²³');
      expect(superscript('54')).toBe('⁵⁴');
    });

    it('should convert numbers in expressions without considering notation', () => {
      expect(superscript('10^2')).toBe('¹⁰^²');
      expect(superscript('2^3')).toBe('²^³');
    });

    it('should only convert numbers and leave other characters unchanged', () => {
      expect(superscript('ABC123xyz')).toBe('ABC¹²³xyz');
      expect(superscript('Test 456')).toBe('Test ⁴⁵⁶');
    });

    it('should handle empty string', () => {
      expect(superscript('')).toBe('');
    });

    it('should handle string without numbers', () => {
      expect(superscript('ABC')).toBe('ABC');
    });
  });

  describe('subscriptGlyph', () => {
    it('should leave existing subscript glyphs unchanged', () => {
      expect(subscriptGlyph('H₂O')).toBe('H₂O');
      expect(subscriptGlyph('C₆H₁₂O₆')).toBe('C₆H₁₂O₆');
    });

    it("should not convert ASCII digits (that is subscript's job)", () => {
      expect(subscriptGlyph('H2O')).toBe('H2O');
      expect(subscriptGlyph('123')).toBe('123');
    });

    it('should handle empty string', () => {
      expect(subscriptGlyph('')).toBe('');
    });
  });

  describe('superscriptGlyph', () => {
    it('should leave existing superscript glyphs unchanged', () => {
      expect(superscriptGlyph('x²')).toBe('x²');
      expect(superscriptGlyph('10⁻³')).toBe('10⁻³');
    });

    it("should not convert ASCII digits (that is superscript's job)", () => {
      expect(superscriptGlyph('x2')).toBe('x2');
      expect(superscriptGlyph('123')).toBe('123');
    });

    it('should handle empty string', () => {
      expect(superscriptGlyph('')).toBe('');
    });
  });

  describe('formatFormula', () => {
    it('subscripts atom counts in a simple formula', () => {
      expect(formatFormula('C6H15NO3')).toBe('C₆H₁₅NO₃');
      expect(formatFormula('H2O')).toBe('H₂O');
      expect(formatFormula('C12H22O11')).toBe('C₁₂H₂₂O₁₁');
    });

    it('turns a period into an adduct dot for a salt with no coefficient', () => {
      expect(formatFormula('C6H15NO3.H3PO4')).toBe('C₆H₁₅NO₃⋅H₃PO₄');
    });

    it('keeps a leading hydrate/adduct coefficient full-size', () => {
      expect(formatFormula('C6H15NO3.5H3PO4')).toBe('C₆H₁₅NO₃⋅5H₃PO₄');
      expect(formatFormula('CuSO4.5H2O')).toBe('CuSO₄⋅5H₂O');
    });

    it('subscripts digits after closing brackets but not full-size groups', () => {
      expect(formatFormula('Ca3(PO4)2')).toBe('Ca₃(PO₄)₂');
      expect(formatFormula('KN(C(O)CH2)2')).toBe('KN(C(O)CH₂)₂');
    });

    it('leaves formulas without atom-count digits unchanged', () => {
      expect(formatFormula('NaOH')).toBe('NaOH');
      expect(formatFormula('KBr')).toBe('KBr');
    });

    it('handles an empty string', () => {
      expect(formatFormula('')).toBe('');
    });
  });

  describe('pickBroadestName', () => {
    it('prefers a shorter synonym that keeps the primary name’s core word', () => {
      expect(
        pickBroadestName(['Hexasodium hexametaphosphate', 'Calgon', 'Sodium hexametaphosphate']),
      ).toBe('Sodium hexametaphosphate');
    });

    it('keeps the primary when no shorter candidate shares its core word', () => {
      // "Acetone"’s core is "acetone"; the shorter-looking systematic names don’t contain it.
      expect(pickBroadestName(['Acetone', 'propan-2-one', 'dimethyl ketone'])).toBe('Acetone');
    });

    it('ignores short unrelated synonyms (brand names) that lack the core word', () => {
      expect(pickBroadestName(['Potassium permanganate', 'Condy’s crystals'])).toBe(
        'Potassium permanganate',
      );
    });

    it('returns the sole candidate, or undefined for an empty list', () => {
      expect(pickBroadestName(['Acetone'])).toBe('Acetone');
      expect(pickBroadestName([])).toBeUndefined();
    });
  });

  describe('findFormulaInText', () => {
    it('should return unicode-glyph formulas unchanged', () => {
      expect(findFormulaInText('C₂₄H₂₀KN₅O₅S')).toBe('C₂₄H₂₀KN₅O₅S');
      expect(findFormulaInText('K₂SO₄')).toBe('K₂SO₄');
    });

    it('should find a glyph formula embedded in surrounding text', () => {
      expect(findFormulaInText('Here is a chemical formula: C₁₆H₃₃KO₂')).toBe('C₁₆H₃₃KO₂');
    });

    it('should convert <sub>/<sup> tags to unicode glyphs', () => {
      expect(findFormulaInText('K<sub>2</sub>SO<sub>4</sub>')).toBe('K₂SO₄');
      expect(findFormulaInText('Fe<sup>2</sup>O<sub>3</sub>')).toBe('Fe²O₃');
    });

    it('should convert multi-digit tagged subscripts', () => {
      expect(findFormulaInText('C<sub>16</sub>H<sub>33</sub>KO<sub>2</sub>')).toBe('C₁₆H₃₃KO₂');
    });

    it('should handle a tagged salt coefficient after a separator', () => {
      expect(
        findFormulaInText(
          'C<sub>33</sub>H<sub>25</sub>N<sub>3</sub>O<sub>12</sub>S • <sub>4</sub>K',
        ),
      ).toBe('C₃₃H₂₅N₃O₁₂S • ₄K');
    });

    it('should keep salt/hydrate components and variable coefficients', () => {
      expect(findFormulaInText('C₂₀H₂₀FN₆O₅·K')).toBe('C₂₀H₂₀FN₆O₅·K');
      expect(findFormulaInText('Here is a chemical formula: C₁₀H₇KN₆O·xH₂O')).toBe(
        'C₁₀H₇KN₆O·xH₂O',
      );
    });

    it('should keep a fractional hydrate coefficient', () => {
      expect(findFormulaInText('K₂CO₃·3/2H₂O')).toBe('K₂CO₃·3/2H₂O');
    });

    it('should handle parenthesised / bracketed groups', () => {
      expect(findFormulaInText('KN(C(O)CH₂)₂')).toBe('KN(C(O)CH₂)₂');
      expect(findFormulaInText('AlK(SO₄)₂·12H₂O')).toBe('AlK(SO₄)₂·12H₂O');
    });

    it("should keep tight '.'/'*' separators and ionic charge signs", () => {
      expect(findFormulaInText('C₃H₂N₂O₃.K')).toBe('C₃H₂N₂O₃.K');
      expect(findFormulaInText('C₈H₁₃BO₂F₃-.K+')).toBe('C₈H₁₃BO₂F₃-.K+');
      expect(findFormulaInText('C₉H₁₃O₄*K')).toBe('C₉H₁₃O₄*K');
    });

    it('should match a formula written with HTML entities but leave them verbatim', () => {
      // Entities gate the match, but only <sub>/<sup> tags are rewritten — entities pass through.
      expect(findFormulaInText('H&#8322;O')).toBe('H&#8322;O');
      expect(findFormulaInText('H&#x2082;O')).toBe('H&#x2082;O');
    });

    it('should match a clean multi-element formula like KBr', () => {
      // Two element units (K + Br) clear the gate, so a subscript-free salt is still matched.
      expect(findFormulaInText('KBr')).toBe('KBr');
    });

    it('should match a lone element when it is the entire input', () => {
      expect(findFormulaInText('Na')).toBe('Na');
      expect(findFormulaInText('  K+  ')).toBe('K+');
    });

    it('should pull a lone element out of prose', () => {
      // "Na" lives inside "Nature", and "I" is a word — neither is the whole input, so both reject.
      expect(findFormulaInText('I love Nature')).toBe('I');
      expect(findFormulaInText('Just some text')).toBeUndefined();
      expect(findFormulaInText('vitamin B12 supplement')).toBe('B12');
      expect(findFormulaInText('')).toBeUndefined();
    });

    it('should return the most likely formula when several substrings match', () => {
      // "EINECS" yields "IN" and "CS"; the real formula "NaOSOCH3" should win.
      const input =
        'Methanesulfinic acid sodium salt | A814374 | EINECS 243-669-6 | STR02097 | ' +
        'AC-1087 | Methanesulfinic acid, sodium salt (1:1) | NaOSOCH3 |';
      expect(findFormulaInText(input)).toBe('NaOSOCH3');
    });
  });

  describe('findFormulaInHtml', () => {
    it('should find and format simple chemical formulas', () => {
      expect(findFormulaInHtml('H<sub>2</sub>O')).toBe('H₂O');
      expect(findFormulaInHtml('CO<sub>2</sub>')).toBe('CO₂');
    });

    it('should find and format complex chemical formulas', () => {
      expect(findFormulaInHtml('K<sub>2</sub>Cr<sub>2</sub>O<sub>7</sub>')).toBe('K₂Cr₂O₇');
      expect(findFormulaInHtml('Fe<sub>2</sub>O<sub>3</sub>')).toBe('Fe₂O₃');
    });

    it('should handle formulas with surrounding text', () => {
      expect(findFormulaInHtml('The formula is H<sub>2</sub>SO<sub>4</sub> in water')).toBe(
        'H₂SO₄',
      );
      expect(findFormulaInHtml('foobar K<sub>2</sub>Cr<sub>2</sub>O<sub>7</sub> baz')).toBe(
        'K₂Cr₂O₇',
      );
    });

    it('should return undefined for invalid chemical formulas', () => {
      expect(findFormulaInHtml('Not a formula')).toBeUndefined();
      expect(findFormulaInHtml('Hx2O because there is no Hx element')).toBeUndefined();
      expect(findFormulaInHtml('')).toBeUndefined();
    });

    it('should handle formulas with two-letter elements', () => {
      expect(findFormulaInHtml('Na<sub>2</sub>SO<sub>4</sub>')).toBe('Na₂SO₄');
      expect(findFormulaInHtml('Ca<sub>3</sub>PO<sub>4</sub>')).toBe('Ca₃PO₄');
    });

    it('should match a single element that carries a tagged subscript', () => {
      expect(findFormulaInHtml('H<sub>2</sub>')).toBe('H₂');
      expect(findFormulaInHtml('Na<sub>2</sub>')).toBe('Na₂');
    });

    it('should match a bare element or an untagged single-element token', () => {
      // No subscript at all, or only an inline digit, isn't enough for a single element.
      expect(findFormulaInHtml('Na')).toBe('Na');
      expect(findFormulaInHtml('vitamin B12 supplement')).toBe('B12');
    });

    it('should handle multi-digit subscripts (10 and above)', () => {
      expect(
        findFormulaInHtml(
          'C<sub>18</sub>H<sub>14</sub>N<sub>2</sub>Na<sub>2</sub>O<sub>8</sub>S<sub>2</sub>',
        ),
      ).toBe('C₁₈H₁₄N₂Na₂O₈S₂');
      expect(findFormulaInHtml('C<sub>12</sub>H<sub>22</sub>O<sub>11</sub>')).toBe('C₁₂H₂₂O₁₁');
    });

    it('should tolerate trailing markup after the formula', () => {
      expect(findFormulaInHtml('Summenformel: C<sub>10</sub>H<sub>16</sub>O</span>')).toBe(
        'C₁₀H₁₆O',
      );
    });

    it('should leave untagged inline numbers as regular digits (not subscript)', () => {
      // Inline atom/molecule counts are matched but never converted — only <sub>/<sup> are.
      expect(findFormulaInHtml('Compound NaCl2 here')).toBe('NaCl2');
    });

    it('should keep salt/hydrate components after a separator', () => {
      expect(findFormulaInHtml('C<sub>20</sub>H<sub>20</sub>FN<sub>6</sub>O<sub>5</sub>·K')).toBe(
        'C₂₀H₂₀FN₆O₅·K',
      );
      expect(
        findFormulaInHtml('C<sub>23</sub>H<sub>28</sub>ClN<sub>3</sub>O<sub>5</sub>S • K'),
      ).toBe('C₂₃H₂₈ClN₃O₅S • K');
    });

    it('should handle a separator with a leading coefficient (tagged or variable)', () => {
      // A <sub>-tagged coefficient denotes how many of the whole salt; it is still a subscript.
      expect(
        findFormulaInHtml('C<sub>4</sub>H<sub>8</sub>N<sub>3</sub>O<sub>5</sub>P • <sub>2</sub>K'),
      ).toBe('C₄H₈N₃O₅P • ₂K');
      // A variable hydrate coefficient (x/n) stays a regular letter.
      expect(findFormulaInHtml('C<sub>10</sub>H<sub>7</sub>KN<sub>6</sub>O·xH<sub>2</sub>O')).toBe(
        'C₁₀H₇KN₆O·xH₂O',
      );
    });

    it('should handle parenthesised / bracketed groups', () => {
      expect(findFormulaInHtml('KN(C(O)CH<sub>2</sub>)<sub>2</sub>')).toBe('KN(C(O)CH₂)₂');
    });

    it('should handle a parenthesised group with a multi-digit hydrate coefficient', () => {
      expect(findFormulaInHtml('AlK(SO<sub>4</sub>)<sub>2</sub>·12H<sub>2</sub>O')).toBe(
        'AlK(SO₄)₂·12H₂O',
      );
    });

    it("should keep a tight '.' separator and ionic charge signs", () => {
      expect(findFormulaInHtml('C<sub>3</sub>H<sub>2</sub>N<sub>2</sub>O<sub>3</sub>.K')).toBe(
        'C₃H₂N₂O₃.K',
      );
      expect(findFormulaInHtml('CHBF<sub>5</sub>-.K+')).toBe('CHBF₅-.K+');
      expect(findFormulaInHtml('C<sub>8</sub>H<sub>13</sub>BO<sub>2</sub>F<sub>3</sub>-.K+')).toBe(
        'C₈H₁₃BO₂F₃-.K+',
      );
    });

    it('should keep a fractional hydrate coefficient', () => {
      expect(findFormulaInHtml('K<sub>2</sub>CO<sub>3</sub>·3/2H<sub>2</sub>O')).toBe(
        'K₂CO₃·3/2H₂O',
      );
      expect(
        findFormulaInHtml('C<sub>4</sub>H<sub>4</sub>O<sub>6</sub>K<sub>2</sub>·1/2H<sub>2</sub>O'),
      ).toBe('C₄H₄O₆K₂·1/2H₂O');
    });

    it('should not treat sentence periods or decimals as a separator', () => {
      // "." only separates when immediately followed by a component, so prose/decimals are safe.
      expect(findFormulaInHtml('Contains H<sub>2</sub>O. The product is pure.')).toBe('H₂O');
      expect(findFormulaInHtml('density 1.5 only')).toBeUndefined();
    });

    it('should handle formulas with superscripts', () => {
      expect(findFormulaInHtml('Fe<sup>2</sup>O<sub>3</sub>')).toBe('Fe²O₃');
      expect(findFormulaInHtml('Cu<sup>2</sup>SO<sub>4</sub>')).toBe('Cu²SO₄');
    });
    it('should return undefined when given non-existent elements in formula', () => {
      expect(findFormulaInHtml('Fx<sup>2</sup>Hp<sub>3</sub>')).toBeUndefined();
      expect(findFormulaInHtml('Cq<sup>6</sup>SD<sub>4</sub>')).toBeUndefined();
    });

    it('should extract a formula nested inside other HTML elements', () => {
      const html =
        '<P STYLE="margin:0 0 0 0;font-family:Arial;font-size:10pt;">' +
        '<SPAN STYLE="color:#000000;">Summenformel: ' +
        'C<sub>18</sub>H<sub>14</sub>N<sub>2</sub>Na<sub>2</sub>O<sub>8</sub>S<sub>2</sub></SPAN></P>';
      expect(findFormulaInHtml(html)).toBe('C₁₈H₁₄N₂Na₂O₈S₂');
    });

    it('should not match element-like sequences inside HTML tags', () => {
      // Tag names and attributes look element-ish ("P", "SPAN", "STYLE" -> S,T,Y,L,E,
      // "Arial" -> Ar, "color" -> Co) but live inside tags, so they must be ignored.
      expect(
        findFormulaInHtml('<P STYLE="font-family:Arial;"><SPAN STYLE="color:#000000;"></SPAN></P>'),
      ).toBeUndefined();
      // The real formula is still found even though "STYLE"/"SPAN" precede it inside tags.
      expect(findFormulaInHtml('<SPAN STYLE="color:#000000;">CO<sub>2</sub></SPAN>')).toBe('CO₂');
    });
  });

  describe('parsePurity', () => {
    it('should parse a plain percentage', () => {
      expect(parsePurity('95%')).toBe(95);
      expect(parsePurity('100%')).toBe(100);
    });

    it('should parse a percentage embedded in a product name', () => {
      expect(parsePurity('Sodium borohydride, min 95%')).toBe(95);
      expect(parsePurity('Acetone 99.9% ACS grade')).toBe(99.9);
    });

    it('should parse decimal percentages', () => {
      expect(parsePurity('98.5%')).toBe(98.5);
    });

    it('should tolerate whitespace before the percent sign', () => {
      expect(parsePurity('min 95 %')).toBe(95);
    });

    it('should ignore a leading qualifier like ≥', () => {
      expect(parsePurity('Hydroquinone ≥99.8%, extra pure')).toBe(99.8);
      expect(parsePurity('Sodium bicarbonate ≥99 %, Ph.Eur.')).toBe(99);
    });

    it("should parse a trailing 'or better' plus", () => {
      expect(parsePurity('Lithium Carbonate 99+% Extra Pure')).toBe(99);
      expect(parsePurity('Potassium Sulphate 99 +%, Foodgrade')).toBe(99);
      expect(parsePurity('Sodium carbonate 99.7 +%, pure')).toBe(99.7);
    });

    it('should parse a European comma decimal', () => {
      expect(parsePurity('Potassium hydrogen tartrate ≥99,5 %')).toBe(99.5);
      expect(parsePurity('Sodium acetate trihydrate 99,5+% pure')).toBe(99.5);
    });

    it('should not read a non-percentage code (E515) as purity', () => {
      expect(parsePurity('Potassium Sulphate 99 +%, Ph. Eur, E515')).toBe(99);
      expect(parsePurity('Food Grade, FCC, E500i')).toBeUndefined();
    });

    it('should return nothing when there is no percentage', () => {
      expect(parsePurity('Sodium borohydride')).toBeUndefined();
      expect(parsePurity('')).toBeUndefined();
    });

    it('should return nothing for out-of-range percentages', () => {
      expect(parsePurity('120%')).toBeUndefined();
      expect(parsePurity('0%')).toBeUndefined();
    });
  });

  describe('parseGrade', () => {
    // Per grade, the spellings it must absorb and the near-misses it must not, keyed by
    // the label parseGrade returns. Lives in ./__fixtures__/grade-corpus.json — add a
    // grade to the `bodies` map in science.ts -> add its row there.
    //
    // "Ungraded" has an empty `unsuccessful` set on purpose: it is the fallback return,
    // so every string that fails to match some other grade IS Ungraded. There is no
    // input that could fail to be it.
    interface GradeCases {
      successful: string[];
      unsuccessful: string[];
    }
    const GRADE_CORPUS: Record<string, GradeCases> = gradeCorpus;

    // The bare token each grade is written as when it appears after a "Grade:" label.
    // Not always the label itself: "LR" is Lab Grade, and Impure/Ungraded carry no suffix.
    const LABEL_TOKENS: Array<[token: string, expected: string]> = [
      ['ACS', 'ACS Grade'],
      ['AR', 'AR Grade'],
      ['HPLC', 'HPLC Grade'],
      ['USP', 'USP Grade'],
      ['BP', 'BP Grade'],
      ['JP', 'JP Grade'],
      ['NF', 'NF Grade'],
      ['FCC', 'FCC Grade'],
      ['NSF', 'FCC Grade'],
      ['LR', 'Lab Grade'],
      ['Technical', 'Technical Grade'],
      ['Industrial', 'Industrial Grade'],
      ['Practical', 'Practical Grade'],
      ['Cosmetic', 'Cosmetic Grade'],
      ['Extraction', 'Extraction Grade'],
      ['Guaranteed', 'Guaranteed Grade'],
      ['Reagent', 'Reagent Grade'],
      ['Lab', 'Lab Grade'],
      ['Pure', 'Pure Grade'],
      ['Pharma', 'Pharma Grade'],
      ['PA', 'Pure Grade'],
      ['P.A.', 'Pure Grade'],
      ['Pure Grade', 'Pure Grade'],
      ['High Purity', 'Pure Grade'],
      ['High Grade', 'Pure Grade'],
      ['High Purity Grade', 'Pure Grade'],
      ['High Quality Grade', 'Pure Grade'],
      ['Ultra High Purity Grade', 'Pure Grade'],
      ['Ultra High Quality Grade', 'Pure Grade'],
      ['ultra high quality', 'Pure Grade'],
      ['ultra high grade', 'Pure Grade'],
      ['Low', 'Low Grade'],
      ['Impure', 'Impure'],
      ['Ungraded', 'Ungraded'],
    ];

    describe.each(Object.entries(GRADE_CORPUS))('%s', (expected, cases) => {
      it.each(cases.successful)('should classify %j', (input) => {
        expect(parseGrade(input)).toBe(expected);
      });

      // Guarded: it.each throws on an empty table, and "Ungraded" has no near-misses.
      if (cases.unsuccessful.length > 0) {
        it.each(cases.unsuccessful)('should not classify %j', (input) => {
          expect(parseGrade(input)).not.toBe(expected);
        });
      }
    });

    it("should fall through to 'Ungraded' for every near-miss", () => {
      // The per-grade assertion above only says "not this grade". This is the stronger
      // claim: no near-miss lands on some *other* grade by accident.
      for (const { unsuccessful } of Object.values(GRADE_CORPUS)) {
        for (const input of unsuccessful) {
          expect(parseGrade(input)).toBe('Ungraded');
        }
      }
    });

    describe.each(LABEL_TOKENS)('labeled field: %s', (token, expected) => {
      it.each([`Grade: ${token}`, `Purity: ${token}`, `Quality: ${token}`, `Grade - ${token}`])(
        'should classify %j',
        (input) => {
          expect(parseGrade(input)).toBe(expected);
        },
      );

      it(`should classify "Purity: ${token} Grade"`, () => {
        expect(parseGrade(`Purity: ${token} Grade`)).toBe(expected);
      });
    });

    it('should find the grade inside a full product title', () => {
      expect(parseGrade('SODIUM, REAGENT (ACS) - 500 G')).toBe('ACS Grade');
      expect(parseGrade('SODIUM CHLORITE, 80% TECHNICAL - 2.5 KG')).toBe('Technical Grade');
      expect(parseGrade('SODIUM CHLORITE, 90% Technical Grade - 2.5 KG')).toBe('Technical Grade');
      expect(parseGrade('Acetonitrile HPLC - 1 L')).toBe('HPLC Grade');
      expect(parseGrade('Magnesium stearate NF, 1 kg')).toBe('NF Grade');
      expect(parseGrade('Caffeine, British Pharmacopoeia')).toBe('BP Grade');
    });

    it('should accept dotted acronyms', () => {
      expect(parseGrade('A.C.S.')).toBe('ACS Grade');
      expect(parseGrade('A.R.')).toBe('AR Grade');
      expect(parseGrade('U.S.P.')).toBe('USP Grade');
      expect(parseGrade('N.F.')).toBe('NF Grade');
      expect(parseGrade('B.P./U.S.P.')).toBe('USP Grade');
    });

    it("should reject an acronym that is really an abbreviation ('ACS.')", () => {
      expect(parseGrade('ACS.')).toBe('Ungraded');
    });

    it('should prefer the specific standard when several are present', () => {
      // "Reagent (ACS)" is ACS, not the generic Reagent Grade.
      expect(parseGrade('SODIUM, REAGENT (ACS) - 500 G')).toBe('ACS Grade');
      // BP declines when "/USP" follows, so the combo routes to USP.
      expect(parseGrade('Citric acid, BP/USP')).toBe('USP Grade');
      expect(parseGrade('Citric acid, USP/BP')).toBe('USP Grade');
      // ...but a standalone BP is still BP.
      expect(parseGrade('Caffeine, BP')).toBe('BP Grade');
    });

    it("should not read 'Impure' as 'Pure'", () => {
      expect(parseGrade('Impure')).toBe('Impure');
      expect(parseGrade('Impure sample')).toBe('Impure');
    });

    it.each([
      '',
      'SODIUM NITRATE, 99.999% - 50 G',
      'Ultra pure water',
      'Industrial solvent, 5 L',
      'Low prices every day',
      'Ships in 4-6 business days',
      'Nitric acid ARS',
      'NFPA rated',
      'high performance pump',
      'Sodium, JAR of 500g',
    ])("should return 'Ungraded' for %j", (input) => {
      expect(parseGrade(input)).toBe('Ungraded');
    });

    it('should never report multiple matching groups across the corpus', () => {
      // parseGrade warns when two named groups match at once — that means the pattern
      // is ambiguous, which the returned label would silently hide.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      for (const { successful, unsuccessful } of Object.values(GRADE_CORPUS)) {
        [...successful, ...unsuccessful].forEach(parseGrade);
      }
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('purityGradeToPercentage', () => {
    it.each([
      ['HPLC Grade', 99.9],
      ['ACS Grade', 99.8],
      ['AR Grade', 99.7],
      ['Guaranteed Grade', 99.7],
      ['Reagent Grade', 99.7],
      ['USP Grade', 99.5],
      ['BP Grade', 99.5],
      ['JP Grade', 99.5],
      ['NF Grade', 99.5],
      ['Pharma Grade', 99.0],
      ['FCC Grade', 99.0],
      ['Cosmetic Grade', 98.0],
      ['Extraction Grade', 98.0],
      ['Lab Grade', 98.0],
      ['Pure Grade', 95.0],
      ['Practical Grade', 95.0],
      ['Technical Grade', 90.0],
      ['Industrial Grade', 90.0],
      ['Low Grade', 50.0],
    ])('should map %s to %s', (grade, expected) => {
      expect(purityGradeToPercentage(grade)).toBe(expected);
    });

    it("should map 'Impure' to 0, not undefined", () => {
      // 0 is a value here, not a miss — callers using `?? fallback` depend on the
      // difference, so pin both halves.
      expect(purityGradeToPercentage('Impure')).toBe(0);
      expect(purityGradeToPercentage('Impure')).not.toBeUndefined();
    });

    it.each(['Ungraded', '', 'Nonsense Grade'])('should return undefined for %j', (grade) => {
      expect(purityGradeToPercentage(grade)).toBeUndefined();
    });

    it('should match exactly, so a differently-cased label is unrecognised', () => {
      expect(purityGradeToPercentage('acs grade')).toBeUndefined();
      expect(purityGradeToPercentage('ACS GRADE')).toBeUndefined();
    });

    it('should rank the grades in the documented hierarchy order', () => {
      const hierarchy = [
        'HPLC Grade',
        'ACS Grade',
        'Reagent Grade',
        'AR Grade',
        'Guaranteed Grade',
        'USP Grade',
        'BP Grade',
        'JP Grade',
        'NF Grade',
        'Pharma Grade',
        'FCC Grade',
        'Cosmetic Grade',
        'Extraction Grade',
        'Lab Grade',
        'Pure Grade',
        'Practical Grade',
        'Technical Grade',
        'Industrial Grade',
        'Low Grade',
        'Impure',
      ];
      const percentages = hierarchy.map((grade) => purityGradeToPercentage(grade));

      expect(percentages).not.toContain(undefined);
      for (let i = 1; i < percentages.length; i++) {
        expect(percentages[i]).toBeLessThanOrEqual(Number(percentages[i - 1]));
      }
    });

    it('should recognise every label parseGrade can produce', () => {
      // The seam most likely to break silently: parseGrade renames its group
      // ("ACS_Grade" -> "ACS Grade") and the switch keys on the result. A new group
      // in science.ts with no matching case would surface here.
      const inputs = [
        'ACS',
        'AR',
        'HPLC',
        'USP',
        'BP',
        'JP',
        'NF',
        'FCC',
        'LR',
        'Technical Grade',
        'Industrial Grade',
        'Practical Grade',
        'Cosmetic Grade',
        'Extraction Grade',
        'Guaranteed Grade',
        'Reagent Grade',
        'Lab Grade',
        'Pure Grade',
        'Pharma Grade',
        'Low Grade',
        'Impure',
      ];
      for (const input of inputs) {
        expect(purityGradeToPercentage(parseGrade(input))).toBeTypeOf('number');
      }
      // "Ungraded" is the one label that intentionally has no percentage.
      expect(purityGradeToPercentage(parseGrade('Sodium nitrate 50 g'))).toBeUndefined();
    });
  });

  describe('sortablePurityGrade', () => {
    it.each([
      ['ACS Grade', 99.8],
      ['USP Grade', 99.5],
      ['Technical Grade', 90],
      ['Low Grade', 50],
    ])('should sort the grade %s as %s', (grade, expected) => {
      expect(sortablePurityGrade(grade)).toBe(expected);
    });

    it.each([
      ['95%', 95],
      ['99.9%', 99.9],
      ['99.9+%', 99.9],
    ])('should sort the percentage %s as %s', (purity, expected) => {
      expect(sortablePurityGrade(purity)).toBe(expected);
    });

    it('orders a shared base by its comparator prefix', () => {
      // Full 5 levels: < 75 < ≤ 75 < 75 ≈ ≈ 75 < ≥ 75 < > 75.
      const lt = sortablePurityGrade('<75%');
      const le = sortablePurityGrade('≤75%');
      const bare = sortablePurityGrade('75%');
      const approx = sortablePurityGrade('≈75%');
      const ge = sortablePurityGrade('≥75%');
      const gt = sortablePurityGrade('>75%');
      expect(lt).toBeLessThan(le);
      expect(le).toBeLessThan(bare);
      expect(bare).toBe(approx);
      expect(approx).toBeLessThan(ge);
      expect(ge).toBeLessThan(gt);
      // The nudge never crosses into the next integer.
      for (const value of [lt, le, bare, approx, ge, gt]) {
        expect(value).toBeGreaterThan(74);
        expect(value).toBeLessThan(76);
      }
    });

    it('nudges a comparator percentage above its bare value', () => {
      expect(sortablePurityGrade('≥99.8%')).toBeCloseTo(99.81);
      expect(sortablePurityGrade('≥99.8%')).toBeGreaterThan(sortablePurityGrade('99.8%'));
    });

    it('should sort a range on its lower bound', () => {
      expect(sortablePurityGrade('99.9-100%')).toBe(99.9);
      expect(sortablePurityGrade('98 - 102%')).toBe(98);
    });

    it('should read a European comma decimal', () => {
      expect(sortablePurityGrade('99,5%')).toBe(99.5);
    });

    it('should clamp an out-of-range percentage to 100', () => {
      expect(sortablePurityGrade('120%')).toBe(100);
    });

    it.each(['', 'N/A', 'Ungraded'])('should fall back to 0 for %j', (input) => {
      expect(sortablePurityGrade(input)).toBe(0);
    });

    it("should sort 'Impure' as 0", () => {
      // "Impure" carries no " Grade" suffix, so it takes the numeric path and finds
      // no digits — which lands on 0 anyway. Pinned so a change to the suffix check
      // can't quietly move it.
      expect(sortablePurityGrade('Impure')).toBe(0);
    });
  });

  describe('isMoleForm', () => {
    it.each([
      'C12H22O11',
      'H2O',
      'NaCl',
      'KBr',
      'C6H12O6',
      'CH3COOH',
      'Na', // lone element symbol
      'C<sub>11</sub>H<sub>8</sub>I<sub>3</sub>N<sub>2</sub>NaO<sub>4</sub>',
    ])('should accept %j', (formula) => {
      expect(isMoleForm(formula)).toBe(true);
    });

    it.each([
      ['12H22O11', 'leading digit — a formula must start with an element'],
      ['', 'empty string'],
      ['hello', 'prose'],
      ['h2o', 'lowercase element symbol'],
      ['C0H2', 'zero subscript'],
      ['C6 H12 O6', 'internal whitespace'],
      ['Na+', 'ionic charge'],
      ['H2O·2H2O', 'adduct/hydrate separator'],
      ['C₆H₁₂O₆', 'unicode subscript glyphs'],
    ])('should reject %j (%s)', (formula) => {
      expect(isMoleForm(formula)).toBe(false);
    });

    it('should be anchored, so a formula buried in prose is rejected', () => {
      // Unlike findFormulaInText, this is a whole-string predicate — ProductBuilder
      // relies on that to decide whether to store a value verbatim.
      expect(isMoleForm('the formula is H2O')).toBe(false);
      expect(isMoleForm('H2O ')).toBe(false);
    });
  });

  describe('findPurity', () => {
    it('should keep the comparator on a percentage', () => {
      expect(findPurity('Sodium Metal ≥99.8%')).toBe('≥99.8%');
      expect(findPurity('>99%')).toBe('>99%');
      expect(findPurity('≈99.5%')).toBe('≈99.5%');
    });

    it('should read the shapes suppliers write a percentage in', () => {
      expect(findPurity('Sodium borohydride, min 95%')).toBe('95%');
      expect(findPurity('SODIUM CHLORITE, 80% TECHNICAL')).toBe('80%');
      expect(findPurity('100%')).toBe('100%');
      // European comma decimal, and the "or better" plus.
      expect(findPurity('Potassium hydrogen tartrate ≥99,5 %')).toBe('≥99,5%');
      expect(findPurity('Lithium Carbonate 99+% Extra Pure')).toBe('99+%');
    });

    it('should prefer a percentage over a grade when both are present', () => {
      expect(findPurity('SODIUM CHLORITE, 80% TECHNICAL - 2.5 KG')).toBe('80%');
    });

    it('should fall back to the grade when there is no valid percentage', () => {
      expect(findPurity('Acetonitrile HPLC - 1 L')).toBe('HPLC Grade');
      expect(findPurity('Sodium, Reagent (ACS) - 500 G')).toBe('ACS Grade');
    });

    it('should strip HTML so inline CSS is not read as a purity', () => {
      expect(findPurity('<div style="width: 100%">Sodium sulfate AR</div>')).toBe('AR Grade');
    });

    it('should reject an out-of-range percentage and fall through to the grade', () => {
      expect(findPurity('120%')).toBe('Ungraded');
      expect(findPurity('0%')).toBe('Ungraded');
    });

    it("should return 'Ungraded' — not undefined — when nothing is recognised", () => {
      // parseGrade is the fallback and it never returns undefined, so only an empty
      // input reaches the early return.
      expect(findPurity('Ships in 4-6 business days')).toBe('Ungraded');
      expect(findPurity('E515 additive')).toBe('Ungraded');
      expect(findPurity('')).toBeUndefined();
    });
  });

  describe('parseLocalizedNumber', () => {
    it('should treat a lone separator as a decimal point', () => {
      expect(parseLocalizedNumber('149,19')).toBe(149.19);
      expect(parseLocalizedNumber('140.22')).toBe(140.22);
      expect(parseLocalizedNumber('0.5')).toBe(0.5);
    });

    it('should use the last-occurring separator as the decimal when both are present', () => {
      expect(parseLocalizedNumber('1.234,56')).toBe(1234.56); // European
      expect(parseLocalizedNumber('1,234.56')).toBe(1234.56); // US
    });

    it('should treat repeated separators as thousands grouping only', () => {
      expect(parseLocalizedNumber('1,234,567')).toBe(1234567);
      expect(parseLocalizedNumber('1.234.567')).toBe(1234567);
    });

    it('should pass through a plain integer', () => {
      expect(parseLocalizedNumber('40')).toBe(40);
    });

    it('should return NaN for a token with no digits', () => {
      expect(parseLocalizedNumber('abc')).toBeNaN();
    });
  });

  describe('findMolarMass', () => {
    it('parses a European comma-decimal value with a parenthetical label', () => {
      expect(findMolarMass('Molar mass (M) 149,19 g/mol')).toBe(149.19);
    });

    it('finds the molar mass buried in a larger block of text', () => {
      const text =
        'Empirical formula C6H15NO3\nMolar mass (M) 149,19 g/mol\nDensity (D) ca. 1,12\nCAS No.[102-71-6]';
      expect(findMolarMass(text)).toBe(149.19);
    });

    it('handles the common label and unit spellings', () => {
      expect(findMolarMass('MW: 140.22g/mol')).toBe(140.22);
      expect(findMolarMass('MW - 136.169 G/MOL')).toBe(136.169);
      expect(findMolarMass('Molecular mass : 98.14 g/mol')).toBe(98.14);
      expect(findMolarMass('Molecular Weight (MW): 254,32 g·mol⁻¹')).toBe(254.32);
      expect(findMolarMass('formula weight 100.2 g/mole')).toBe(100.2);
      expect(findMolarMass('molar mass 18 g mol-1')).toBe(18);
      expect(findMolarMass('58.44 Da')).toBe(58.44);
    });

    it('falls back to a labelled value with no unit', () => {
      expect(findMolarMass('M.W. 415.6')).toBe(415.6);
      expect(findMolarMass('Mr = 342.30')).toBe(342.3);
    });

    it("recognizes a bare 'mol :' label (LaboratoriumDiscounter catalog)", () => {
      expect(findMolarMass('CAS : 10017-56-8\nFormula : C6H15NO3.H3PO4\nmol : 247.18')).toBe(
        247.18,
      );
      expect(findMolarMass('mol = 156.98')).toBe(156.98);
    });

    it("does not treat the 'mol' in a g/mol unit as a bare label", () => {
      // No colon/equals after "mol", so the bare-mol label must not fire on the unit itself.
      expect(findMolarMass('dose is 5 moles per litre')).toBeUndefined();
    });

    it('disambiguates thousands vs decimal separators in both conventions', () => {
      expect(findMolarMass('1.234,56 g/mol')).toBe(1234.56);
      expect(findMolarMass('1,234.56 g/mol')).toBe(1234.56);
    });

    it('does not mistake unrelated numbers for a molar mass', () => {
      expect(findMolarMass('Mp : 288 - 296°C')).toBeUndefined();
      expect(findMolarMass('Density (D) ca. 1,12')).toBeUndefined();
      expect(findMolarMass('Ships in 4-6 business days')).toBeUndefined();
      expect(findMolarMass('')).toBeUndefined();
    });
  });

  describe('findMolarity', () => {
    it('pulls molarity out of the Searchanise title/description examples', () => {
      expect(
        findMolarity(
          'Briggs-Rauscher oscillating-reaction demo kit with 12% hydrogen peroxide, 0.2M potassium iodate',
        ),
      ).toBe('0.2 M');
      expect(findMolarity('Potassium Nitrate: EZ-Prep - Makes 150ml of 1.5M Solution')).toBe(
        '1.5 M',
      );
      expect(findMolarity('Potassium Iodide Solution, 1M, 500mL')).toBe('1 M');
    });

    it('handles the mol/L unit and a range', () => {
      expect(findMolarity('Buffer 1.5 mol/L stock')).toBe('1.5 mol/L');
      expect(findMolarity('Range 1-2 M working solution')).toBe('1-2 M');
      expect(findMolarity('titrant 0.1 to 0.5 M')).toBe('0.1-0.5 M');
    });

    it("requires a capital M so a lowercase 'm' (milli) never matches", () => {
      expect(findMolarity('Makes 150ml total')).toBeUndefined();
      expect(findMolarity('MAKES 150ML')).toBeUndefined();
      expect(findMolarity('500mL bottle')).toBeUndefined();
    });

    it('does not mistake a molar mass or unrelated text for molarity', () => {
      expect(findMolarity('Molar mass 149 g/mol')).toBeUndefined();
      expect(findMolarity('Sodium chloride, 500 g')).toBeUndefined();
      expect(findMolarity('')).toBeUndefined();
    });
  });

  describe('parseChemicalSpecs', () => {
    it('should parse BioFuran-style <p>-delimited specs from a description', () => {
      const html =
        '<p>Appearance: colorless powder</p><p>CAS: 19455-21-1</p><p>Purity: 98%+</p>' +
        '<p>Formula: C5H9KO2</p><p>MW: 140.22g/mol</p><p>SMILES: [K+].CCCCC([O-])=O</p>';
      expect(parseChemicalSpecs(html)).toEqual({
        purity: 98,
        formula: 'C₅H₉KO₂',
        molecularWeight: 140.22,
        smiles: '[K+].CCCCC([O-])=O',
      });
    });

    it("should parse BioFuran-style <br>-delimited bullets with 'Molecular mass'", () => {
      const html =
        '<p>White powder<br>•&nbsp;&nbsp; Purity : 99-100%<br>•&nbsp;&nbsp; CAS : 127-08-2' +
        '<br>•&nbsp;&nbsp; Molecular formula : C2H3KO2<br>•&nbsp;&nbsp; Molecular mass : 98.14g/mol' +
        '<br>•&nbsp;&nbsp; Mp : 288 - 296°C</p>';
      expect(parseChemicalSpecs(html)).toEqual({
        purity: 100,
        formula: 'C₂H₃KO₂',
        molecularWeight: 98.14,
      });
    });

    it("should parse FTF-style <li> bullets with 'MW -' and '+%' purity", () => {
      const html =
        '<ul><li>Purity - 99+%</li><li>MW - 136.169 G/MOL</li>' +
        '<li>Melting point - 197 Celsius</li><li>CAS No - 7646-93-7</li></ul>';
      expect(parseChemicalSpecs(html)).toEqual({ purity: 99, molecularWeight: 136.169 });
    });

    it('should keep subscripted formulas intact instead of stopping at the first element', () => {
      // LaboratoriumDiscounter renders the formula with <sub> tags; stripping them to whitespace
      // used to split "C6H15NO3" into "C 6 H 15 NO 3", leaving the parser with just "C".
      const html =
        '<p>Empirical formula C<sub>6</sub>H<sub>15</sub>NO<sub>3</sub><br />' +
        'Molar mass (M) 149,19 g/mol</p>';
      expect(parseChemicalSpecs(html).formula).toBe('C₆H₁₅NO₃');
    });

    it('should normalize unicode subscript glyphs so the whole formula is captured', () => {
      // Synthetika renders formulas with real subscript characters (₆₅₃₇); without normalization
      // FORMULA_REGEX stops at the first glyph and returns just "C".
      const html =
        '<p>CAS Number: 6132-04-3<br>Sum Formula: C₆H₅Na₃O₇<br>Molar Mass: 258.06 g/mol</p>';
      expect(parseChemicalSpecs(html)).toEqual({
        formula: 'C₆H₅Na₃O₇',
        molecularWeight: 258.06,
      });
    });

    it('should capture a polymer repeating unit under a parenthetical-qualified label', () => {
      // Synthetika's Sodium Polyacrylate: the label carries "(Repeating Unit)" and the value is a
      // parenthesized repeat unit with a trailing variable subscript.
      const html = '<p><strong>Chemical Formula (Repeating Unit)</strong>: (C₃H₃NaO₂)ₙ</p>';
      expect(parseChemicalSpecs(html).formula).toBe('(C₃H₃NaO₂)ₙ');
    });

    it("should parse a dot-joined salt formula and a bare 'mol :' molar mass", () => {
      const html =
        'CAS : 10017-56-8<br>Formula : C6H15NO3.H3PO4<br>mol : 247.18<br>Melting point : 106°C';
      expect(parseChemicalSpecs(html)).toEqual({
        formula: 'C₆H₁₅NO₃⋅H₃PO₄',
        molecularWeight: 247.18,
      });
    });

    it("should skip a shadowing 'formula is X' phrase and use the real Empirical formula", () => {
      const html =
        '<p>The rough formula is C6H15NO3.</p>' +
        '<p>Empirical formula C6H15NO3<br />Molar mass (M) 149,19 g/mol</p>';
      expect(parseChemicalSpecs(html)).toEqual({
        formula: 'C₆H₁₅NO₃',
        molecularWeight: 149.19,
      });
    });

    it('should capture a single-element formula that follows a label', () => {
      expect(
        parseChemicalSpecs('<p>Empirical formula Na<br />Molar mass (M) 22.99 g/mol</p>'),
      ).toEqual({ formula: 'Na', molecularWeight: 22.99 });
      expect(parseChemicalSpecs('<p>Formula: K</p>')).toEqual({ formula: 'K' });
    });

    it('should not pull a bare element out of surrounding prose (no formula label)', () => {
      expect(
        parseChemicalSpecs('<p>Sodium hydroxide is great. Potassium too. Contains Na and K.</p>'),
      ).toEqual({});
    });

    it('should extract a labeled grade from DailyBioUSA-style <p> spec lines', () => {
      // The grade sits alone after a "Grade:" label, which only the labeled regex can classify.
      const html =
        '<p>CAS:<strong>[64-19-7]</strong></p><p>Grade:&nbsp;<strong>Reagent</strong></p>' +
        '<p>DG:&nbsp;<strong>Yes</strong></p><p>Storage:<strong>18 to 25C</strong></p>';
      expect(parseChemicalSpecs(html).grade).toBe('Reagent Grade');
    });

    it.each([
      ['<p>Grade:<strong>High Purity</strong></p>', 'Pure Grade'],
      ['<p>Grade:&nbsp;<strong>Technical</strong></p>', 'Technical Grade'],
      ['<p>Grade: ACS</p>', 'ACS Grade'],
      ['<p>Grade: HPLC</p>', 'HPLC Grade'],
      ['<li>Grade - Analytical Reagent</li>', 'AR Grade'],
    ])('should resolve the grade in %j to %s', (html, expected) => {
      expect(parseChemicalSpecs(html).grade).toBe(expected);
    });

    it('should leave grade unset when no line mentions a grade', () => {
      expect(
        parseChemicalSpecs('<p>Storage: 18 to 25C</p><p>Sterile: No</p>').grade,
      ).toBeUndefined();
    });

    it('should ignore percentages that are not purity', () => {
      const html = '<p>50% brine deicing agent; pH 6.5</p>';
      expect(parseChemicalSpecs(html)).toEqual({});
    });

    it("should not mistake melting point ('Mp') for molecular weight", () => {
      expect(parseChemicalSpecs('<p>Mp : 288 - 296°C</p>')).toEqual({});
    });

    it('should reject an implausible SMILES value', () => {
      expect(parseChemicalSpecs('<p>SMILES: water</p>')).toEqual({});
    });

    it('should return an empty object for non-spec copy', () => {
      expect(parseChemicalSpecs('<p>Ships in 4-6 business days</p>')).toEqual({});
      expect(parseChemicalSpecs('')).toEqual({});
    });
  });
});
