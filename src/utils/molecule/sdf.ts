/**
 * Minimal parser for MDL SDF / molfile V2000 records, producing the atom and bond
 * lists needed to draw a ball-and-stick model.
 * @module
 * @categoryDescription Utils
 * @showCategories
 */

/**
 * A single atom from an SDF atom block.
 * @category Utils
 * @group Types
 * @source
 */
export interface MoleculeAtom {
  /** Element symbol as written in the record, e.g. `'C'` or `'Cl'`. */
  symbol: string;
  /** Cartesian coordinates in angstroms. `z` is 0 throughout a 2D record. */
  x: number;
  y: number;
  z: number;
}

/**
 * A single bond from an SDF bond block, with **zero-based** atom indices (the record
 * itself is one-based).
 * @category Utils
 * @group Types
 * @source
 */
export interface MoleculeBond {
  /** Index into {@link Molecule.atoms} of the first atom. */
  from: number;
  /** Index into {@link Molecule.atoms} of the second atom. */
  to: number;
  /** Bond order: 1 single, 2 double, 3 triple, 4 aromatic. */
  order: number;
}

/**
 * A parsed molecular structure.
 * @category Utils
 * @group Types
 * @source
 */
export interface Molecule {
  /** Every atom in the record, in file order. */
  atoms: MoleculeAtom[];
  /** Every bond in the record. */
  bonds: MoleculeBond[];
  /**
   * True when every atom shares the same z coordinate, so the structure has no depth.
   * Always true for a `record_type=2d` response, but also true for genuinely flat 3D
   * records such as benzene — which is why it is measured from the coordinates rather
   * than taken from the record type that was requested.
   */
  isPlanar: boolean;
}

/** Line index of the counts line in a molfile: three header lines precede it. */
const COUNTS_LINE_INDEX = 3;

/** Largest coordinate spread, in angstroms, still considered flat. */
const PLANAR_EPSILON = 1e-6;

/**
 * Reads a fixed-width numeric field out of a record line.
 *
 * Molfile fields are positional, not whitespace-delimited: a molecule with 100+ atoms
 * writes its counts line as `100100`, which any `split(/\s+/)` approach silently
 * misreads. Slicing by column is the only correct way to read them.
 * @param line - The record line to read from
 * @param start - Zero-based inclusive start column
 * @param end - Zero-based exclusive end column
 * @returns The parsed number, or undefined if the field is blank or not numeric
 * @source
 */
function readField(line: string, start: number, end: number): number | undefined {
  const raw = line.slice(start, end).trim();
  if (raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Reads a fixed-width integer field, truncating toward zero.
 *
 * `Number()` + `Math.trunc` rather than `parseInt`, which would ignore trailing garbage
 * in a malformed field instead of surfacing it.
 * @param line - The record line to read from
 * @param start - Zero-based inclusive start column
 * @param end - Zero-based exclusive end column
 * @returns The parsed integer, or undefined if the field is blank or not numeric
 * @source
 */
function readIntField(line: string, start: number, end: number): number | undefined {
  const value = readField(line, start, end);
  return value === undefined ? undefined : Math.trunc(value);
}

/**
 * Parses the atom block into {@link MoleculeAtom}s. Atom lines are
 * `xxxxxxxxxxyyyyyyyyyyzzzzzzzzzz aaa …` — three 10-column coordinates followed by the
 * element symbol at columns 31-33.
 * @param lines - All lines of the record
 * @param count - How many atom lines to read
 * @returns The parsed atoms; lines that are truncated or non-numeric are skipped
 * @source
 */
function parseAtomBlock(lines: string[], count: number): MoleculeAtom[] {
  const atoms: MoleculeAtom[] = [];
  for (let i = 0; i < count; i++) {
    const line = lines[COUNTS_LINE_INDEX + 1 + i];
    if (line === undefined) break;
    const x = readField(line, 0, 10);
    const y = readField(line, 10, 20);
    const z = readField(line, 20, 30);
    const symbol = line.slice(31, 34).trim();
    if (x === undefined || y === undefined || z === undefined || symbol === '') continue;
    atoms.push({ symbol, x, y, z });
  }
  return atoms;
}

/**
 * Parses the bond block into {@link MoleculeBond}s, converting the record's one-based
 * atom references to zero-based indices and dropping any that fall outside the atom list.
 * @param lines - All lines of the record
 * @param atomCount - Number of atom lines preceding the bond block
 * @param count - How many bond lines to read
 * @returns The parsed bonds
 * @source
 */
function parseBondBlock(lines: string[], atomCount: number, count: number): MoleculeBond[] {
  const bonds: MoleculeBond[] = [];
  for (let i = 0; i < count; i++) {
    const line = lines[COUNTS_LINE_INDEX + 1 + atomCount + i];
    if (line === undefined) break;
    const from = readIntField(line, 0, 3);
    const to = readIntField(line, 3, 6);
    const order = readIntField(line, 6, 9) ?? 1;
    if (from === undefined || to === undefined) continue;
    if (from < 1 || to < 1 || from > atomCount || to > atomCount || from === to) continue;
    bonds.push({ from: from - 1, to: to - 1, order });
  }
  return bonds;
}

/**
 * Parses an MDL SDF / molfile V2000 record into atoms and bonds.
 *
 * Only the counts line, atom block and bond block are read — charge, isotope and property
 * lines after `M  END` are ignored, as none of them affect a ball-and-stick rendering.
 * Malformed or empty records return undefined rather than throwing, so a caller can fall
 * straight through to its next option.
 * @category Utils
 * @group Parsers
 * @param text - The raw SDF text as returned by PubChem's PUG-REST `SDF` operation
 * @returns The parsed molecule, or undefined if the record has no usable atoms
 * @example
 * ```typescript
 * const molecule = parseSdf(await getStructureSdf(962));
 * // { atoms: [{ symbol: 'O', x: 0, y: 0, z: 0 }, …], bonds: [{ from: 0, to: 1, order: 1 }, …],
 * //   isPlanar: false }
 * parseSdf('not a molfile'); // undefined
 * ```
 * @source
 */
export function parseSdf(text: string): Molecule | undefined {
  const lines = text.split(/\r?\n/);
  const countsLine = lines[COUNTS_LINE_INDEX];
  if (countsLine === undefined) return undefined;

  const atomCount = readIntField(countsLine, 0, 3);
  const bondCount = readIntField(countsLine, 3, 6);
  if (atomCount === undefined || atomCount <= 0) return undefined;

  const atoms = parseAtomBlock(lines, atomCount);
  if (atoms.length === 0) return undefined;

  const bonds = parseBondBlock(lines, atomCount, bondCount ?? 0);

  const firstZ = atoms[0].z;
  const isPlanar = atoms.every((atom) => Math.abs(atom.z - firstZ) < PLANAR_EPSILON);

  return { atoms, bonds, isPlanar };
}

/**
 * Returns a copy of a molecule with every hydrogen removed, along with the bonds that
 * touched them, reindexing the surviving bonds. Hiding hydrogens makes the carbon
 * skeleton legible at small render sizes.
 *
 * A molecule that is *entirely* hydrogen (H2) is returned unchanged, since stripping it
 * would leave nothing to draw.
 * @category Utils
 * @group Parsers
 * @param molecule - The molecule to strip
 * @returns A new molecule without hydrogens, or the original if it is all hydrogen
 * @example
 * ```typescript
 * stripHydrogens({ atoms: [{ symbol: 'C', … }, { symbol: 'H', … }], bonds: [{ from: 0, to: 1, order: 1 }], isPlanar: false });
 * // { atoms: [{ symbol: 'C', … }], bonds: [], isPlanar: false }
 * ```
 * @source
 */
export function stripHydrogens(molecule: Molecule): Molecule {
  const keptIndices = new Map<number, number>();
  const atoms: MoleculeAtom[] = [];
  for (const [index, atom] of molecule.atoms.entries()) {
    if (atom.symbol === 'H') continue;
    keptIndices.set(index, atoms.length);
    atoms.push(atom);
  }
  if (atoms.length === 0) return molecule;

  const bonds: MoleculeBond[] = [];
  for (const bond of molecule.bonds) {
    const from = keptIndices.get(bond.from);
    const to = keptIndices.get(bond.to);
    if (from === undefined || to === undefined) continue;
    bonds.push({ from, to, order: bond.order });
  }

  return { atoms, bonds, isPlanar: molecule.isPlanar };
}
