import { describe, expect, it } from 'vitest';
import { elementStyle } from '@/utils/molecule/elements';

const UNKNOWN_STYLE = { color: 0xff_1493, radius: 1.5 };

describe('elementStyle', () => {
  it.each([
    ['H', 0xff_ff_ff, 0.31],
    ['C', 0x90_90_90, 0.76],
    ['O', 0xff_0d_0d, 0.66],
    ['Cl', 0x1f_f0_1f, 1.02],
    ['U', 0x00_8f_ff, 1.96],
  ])('returns the CPK style for %s', (symbol, color, radius) => {
    expect(elementStyle(symbol)).toEqual({ color, radius });
  });

  // Lookup is case-sensitive: SDF symbols are always capitalised.
  it.each(['Xx', '', 'c', 'CL', 'R'])('falls back to the default style for %j', (symbol) => {
    expect(elementStyle(symbol)).toEqual(UNKNOWN_STYLE);
  });
});
