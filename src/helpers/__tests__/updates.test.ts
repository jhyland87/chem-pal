import {
  getAvailableUpdate,
  getInstallSource,
  getLatestRelease,
  getReleaseNotes,
  normalizeTag,
  parseReleaseNotes,
} from '@/helpers/updates';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

/** Builds a GitHub release payload, overridable per test. */
function release(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: 'v9.9.9',
    html_url: 'https://github.com/owner/repo/releases/tag/v9.9.9',
    draft: false,
    prerelease: false,
    ...overrides,
  };
}

/** Makes `fetch` resolve with the given JSON body and status. */
function mockResponse(body: unknown, { ok = true, status = 200 } = {}) {
  fetchMock.mockImplementation(() =>
    Promise.resolve({ ok, status, json: () => Promise.resolve(body) }),
  );
}

/** Installs a `chrome.runtime.getManifest` stub returning the given manifest. */
function mockManifest(manifest: Record<string, unknown>) {
  const globalWithChrome = globalThis as unknown as { chrome: Record<string, unknown> };
  globalWithChrome.chrome = {
    ...globalWithChrome.chrome,
    runtime: { getManifest: () => manifest },
  };
}

describe('normalizeTag', () => {
  it.each([
    ['v1.3.0', '1.3.0'],
    ['V1.3.0', '1.3.0'],
    ['1.3.0', '1.3.0'],
    ['v2.0.0-beta.1', '2.0.0-beta.1'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeTag(input)).toBe(expected);
  });

  it.each(['release-x', '1.3', '', '2024-05-release'])('returns undefined for %s', (input) => {
    expect(normalizeTag(input)).toBeUndefined();
  });
});

describe('getInstallSource', () => {
  it('reports webstore when the runtime manifest carries an update_url', () => {
    mockManifest({ update_url: 'https://clients2.google.com/service/update2/crx' });
    expect(getInstallSource()).toBe('webstore');
  });

  it('reports manual when there is no update_url', () => {
    mockManifest({ version: '1.2.0' });
    expect(getInstallSource()).toBe('manual');
  });

  it('reports manual when update_url is present but empty', () => {
    mockManifest({ update_url: '' });
    expect(getInstallSource()).toBe('manual');
  });
});

describe('getLatestRelease', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns the release payload on success', async () => {
    mockResponse(release());
    await expect(getLatestRelease()).resolves.toMatchObject({ tag_name: 'v9.9.9' });
  });

  it('returns undefined on a 403 rate-limit response', async () => {
    mockResponse({ message: 'API rate limit exceeded' }, { ok: false, status: 403 });
    await expect(getLatestRelease()).resolves.toBeUndefined();
  });

  it('returns undefined when the network request rejects', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    await expect(getLatestRelease()).resolves.toBeUndefined();
  });

  it("returns undefined for a body that isn't a release", async () => {
    mockResponse({ message: 'Not Found', documentation_url: 'https://docs.github.com' });
    await expect(getLatestRelease()).resolves.toBeUndefined();
  });
});

describe('parseReleaseNotes', () => {
  it('groups bullets under their headings', () => {
    const body = [
      '### Added',
      '',
      '- Options page',
      '- Advanced mode',
      '',
      '### Fixed',
      '',
      '- Search failing to return results',
    ].join('\n');

    expect(parseReleaseNotes(body)).toEqual([
      { title: 'Added', items: ['Options page', 'Advanced mode'] },
      { title: 'Fixed', items: ['Search failing to return results'] },
    ]);
  });

  it('keeps bullets that appear before any heading', () => {
    expect(parseReleaseNotes('- First\n- Second')).toEqual([{ items: ['First', 'Second'] }]);
  });

  // The v1.2.0 release body was exactly this and nothing else.
  it('returns nothing for a body that is only the Full Changelog link', () => {
    expect(
      parseReleaseNotes(
        '**Full Changelog**: https://github.com/jhyland87/chem-pal/compare/v1.1.0...v1.2.0',
      ),
    ).toEqual([]);
  });

  it('drops the Full Changelog line but keeps real content', () => {
    const body = '### Added\n\n- Thing\n\n**Full Changelog**: https://example.com/compare';
    expect(parseReleaseNotes(body)).toEqual([{ title: 'Added', items: ['Thing'] }]);
  });

  it('strips markdown emphasis, code, and links', () => {
    const body = '- Fixed **search** in `ResultsTable` — see [#42](https://example.com/42)';
    expect(parseReleaseNotes(body)).toEqual([
      { items: ['Fixed search in ResultsTable — see #42'] },
    ]);
  });

  it('folds wrapped continuation lines into their bullet', () => {
    const body =
      '### Changed\n\n- Improved reagent-grade parsing, so more\n  products report a grade.';
    expect(parseReleaseNotes(body)).toEqual([
      {
        title: 'Changed',
        items: ['Improved reagent-grade parsing, so more products report a grade.'],
      },
    ]);
  });

  it('ignores headings that have no bullets', () => {
    expect(parseReleaseNotes('### Added\n\nSome prose with no bullets.\n')).toEqual([]);
  });

  it.each([undefined, '', '   '])('returns an empty list for %p', (body) => {
    expect(parseReleaseNotes(body)).toEqual([]);
  });

  it('caps runaway bodies', () => {
    const items = Array.from({ length: 40 }, (_, index) => `- Item ${index}`).join('\n');
    const [section] = parseReleaseNotes(`### Added\n\n${items}`);
    expect(section.items).toHaveLength(12);
  });
});

describe('getReleaseNotes', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('looks the release up by tag and parses its body', async () => {
    mockResponse(release({ tag_name: 'v1.3.0', body: '### Fixed\n\n- A bug' }));
    await expect(getReleaseNotes('1.3.0')).resolves.toEqual({
      releaseUrl: 'https://github.com/owner/repo/releases/tag/v9.9.9',
      notes: [{ title: 'Fixed', items: ['A bug'] }],
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/releases/tags/v1.3.0'));
  });

  it('accepts a version that already carries a v prefix', async () => {
    mockResponse(release());
    await getReleaseNotes('v1.3.0');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/releases/tags/v1.3.0'));
  });

  it("returns undefined when the release can't be fetched", async () => {
    mockResponse({ message: 'Not Found' }, { ok: false, status: 404 });
    await expect(getReleaseNotes('1.3.0')).resolves.toBeUndefined();
  });
});

describe('getAvailableUpdate', () => {
  // __APP_VERSION__ comes from package.json via tools/buildDefines.js.
  const current = __APP_VERSION__;

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports an update when the latest tag is newer', async () => {
    mockResponse(release({ tag_name: 'v99.0.0', html_url: 'https://example.com/r' }));
    await expect(getAvailableUpdate()).resolves.toEqual({
      version: '99.0.0',
      releaseUrl: 'https://example.com/r',
      notes: [],
    });
  });

  it('includes the parsed release notes', async () => {
    mockResponse(release({ tag_name: 'v99.0.0', body: '### Added\n\n- Options page\n' }));
    const update = await getAvailableUpdate();
    expect(update?.notes).toEqual([{ title: 'Added', items: ['Options page'] }]);
  });

  it('tolerates a null body', async () => {
    mockResponse(release({ tag_name: 'v99.0.0', body: null }));
    const update = await getAvailableUpdate();
    expect(update?.notes).toEqual([]);
  });

  it('reports no update when the latest tag equals the running version', async () => {
    mockResponse(release({ tag_name: `v${current}` }));
    await expect(getAvailableUpdate()).resolves.toBeUndefined();
  });

  // Regression: the original implementation used semver.satisfies(current, tag),
  // which reported "update available" exactly when the user was up to date.
  it('reports no update when the latest tag is older than the running version', async () => {
    mockResponse(release({ tag_name: 'v0.0.1' }));
    await expect(getAvailableUpdate()).resolves.toBeUndefined();
  });

  it('ignores releases flagged as prerelease', async () => {
    mockResponse(release({ tag_name: 'v99.0.0', prerelease: true }));
    await expect(getAvailableUpdate()).resolves.toBeUndefined();
  });

  it('ignores releases flagged as draft', async () => {
    mockResponse(release({ tag_name: 'v99.0.0', draft: true }));
    await expect(getAvailableUpdate()).resolves.toBeUndefined();
  });

  it('ignores prerelease tags even when the flags are unset', async () => {
    mockResponse(release({ tag_name: 'v99.0.0-beta.1' }));
    await expect(getAvailableUpdate()).resolves.toBeUndefined();
  });

  it("ignores tags that aren't valid semver", async () => {
    mockResponse(release({ tag_name: 'nightly' }));
    await expect(getAvailableUpdate()).resolves.toBeUndefined();
  });

  it("returns undefined when the release can't be fetched", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    await expect(getAvailableUpdate()).resolves.toBeUndefined();
  });
});
