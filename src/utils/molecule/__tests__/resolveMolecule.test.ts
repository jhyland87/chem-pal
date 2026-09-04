import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveMolecule } from '@/utils/molecule/resolveMolecule';

/** A minimal but valid 3D molfile: two carbons with one bond. */
const SDF = [
  '180',
  '  -OEChem-',
  '',
  '  2  1  0     0  0  0  0  0  0999 V2000',
  '    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0',
  '    1.5000    0.0000    0.7000 C   0  0  0  0  0  0  0  0  0  0  0  0',
  '  1  2  1  0  0  0  0',
  'M  END',
].join('\n');

/** Names PubChem is pretending to know about, and the CID each maps to. */
const KNOWN_NAMES: Record<string, number> = { acetone: 180, ethanol: 702 };

/** URLs the mocked PubChem answered, in call order — asserted to prove routing. */
let requested: string[] = [];

/** Routes a mocked PUG-REST request to a canned response. */
function respond(url: string): Response {
  const nameMatch = url.match(/\/compound\/name\/([^/]+)\/cids\/JSON/);
  if (nameMatch) {
    const cid = KNOWN_NAMES[decodeURIComponent(nameMatch[1]).toLowerCase()];
    return cid
      ? new Response(JSON.stringify({ IdentifierList: { CID: [cid] } }), { status: 200 })
      : new Response('Not Found', { status: 404 });
  }
  if (/\/compound\/cid\/\d+\/SDF\?record_type=3d/.test(url)) {
    return new Response(SDF, { status: 200 });
  }
  return new Response('Not Found', { status: 404 });
}

describe('resolveMolecule', () => {
  beforeEach(() => {
    requested = [];
    vi.mocked(global.fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      return Promise.resolve(respond(url));
    });
  });

  it('resolves a plain name to a parsed structure', async () => {
    const resolved = await resolveMolecule('acetone');

    expect(resolved?.cid).toBe(180);
    expect(resolved?.recordType).toBe('3d');
    expect(resolved?.molecule.atoms).toHaveLength(2);
    expect(resolved?.molecule.bonds).toHaveLength(1);
  });

  it('uses the positive term of an advanced query, not the whole query string', async () => {
    const resolved = await resolveMolecule('acetone AND NOT sigma');

    expect(resolved?.cid).toBe(180);
    expect(requested.some((url) => url.includes('acetone'))).toBe(true);
    // The raw query would 404; it must never be sent as a name lookup.
    expect(requested.some((url) => url.includes('AND'))).toBe(false);
  });

  it('never depicts a negated term', async () => {
    const resolved = await resolveMolecule('ethanol AND NOT acetone');

    expect(resolved?.cid).toBe(702);
    expect(requested.some((url) => url.includes('acetone'))).toBe(false);
  });

  it('falls through to the next term when the first does not resolve', async () => {
    const resolved = await resolveMolecule('nosuchthing OR ethanol');

    expect(resolved?.cid).toBe(702);
  });

  it.each([
    ['an unknown compound', 'qqqqzzz'],
    ['an empty query', ''],
    ['whitespace only', '   '],
  ])('returns undefined for %s', async (_label, query) => {
    await expect(resolveMolecule(query)).resolves.toBeUndefined();
  });

  it('makes no network call for an empty query', async () => {
    await resolveMolecule('');

    expect(requested).toHaveLength(0);
  });
});
