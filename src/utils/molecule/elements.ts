/**
 * Per-element rendering data — CPK colours and covalent radii — used to draw
 * ball-and-stick molecular models.
 * @module
 * @categoryDescription Utils
 * @showCategories
 */

/**
 * How an element is drawn: its CPK colour and its covalent radius.
 * @category Utils
 * @group Types
 * @source
 */
export interface ElementStyle {
  /** Jmol/CPK colour as a 24-bit RGB integer, ready for `THREE.Color.setHex`. */
  color: number;
  /** Covalent radius in angstroms (Cordero 2008), used to scale the atom sphere. */
  radius: number;
}

/**
 * Fallback style for an element outside {@link ELEMENT_STYLES} — mid grey with a
 * middling radius, matching the Jmol convention for unknown elements.
 * @category Utils
 * @source
 */
const DEFAULT_ELEMENT_STYLE: ElementStyle = { color: 0xff_1493, radius: 1.5 };

/**
 * CPK colour and covalent radius for every element ChemPal is realistically asked to
 * render. Keys are capitalised element symbols exactly as they appear in an SDF atom
 * block (`C`, `Cl`, `Na`).
 * @category Utils
 * @source
 */
const ELEMENT_STYLES: Record<string, ElementStyle> = {
  H: { color: 0xff_ff_ff, radius: 0.31 },
  He: { color: 0xd9_ff_ff, radius: 0.28 },
  Li: { color: 0xcc_80_ff, radius: 1.28 },
  Be: { color: 0xc2_ff_00, radius: 0.96 },
  B: { color: 0xff_b5_b5, radius: 0.84 },
  C: { color: 0x90_90_90, radius: 0.76 },
  N: { color: 0x30_50_f8, radius: 0.71 },
  O: { color: 0xff_0d_0d, radius: 0.66 },
  F: { color: 0x90_e0_50, radius: 0.57 },
  Ne: { color: 0xb3_e3_f5, radius: 0.58 },
  Na: { color: 0xab_5c_f2, radius: 1.66 },
  Mg: { color: 0x8a_ff_00, radius: 1.41 },
  Al: { color: 0xbf_a6_a6, radius: 1.21 },
  Si: { color: 0xf0_c8_a0, radius: 1.11 },
  P: { color: 0xff_80_00, radius: 1.07 },
  S: { color: 0xff_ff_30, radius: 1.05 },
  Cl: { color: 0x1f_f0_1f, radius: 1.02 },
  Ar: { color: 0x80_d1_e3, radius: 1.06 },
  K: { color: 0x8f_40_d4, radius: 2.03 },
  Ca: { color: 0x3d_ff_00, radius: 1.76 },
  Sc: { color: 0xe6_e6_e6, radius: 1.7 },
  Ti: { color: 0xbf_c2_c7, radius: 1.6 },
  V: { color: 0xa6_a6_ab, radius: 1.53 },
  Cr: { color: 0x8a_99_c7, radius: 1.39 },
  Mn: { color: 0x9c_7a_c7, radius: 1.39 },
  Fe: { color: 0xe0_66_33, radius: 1.32 },
  Co: { color: 0xf0_90_a0, radius: 1.26 },
  Ni: { color: 0x50_d0_50, radius: 1.24 },
  Cu: { color: 0xc8_80_33, radius: 1.32 },
  Zn: { color: 0x7d_80_b0, radius: 1.22 },
  Ga: { color: 0xc2_8f_8f, radius: 1.22 },
  Ge: { color: 0x66_8f_8f, radius: 1.2 },
  As: { color: 0xbd_80_e3, radius: 1.19 },
  Se: { color: 0xff_a1_00, radius: 1.2 },
  Br: { color: 0xa6_29_29, radius: 1.2 },
  Kr: { color: 0x5c_b8_d1, radius: 1.16 },
  Rb: { color: 0x70_2e_b0, radius: 2.2 },
  Sr: { color: 0x00_ff_00, radius: 1.95 },
  Y: { color: 0x94_ff_ff, radius: 1.9 },
  Zr: { color: 0x94_e0_e0, radius: 1.75 },
  Nb: { color: 0x73_c2_c9, radius: 1.64 },
  Mo: { color: 0x54_b5_b5, radius: 1.54 },
  Tc: { color: 0x3b_9e_9e, radius: 1.47 },
  Ru: { color: 0x24_8f_8f, radius: 1.46 },
  Rh: { color: 0x0a_7d_8c, radius: 1.42 },
  Pd: { color: 0x00_69_85, radius: 1.39 },
  Ag: { color: 0xc0_c0_c0, radius: 1.45 },
  Cd: { color: 0xff_d9_8f, radius: 1.44 },
  In: { color: 0xa6_75_73, radius: 1.42 },
  Sn: { color: 0x66_80_80, radius: 1.39 },
  Sb: { color: 0x9e_63_b5, radius: 1.39 },
  Te: { color: 0xd4_7a_00, radius: 1.38 },
  I: { color: 0x94_00_94, radius: 1.39 },
  Xe: { color: 0x42_9e_b0, radius: 1.4 },
  Cs: { color: 0x57_17_8f, radius: 2.44 },
  Ba: { color: 0x00_c9_00, radius: 2.15 },
  La: { color: 0x70_d4_ff, radius: 2.07 },
  Ce: { color: 0xff_ff_c7, radius: 2.04 },
  Hf: { color: 0x4d_c2_ff, radius: 1.75 },
  Ta: { color: 0x4d_a6_ff, radius: 1.7 },
  W: { color: 0x21_94_d6, radius: 1.62 },
  Re: { color: 0x26_7d_ab, radius: 1.51 },
  Os: { color: 0x26_66_96, radius: 1.44 },
  Ir: { color: 0x17_54_87, radius: 1.41 },
  Pt: { color: 0xd0_d0_e0, radius: 1.36 },
  Au: { color: 0xff_d1_23, radius: 1.36 },
  Hg: { color: 0xb8_b8_d0, radius: 1.32 },
  Tl: { color: 0xa6_54_4d, radius: 1.45 },
  Pb: { color: 0x57_59_61, radius: 1.46 },
  Bi: { color: 0x9e_4f_b5, radius: 1.48 },
  Po: { color: 0xab_5c_00, radius: 1.4 },
  At: { color: 0x75_4f_45, radius: 1.5 },
  Rn: { color: 0x42_82_96, radius: 1.5 },
  Ra: { color: 0x00_7d_00, radius: 2.21 },
  Th: { color: 0x00_ba_ff, radius: 2.06 },
  U: { color: 0x00_8f_ff, radius: 1.96 },
};

/**
 * Looks up how an element should be drawn, falling back to a neutral style for anything
 * not in the table (isotope labels, `R` groups, exotic metals) so an unusual atom renders
 * rather than crashing the scene.
 * @category Utils
 * @param symbol - Element symbol from an SDF atom block, e.g. `'C'` or `'Cl'`
 * @returns The colour and covalent radius to draw the atom with
 * @example
 * ```typescript
 * elementStyle('O');   // { color: 0xff0d0d, radius: 0.66 }
 * elementStyle('Xx');  // { color: 0xff1493, radius: 1.5 }
 * ```
 * @source
 */
export function elementStyle(symbol: string): ElementStyle {
  return ELEMENT_STYLES[symbol] ?? DEFAULT_ELEMENT_STYLE;
}
