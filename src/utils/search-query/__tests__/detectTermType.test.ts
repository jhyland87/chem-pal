import { describe, expect, it } from 'vitest';
import { detectTermType } from '../detectTermType';

describe('detectTermType', () => {
  it('detects CAS numbers (valid checksum)', () => {
    expect(detectTermType('7647-14-5')).toBe('cas'); // sodium chloride
    expect(detectTermType('50-00-0')).toBe('cas'); // formaldehyde
    expect(detectTermType('1310-73-2')).toBe('cas'); // sodium hydroxide
  });

  it('does not treat an invalid-checksum CAS-shaped string as CAS', () => {
    expect(detectTermType('1234-56-7')).not.toBe('cas');
  });

  it('detects chemical formulas', () => {
    for (const formula of ['NaOH', 'H2O', 'C6H12O6', 'KMnO4', 'CuSO4', 'NaHCO3', 'Ca(OH)2']) {
      expect(detectTermType(formula)).toBe('formula');
    }
  });

  it('detects hydrates and lone elements as formulas', () => {
    expect(detectTermType('CuSO4·5H2O')).toBe('formula');
    expect(detectTermType('Na')).toBe('formula');
  });

  it('detects SMILES via bond/bracket/aromatic signals', () => {
    for (const smiles of [
      'O=C=O',
      'CC(=O)O',
      'c1ccccc1',
      '[Na+]',
      'C/C=C/C',
      'CN1C=NC2=C1C(=O)N(C)C',
    ]) {
      expect(detectTermType(smiles)).toBe('smiles');
    }
  });

  it('treats plain names and phrases as strings', () => {
    for (const s of [
      'acetone',
      'benzene',
      'sodium hydroxide',
      'potassium permanganate',
      'Acetone',
    ]) {
      expect(detectTermType(s)).toBe('string');
    }
  });

  it('treats empty/whitespace as string', () => {
    expect(detectTermType('')).toBe('string');
    expect(detectTermType('   ')).toBe('string');
  });
});
