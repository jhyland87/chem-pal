import { report as reportConfig } from '@/../config.json';
import type { Diagnostics } from '@/helpers/bugReport';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRecentErrors = vi.fn();

vi.mock('@/helpers/errorBuffer', async (importOriginal) => {
  // Keep the real formatErrorChain; only stub the storage-backed getRecentErrors.
  const actual = await importOriginal<typeof import('@/helpers/errorBuffer')>();
  return { ...actual, getRecentErrors: (...args: unknown[]) => getRecentErrors(...args) };
});
vi.mock('@/helpers/updates', () => ({
  getInstallSource: () => 'manual',
}));
vi.mock('@/utils/idbCache', () => ({
  getIdbStorageBreakdown: async () => ({ byStore: {}, totalBytes: 0 }),
  getSearchResultsRecord: async () => ({ data: [{}, {}, {}], query: 'acetone' }),
}));
vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: {
      get: async (key: string) => ({ [key]: { currency: 'USD', theme: 'dark' } }),
    },
  },
}));

const { collectDiagnostics, buildGithubUrl, buildGoogleFormUrl, formatLogs, formatMetadata } =
  await import('@/helpers/bugReport');

/**
 * Builds a complete Diagnostics object for the URL-builder tests, overridable
 * per test.
 */
function makeDiag(over: Partial<Diagnostics> = {}): Diagnostics {
  return {
    message: 'boom',
    stack: 'Error: boom\n  at doThing (app.js:1:1)',
    version: '1.6.1',
    userAgent: 'jsdom',
    language: 'en-US',
    url: 'chrome-extension://abc/index.html',
    action: 'n/a',
    installSource: 'manual',
    storage: 'Total: 0 KB across 0 store(s)',
    settings: '{ "currency": "USD" }',
    search: '(none)',
    recentErrors: [],
    timestamp: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

describe('buildGithubUrl', () => {
  it('targets issues/new with the template, labels, and prefilled fields', () => {
    const url = buildGithubUrl(makeDiag());
    const parsed = new URL(url);
    expect(parsed.pathname).toBe(`/${__GITHUB_OWNER__}/${__GITHUB_REPO__}/issues/new`);
    expect(parsed.searchParams.get('template')).toBe(reportConfig.github.template);
    expect(parsed.searchParams.get('labels')).toBe(reportConfig.github.labels.join(','));
    expect(parsed.searchParams.get('version')).toBe('1.6.1');
    expect(parsed.searchParams.get('title')).toBe('[Bug] boom');
  });

  it('truncates the logs field to keep the whole URL within budget', () => {
    const url = buildGithubUrl(makeDiag({ stack: 'x'.repeat(20000) }));
    expect(url.length).toBeLessThanOrEqual(reportConfig.maxChars.github);
    const logs = new URL(url).searchParams.get('logs') ?? '';
    expect(logs).toContain('truncated');
  });
});

describe('buildGoogleFormUrl', () => {
  it('targets the configured form and prefills the entry ids', () => {
    const url = buildGoogleFormUrl(makeDiag());
    expect(url).toBeDefined();
    const parsed = new URL(url ?? '');
    expect(parsed.pathname).toContain(reportConfig.googleForm.id);
    expect(parsed.searchParams.get(reportConfig.googleForm.entries.summary)).toBe('boom');
    expect(parsed.searchParams.get(reportConfig.googleForm.entries.version)).toBe('1.6.1');
  });

  it('truncates the logs entry to the form-specific budget', () => {
    const url = buildGoogleFormUrl(makeDiag({ stack: 'x'.repeat(5000) }));
    const logs = new URL(url ?? '').searchParams.get(reportConfig.googleForm.entries.logs) ?? '';
    expect(logs).toContain('truncated');
    expect(logs.length).toBeLessThan(reportConfig.maxChars.formLogs + 100);
  });
});

describe('collectDiagnostics', () => {
  beforeEach(() => {
    getRecentErrors.mockReset();
    getRecentErrors.mockResolvedValue([]);
  });

  it('leads with a specific error message and stack when given one', async () => {
    const diag = await collectDiagnostics(new Error('kaboom'), { action: 'render-crash' });
    expect(diag.message).toBe('kaboom');
    expect(diag.stack).toContain('kaboom');
    expect(diag.action).toBe('render-crash');
    expect(diag.installSource).toBe('manual');
  });

  it('folds the error cause chain into the stack', async () => {
    const err = new Error('outer failure', { cause: new Error('root cause') });
    const diag = await collectDiagnostics(err);
    expect(diag.stack).toContain('root cause');
    expect(diag.stack).toContain('Caused by:');
    expect(formatLogs(diag)).toContain('root cause');
  });

  it('falls back to the ring buffer for a manual report', async () => {
    getRecentErrors.mockResolvedValue([{ ts: 1, source: 'window', message: 'prior failure' }]);
    const diag = await collectDiagnostics();
    expect(diag.message).toBe('Manual bug report');
    expect(diag.stack).toBe('');
    expect(diag.recentErrors).toHaveLength(1);
    expect(formatLogs(diag)).toContain('prior failure');
  });

  it('includes the current user settings, surfaced in the metadata block', async () => {
    const diag = await collectDiagnostics();
    expect(diag.settings).toContain('"currency": "USD"');
    expect(diag.settings).toContain('"theme": "dark"');
    expect(formatMetadata(diag)).toContain('Settings:');
    expect(formatMetadata(diag)).toContain('"theme": "dark"');
  });

  it('includes the active search query and result count', async () => {
    const diag = await collectDiagnostics();
    expect(diag.search).toBe('"acetone" — 3 results');
    expect(formatMetadata(diag)).toContain('Search:');
    expect(formatMetadata(diag)).toContain('acetone');
  });
});
