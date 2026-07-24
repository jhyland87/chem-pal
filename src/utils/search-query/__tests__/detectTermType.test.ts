import { describe, it } from 'vitest';
import { detectTermType } from '../detectTermType';

describe.concurrent('detectTermType', () => {
  it('detects CAS numbers (valid checksum)', ({ expect }) => {
    expect(detectTermType('7647-14-5')).toBe('cas'); // sodium chloride
    expect(detectTermType('50-00-0')).toBe('cas'); // formaldehyde
    expect(detectTermType('1310-73-2')).toBe('cas'); // sodium hydroxide
  });

  it('does not treat an invalid-checksum CAS-shaped string as CAS', ({ expect }) => {
    expect(detectTermType('1234-56-7')).not.toBe('cas');
  });

  it.for(['NaOH', 'H2O', 'C6H12O6', 'KMnO4', 'CuSO4', 'NaHCO3', 'Ca(OH)2'])(
    'detects chemical formula %s',
    (formula, { expect }) => {
      expect(detectTermType(formula)).toBe('formula');
    },
  );

  it('detects hydrates and lone elements as formulas', ({ expect }) => {
    expect(detectTermType('CuSO4·5H2O')).toBe('formula');
    expect(detectTermType('Na')).toBe('formula');
  });

  it('detects a display-formatted formula with subscript digits', ({ expect }) => {
    expect(detectTermType('Na₆O₁₈P₆')).toBe('formula');
    expect(detectTermType('H₂O')).toBe('formula');
    expect(detectTermType('C₆H₁₂O₆')).toBe('formula');
  });

  it.for(['O=C=O', 'CC(=O)O', 'c1ccccc1', '[Na+]', 'C/C=C/C', 'CN1C=NC2=C1C(=O)N(C)C'])(
    'detects SMILES %s via bond/bracket/aromatic signals',
    (smiles, { expect }) => {
      expect(detectTermType(smiles)).toBe('smiles');
    },
  );

  it.for(['acetone', 'benzene', 'sodium hydroxide', 'potassium permanganate', 'Acetone'])(
    'treats plain name/phrase %j as a string',
    (s, { expect }) => {
      expect(detectTermType(s)).toBe('string');
    },
  );

  it('treats empty/whitespace as string', ({ expect }) => {
    expect(detectTermType('')).toBe('string');
    expect(detectTermType('   ')).toBe('string');
  });
});
