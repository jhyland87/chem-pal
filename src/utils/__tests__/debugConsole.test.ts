import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub the chemistry helper modules so importing debugConsole has no real
// side effects and the exposed API surface is deterministic.
vi.mock('@/helpers/cas', () => ({
  findCAS: vi.fn(),
  getCASByName: vi.fn(),
  getIUPACName: vi.fn(),
  getNamesByCAS: vi.fn(),
  isCAS: vi.fn(),
}));
vi.mock('@/helpers/pubchem', () => ({
  executeSDQSearch: vi.fn(),
  getCompoundNameFromAlias: vi.fn(),
  getRankedNamesByName: vi.fn(),
  isSimpleName: vi.fn(),
  suggestAlternativeSearch: vi.fn(async () => ['result']),
}));
vi.mock('@/helpers/smiles', () => ({
  extractSmiles: vi.fn(),
  isProbablyValidSmiles: vi.fn(),
  looksLikeSmiles: vi.fn(),
  parseStructurePrefix: vi.fn(),
  resolveQueryForSearch: vi.fn(),
  resolveSmiles: vi.fn(),
}));
vi.mock('@/utils/Cactus', () => ({ Cactus: class {} }));
// Only the install-source probe is stubbed; parseReleaseNotes stays real so the
// changelog-preview assertions exercise the same parser the prompt uses.
vi.mock('@/helpers/updates', async (importActual) => ({
  ...(await importActual<typeof import('@/helpers/updates')>()),
  getInstallSource: vi.fn(() => 'manual'),
}));
vi.mock('@/utils/storage', () => ({
  cstorage: { local: { set: vi.fn(async () => {}), remove: vi.fn(async () => {}) } },
}));

import { suggestAlternativeSearch } from '@/helpers/pubchem';
import { getInstallSource, parseReleaseNotes } from '@/helpers/updates';
import semver from 'semver';
import { cstorage } from '@/utils/storage';
import { exposeDebugApi } from '@/utils/debugConsole';

describe('exposeDebugApi', () => {
  beforeEach(() => {
    delete (window as { chempal?: unknown }).chempal;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (window as { chempal?: unknown }).chempal;
    vi.restoreAllMocks();
  });

  it('attaches the chempal helper object to window', () => {
    exposeDebugApi();
    expect(window.chempal).toBeDefined();
    expect(typeof window.chempal?.resolveSmiles).toBe('function');
    expect(typeof window.chempal?.help).toBe('function');
    expect(window.chempal?.Cactus).toBeDefined();
  });

  it('exposes the IndexedDB inspection helpers', () => {
    exposeDebugApi();
    expect(typeof window.chempal?.getProductById).toBe('function');
    expect(typeof window.chempal?.getProductPriceHistory).toBe('function');
    expect(typeof window.chempal?.getProductCache).toBe('function');
    expect(typeof window.chempal?.getQueryCache).toBe('function');
    expect(typeof window.chempal?.getSearchResults).toBe('function');
    expect(typeof window.chempal?.getSearchHistory).toBe('function');
    expect(typeof window.chempal?.getExcludedProducts).toBe('function');
  });

  it('exposes the fuzzy-filter probes', () => {
    exposeDebugApi();
    expect(typeof window.chempal?.fuzzTest).toBe('function');
    expect(typeof window.chempal?.astTest).toBe('function');
    expect(typeof window.chempal?.getCachedTitles).toBe('function');
  });

  describe('update-prompt simulation', () => {
    /** Reads the object written to a storage key by the first `set` call. */
    const written = (key: string) =>
      vi.mocked(cstorage.local.set).mock.calls[0][0][key] as Record<string, never>;

    it('exposes the update helpers', () => {
      exposeDebugApi();
      expect(typeof window.chempal?.simulateUpdate).toBe('function');
      expect(typeof window.chempal?.simulateWebstoreUpdate).toBe('function');
      expect(typeof window.chempal?.resetUpdatePrompt).toBe('function');
    });

    it('seeds update_check inside the throttle window so no poll fires', async () => {
      exposeDebugApi();
      await window.chempal?.simulateUpdate('1.3.0');

      const record = written('update_check');
      expect(record).toMatchObject({ latestVersion: '1.3.0', notesVersion: '1.3.0' });
      // A fresh timestamp keeps the mount effect on the cached-result path.
      expect(Date.now() - Number(record.lastCheckedAt)).toBeLessThan(1000);
      // Any prior dismissal must not survive, or the prompt stays hidden.
      expect(record.dismissedVersion).toBeUndefined();
      expect(Object.keys(record.notes).length).toBeGreaterThan(0);
    });

    it('supports simulating a release with no notes', async () => {
      exposeDebugApi();
      await window.chempal?.simulateUpdate('1.3.0', { notes: false });
      expect(written('update_check').notes).toEqual([]);
    });

    it('defaults to the next minor so it outranks the running build', async () => {
      exposeDebugApi();
      await window.chempal?.simulateUpdate();

      const version = String(written('update_check').latestVersion);
      expect(semver.valid(version)).not.toBeNull();
      expect(semver.gt(version, __APP_VERSION__)).toBe(true);
      expect(version).toBe(semver.inc(__APP_VERSION__, 'minor'));
    });

    // The whole point of the default: previewing what the next release ships.
    // Straight after a release [Unreleased] is empty, so the sample notes stand
    // in — asserting the section always has entries would fail on release day.
    it('defaults the notes to the CHANGELOG [Unreleased] section', async () => {
      exposeDebugApi();
      await window.chempal?.simulateUpdate();

      const unreleased = parseReleaseNotes(__CHANGELOG_UNRELEASED__);
      const notes = written('update_check').notes;
      expect(Object.keys(notes).length).toBeGreaterThan(0);
      if (unreleased.length > 0) expect(notes).toEqual(unreleased);
    });

    // The Web Store branch is gated on the install source, so on an unpacked
    // build this would otherwise write a record that nothing ever reads.
    it('warns instead of silently no-opping when the install source is manual', async () => {
      vi.mocked(getInstallSource).mockReturnValue('manual');
      exposeDebugApi();
      await window.chempal?.simulateWebstoreUpdate('1.3.0');

      expect(written('update_pending')).toMatchObject({ version: '1.3.0' });
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('update_url'));
    });

    it('confirms rather than warns when the build looks Web Store installed', async () => {
      vi.mocked(getInstallSource).mockReturnValue('webstore');
      exposeDebugApi();
      await window.chempal?.simulateWebstoreUpdate('1.3.0');
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('warns when simulateUpdate is used on a Web Store build', async () => {
      vi.mocked(getInstallSource).mockReturnValue('webstore');
      exposeDebugApi();
      await window.chempal?.simulateUpdate('1.3.0');
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('simulateWebstoreUpdate'));
    });

    it('clears both keys on reset', async () => {
      exposeDebugApi();
      await window.chempal?.resetUpdatePrompt();
      expect(cstorage.local.remove).toHaveBeenCalledWith(['update_check', 'update_pending']);
    });
  });

  it('logs a readiness banner', () => {
    exposeDebugApi();
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('ChemPal debug helpers ready'),
      expect.any(String),
    );
  });

  it('help() prints usage to the console', () => {
    exposeDebugApi();
    (console.info as ReturnType<typeof vi.fn>).mockClear();
    window.chempal?.help();
    expect(console.info).toHaveBeenCalledTimes(1);
    const [message] = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(message).toContain('ChemPal debug helpers');
    expect(message).toContain('SMILES:');
    expect(message).toContain('Fuzzy:');
  });

  it('suggestAlternativeSearch wrapper lowercases and Set-wraps the excluded array', async () => {
    exposeDebugApi();
    await window.chempal?.suggestAlternativeSearch('Aspirin', ['ASPIRIN', 'Ibuprofen']);
    expect(suggestAlternativeSearch).toHaveBeenCalledTimes(1);
    const [query, excluded] = (suggestAlternativeSearch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(query).toBe('Aspirin');
    expect(excluded).toBeInstanceOf(Set);
    expect(excluded.has('aspirin')).toBe(true);
    expect(excluded.has('ibuprofen')).toBe(true);
  });

  it('suggestAlternativeSearch wrapper defaults excluded to an empty Set', async () => {
    exposeDebugApi();
    await window.chempal?.suggestAlternativeSearch('aspirin');
    const [, excluded] = (suggestAlternativeSearch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(excluded).toBeInstanceOf(Set);
    expect(excluded.size).toBe(0);
  });
});
