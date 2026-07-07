import { isCAS } from "@/utils/typeGuards/common";

/**
 * The kind of thing a single search term looks like. Used purely to colorize the
 * search box — it does not change search behavior.
 */
export type SearchTermType = "string" | "cas" | "smiles" | "formula";

/** All 118 element symbols, for validating that a token is a chemical formula. */
const ELEMENT_SYMBOLS: ReadonlySet<string> = new Set([
  "H",
  "He",
  "Li",
  "Be",
  "B",
  "C",
  "N",
  "O",
  "F",
  "Ne",
  "Na",
  "Mg",
  "Al",
  "Si",
  "P",
  "S",
  "Cl",
  "Ar",
  "K",
  "Ca",
  "Sc",
  "Ti",
  "V",
  "Cr",
  "Mn",
  "Fe",
  "Co",
  "Ni",
  "Cu",
  "Zn",
  "Ga",
  "Ge",
  "As",
  "Se",
  "Br",
  "Kr",
  "Rb",
  "Sr",
  "Y",
  "Zr",
  "Nb",
  "Mo",
  "Tc",
  "Ru",
  "Rh",
  "Pd",
  "Ag",
  "Cd",
  "In",
  "Sn",
  "Sb",
  "Te",
  "I",
  "Xe",
  "Cs",
  "Ba",
  "La",
  "Ce",
  "Pr",
  "Nd",
  "Pm",
  "Sm",
  "Eu",
  "Gd",
  "Tb",
  "Dy",
  "Ho",
  "Er",
  "Tm",
  "Yb",
  "Lu",
  "Hf",
  "Ta",
  "W",
  "Re",
  "Os",
  "Ir",
  "Pt",
  "Au",
  "Hg",
  "Tl",
  "Pb",
  "Bi",
  "Po",
  "At",
  "Rn",
  "Fr",
  "Ra",
  "Ac",
  "Th",
  "Pa",
  "U",
  "Np",
  "Pu",
  "Am",
  "Cm",
  "Bk",
  "Cf",
  "Es",
  "Fm",
  "Md",
  "No",
  "Lr",
  "Rf",
  "Db",
  "Sg",
  "Bh",
  "Hs",
  "Mt",
  "Ds",
  "Rg",
  "Cn",
  "Nh",
  "Fl",
  "Mc",
  "Lv",
  "Ts",
  "Og",
]);

/**
 * Detects structural characters that appear in SMILES notation but never in a
 * plain chemical formula: bond orders (`=`, `#`), chirality (`@`), stereo bonds
 * (`\`), bracket atoms (`[nH]`, `[Na+]`), and lowercase aromatic organic atoms
 * (`b c n o p s`).
 *
 * @param value - The trimmed, space-free term.
 * @returns True when the term carries a SMILES-only signal.
 * @source
 */
function hasSmilesSignal(value: string): boolean {
  if (/[=#@\\]/.test(value)) return true;
  // A bracket atom, e.g. "[nH]" or "[Na+]".
  if (/\[[^\]]+\]/.test(value)) return true;
  // A lowercase aromatic organic atom standing on its own (not the second letter
  // of a two-letter element symbol like the "a" in "Na").
  if (/(?:^|[^A-Za-z])[bcnops](?![a-z])/.test(value)) return true;
  return false;
}

/**
 * Validates that a token is a well-formed chemical formula: a sequence of real
 * element symbols with optional counts, balanced `()`/`[]` groups, hydrate/salt
 * separators (`·`, `*`, `.`), and an optional trailing charge. Lowercase letters
 * are only accepted as the second character of a two-letter element symbol, so
 * ordinary words (`acetone`, `benzene`) are rejected.
 *
 * @param value - The trimmed, space-free term.
 * @returns True when the whole token parses as a formula with ≥1 element.
 * @source
 */
function isChemicalFormula(value: string): boolean {
  if (!/^[A-Za-z0-9()[\]+\-·•∙⋅.*/xn]+$/.test(value)) return false;

  let i = 0;
  let elementCount = 0;
  let depth = 0;
  const skipDigits = (): void => {
    while (i < value.length && /\d/.test(value[i])) i++;
  };

  while (i < value.length) {
    const char = value[i];

    if (char === "(" || char === "[") {
      depth++;
      i++;
    } else if (char === ")" || char === "]") {
      if (depth === 0) return false;
      depth--;
      i++;
      skipDigits();
    } else if (/[·•∙⋅.*]/.test(char)) {
      // Hydrate/salt separator, optionally followed by a coefficient (e.g. "·2").
      i++;
      while (i < value.length && /[\dxn/]/.test(value[i])) i++;
    } else if (/[0-9+-]/.test(char)) {
      i++;
    } else if (/[A-Z]/.test(char)) {
      const two = value.slice(i, i + 2);
      if (/^[A-Z][a-z]$/.test(two) && ELEMENT_SYMBOLS.has(two)) {
        elementCount++;
        i += 2;
      } else if (ELEMENT_SYMBOLS.has(char)) {
        elementCount++;
        i += 1;
      } else {
        return false;
      }
      skipDigits();
    } else {
      // A lowercase letter here isn't part of an element symbol → not a formula.
      return false;
    }
  }

  return depth === 0 && elementCount >= 1;
}

/**
 * Classifies a single search term as a plain string, a CAS number, a SMILES
 * string, or a chemical formula. Detection is heuristic and intended only to
 * colorize the search box — it never changes what is searched. Phrases (anything
 * containing whitespace) are always plain strings, since CAS/SMILES/formula
 * tokens are contiguous.
 *
 * Ambiguous short tokens that read as valid formulas (e.g. "CCO", which is also
 * SMILES for ethanol) are reported as `"formula"`; SMILES is only chosen when a
 * SMILES-only signal is present (bonds, brackets, or aromatic lowercase atoms).
 *
 * @param term - A single search term (one leaf of the query).
 * @returns The detected term type.
 * @example
 * ```ts
 * detectTermType("7647-14-5");        // "cas"
 * detectTermType("NaOH");             // "formula"
 * detectTermType("KMnO4");            // "formula"
 * detectTermType("O=C=O");            // "smiles"
 * detectTermType("c1ccccc1");         // "smiles"
 * detectTermType("sodium hydroxide"); // "string"
 * detectTermType("acetone");          // "string"
 * ```
 * @source
 */
export function detectTermType(term: string): SearchTermType {
  const value = term.trim();
  if (value === "" || /\s/.test(value)) return "string";
  if (isCAS(value)) return "cas";
  if (hasSmilesSignal(value)) return "smiles";
  if (isChemicalFormula(value)) return "formula";
  return "string";
}
