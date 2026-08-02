import { CACHE } from '@/constants/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Configure a measurement id so the sender is active.
vi.mock('@/../config.json', async (importOriginal) => {
  const actual = await importOriginal<{ default: Record<string, unknown> }>();
  const analytics = { measurementId: 'G-TEST123' };
  return { ...actual, default: { ...actual.default, analytics }, analytics };
});

// In-memory local storage (client id persistence + the opt-out setting read).
const { localStore } = vi.hoisted(() => ({ localStore: {} as Record<string, unknown> }));
vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: {
      get: async (key: string) => ({ [key]: localStore[key] }),
      set: async (items: Record<string, unknown>) => {
        Object.assign(localStore, items);
      },
    },
  },
}));

const { trackEvent, trackRenderError } = await import('@/helpers/analytics');

const fetchMock = vi.fn();

describe('analytics (GA4 /g/collect)', () => {
  beforeEach(() => {
    for (const key of Object.keys(localStore)) delete localStore[key];
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts a render_error event to /g/collect with the measurement id (no secret)', async () => {
    await trackRenderError(new Error('kaboom'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [rawUrl, init] = fetchMock.mock.calls[0];
    const url = new URL(rawUrl);
    expect(url.pathname).toBe('/g/collect');
    expect(url.searchParams.get('v')).toBe('2');
    expect(url.searchParams.get('tid')).toBe('G-TEST123');
    expect(url.searchParams.get('en')).toBe('render_error');
    expect(url.searchParams.get('cid')).toBeTruthy();
    expect(rawUrl).not.toContain('api_secret');
    expect(init.method).toBe('POST');
    expect(init.mode).toBe('no-cors');
    expect(init.keepalive).toBe(true);

    expect(url.searchParams.get('ep.error_name')).toBe('Error');
    expect(url.searchParams.get('ep.error_message')).toContain('kaboom');
  });

  it('truncates text params to the GA4 length limit and sends numbers as epn.*', async () => {
    await trackEvent('render_error', { error_message: 'x'.repeat(500), count: 3 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('ep.error_message')?.length).toBe(100);
    expect(url.searchParams.get('epn.count')).toBe('3');
  });

  it('never throws when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(trackRenderError(new Error('boom'))).resolves.toBeUndefined();
  });

  it('sends nothing when the user has opted out (shareUsageData: false)', async () => {
    localStore[CACHE.USER_SETTINGS] = { shareUsageData: false };
    await trackRenderError(new Error('boom'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still sends when the setting is absent (opt-out default off)', async () => {
    await trackEvent('search_query', { search_term: 'acetone' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
