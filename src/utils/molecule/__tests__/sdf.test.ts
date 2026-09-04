import { describe, expect, it } from 'vitest';
import { parseSdf, stripHydrogens, type Molecule } from '@/utils/molecule/sdf';

/** Builds a fixed-width V2000 atom line: three 10-column coords, symbol at columns 31-33. */
function atomLine(x: number, y: number, z: number, symbol: string): string {
  const coords = [x, y, z].map((value) => value.toFixed(4).padStart(10)).join('');
  return `${coords} ${symbol.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`;
}

/** Builds a fixed-width V2000 bond line with one-based atom indices. */
function bondLine(from: number, to: number, order: number): string {
  return `${String(from).padStart(3)}${String(to).padStart(3)}${String(order).padStart(3)}`;
}

/** Assembles a complete molfile from atom and bond lines. */
function molfile(atoms: string[], bonds: string[]): string {
  const counts = `${String(atoms.length).padStart(3)}${String(bonds.length).padStart(3)}  0     0  0  0  0  0  0999 V2000`;
  return ['2519', '  -OEChem-', '', counts, ...atoms, ...bonds, 'M  END', '$$$$'].join('\n');
}

/** Water, with real 3D coordinates. */
const WATER = molfile(
  [
    atomLine(0.0, 0.0, 0.1173, 'O'),
    atomLine(0.0, 0.7572, -0.4692, 'H'),
    atomLine(0.0, -0.7572, -0.4692, 'H'),
  ],
  [bondLine(1, 2, 1), bondLine(1, 3, 1)],
);

describe.concurrent('parseSdf', () => {
  it('parses atoms and bonds from a 3D record', () => {
    const molecule = parseSdf(WATER);
    expect(molecule).toBeDefined();
    expect(molecule?.atoms).toHaveLength(3);
    expect(molecule?.bonds).toHaveLength(2);
    expect(molecule?.atoms[0]).toEqual({ symbol: 'O', x: 0, y: 0, z: 0.1173 });
  });

  it('converts one-based bond references to zero-based indices', () => {
    expect(parseSdf(WATER)?.bonds[0]).toEqual({ from: 0, to: 1, order: 1 });
  });

  it('flags a record whose atoms all share a z coordinate as planar', () => {
    const flat = molfile([atomLine(3, 0, 0, 'Cl'), atomLine(2, 0, 0, 'Na')], [bondLine(1, 2, 1)]);
    expect(parseSdf(flat)?.isPlanar).toBe(true);
    expect(parseSdf(WATER)?.isPlanar).toBe(false);
  });

  it('reads fixed-width columns when 100+ atoms and bonds run the counts line together', () => {
    // The counts line becomes "100100" with no separator — a whitespace split reads that
    // as a single 100100 token and loses the structure entirely.
    const atoms = Array.from({ length: 100 }, (_unused, index) =>
      atomLine(index * 0.1, 0, index * 0.2, 'C'),
    );
    const bonds = Array.from({ length: 100 }, (_unused, index) =>
      bondLine((index % 99) + 1, ((index + 1) % 99) + 1, 1),
    );
    const parsed = parseSdf(molfile(atoms, bonds));

    expect(molfile(atoms, bonds).split('\n')[3]).toMatch(/^100100/);
    expect(parsed?.atoms).toHaveLength(100);
    expect(parsed?.bonds).toHaveLength(100);
  });

  it('separates coordinates that abut with no space between them', () => {
    // "-10.1234" fills its whole 10-column field, so the next field starts immediately.
    const line = `${'-10.1234'.padStart(10)}${'-11.2345'.padStart(10)}${'-1.0000'.padStart(10)} C  `;
    const parsed = parseSdf(molfile([line], []));
    expect(parsed?.atoms[0]).toEqual({ symbol: 'C', x: -10.1234, y: -11.2345, z: -1 });
  });

  it('drops bonds that reference atoms outside the atom block', () => {
    const parsed = parseSdf(
      molfile(
        [atomLine(0, 0, 0, 'C'), atomLine(1, 0, 0, 'O')],
        [bondLine(1, 9, 1), bondLine(1, 2, 2)],
      ),
    );
    expect(parsed?.bonds).toEqual([{ from: 0, to: 1, order: 2 }]);
  });

  it.each([
    ['empty string', ''],
    ['prose', 'not a molfile at all'],
    ['header with no counts line', 'title\nprogram\ncomment'],
    ['zero atoms', molfile([], [])],
  ])('returns undefined for %s', (_label, input) => {
    expect(parseSdf(input)).toBeUndefined();
  });

  it('parses a record with CRLF line endings', () => {
    expect(parseSdf(WATER.replaceAll('\n', '\r\n'))?.atoms).toHaveLength(3);
  });
});

describe.concurrent('stripHydrogens', () => {
  const methane: Molecule = {
    atoms: [
      { symbol: 'C', x: 0, y: 0, z: 0 },
      { symbol: 'H', x: 1, y: 0, z: 0 },
      { symbol: 'O', x: 0, y: 1, z: 0 },
      { symbol: 'H', x: 0, y: 0, z: 1 },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 2 },
      { from: 2, to: 3, order: 1 },
    ],
    isPlanar: false,
  };

  it('removes hydrogens and the bonds touching them', () => {
    const stripped = stripHydrogens(methane);
    expect(stripped.atoms.map((atom) => atom.symbol)).toEqual(['C', 'O']);
    expect(stripped.bonds).toHaveLength(1);
  });

  it('reindexes surviving bonds onto the new atom positions', () => {
    expect(stripHydrogens(methane).bonds[0]).toEqual({ from: 0, to: 1, order: 2 });
  });

  it('leaves the original molecule untouched', () => {
    stripHydrogens(methane);
    expect(methane.atoms).toHaveLength(4);
    expect(methane.bonds).toHaveLength(3);
  });

  it('returns the molecule unchanged when it is entirely hydrogen', () => {
    const dihydrogen: Molecule = {
      atoms: [
        { symbol: 'H', x: 0, y: 0, z: 0 },
        { symbol: 'H', x: 0.74, y: 0, z: 0 },
      ],
      bonds: [{ from: 0, to: 1, order: 1 }],
      isPlanar: true,
    };
    expect(stripHydrogens(dihydrogen)).toBe(dihydrogen);
  });
});
