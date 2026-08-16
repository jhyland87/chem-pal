import { CACHE } from '@/constants/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Configure a project API key so the sender is active.
vi.mock('@/../config.json', async (importOriginal) => {
  const actual = await importOriginal<{ default: Record<string, unknown> }>();
  const analytics = { apiKey: 'phc_test123', host: 'https://us.i.posthog.com' };
  return { ...actual, default: { ...actual.default, analytics }, analytics };
});

// In-memory local storage (distinct id persistence + the opt-out setting read).
const { localStore } = vi.hoisted(() => ({ localStore: {} as Record<string, unknown> }));
vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: {
      get: async (key: string) => ({ [key]: localStore[key] }),
      set: async (items: Record<string, unknown>) => {
        Object.assign(localStore, items);
      },
      remove: async (key: string) => {
        delete localStore[key];
      },
    },
  },
}));

const { trackEvent, trackRenderError } = await import('@/helpers/analytics');

const fetchMock = vi.fn();

/**
 * Parses the JSON body handed to `fetch` on the nth call.
 * @param index - Zero-based call index.
 * @returns The decoded PostHog capture payload.
 */
function payloadFromCall(index = 0) {
  const init = fetchMock.mock.calls[index][1];
  return JSON.parse(init.body);
}

describe('analytics (PostHog capture)', () => {
  beforeEach(() => {
    for (const key of Object.keys(localStore)) delete localStore[key];
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts a render_error event to the capture endpoint with the api key in the body', async () => {
    await trackRenderError(new Error('kaboom'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [rawUrl, init] = fetchMock.mock.calls[0];
    expect(rawUrl).toBe('https://us.i.posthog.com/i/v0/e/');
    // The key belongs in the body — a query-string key is silently ignored.
    expect(new URL(rawUrl).search).toBe('');
    expect(init.method).toBe('POST');
    expect(init.mode).toBe('no-cors');
    expect(init.keepalive).toBe(true);
    // no-cors rejects an explicit application/json Content-Type, which would
    // throw and silently kill every event. Let fetch stamp text/plain.
    expect(init.headers).toBeUndefined();

    const payload = payloadFromCall();
    expect(payload.api_key).toBe('phc_test123');
    expect(payload.event).toBe('render_error');
    expect(payload.distinct_id).toBeTruthy();
    expect(typeof payload.distinct_id).toBe('string');
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
    expect(payload.properties.error_name).toBe('Error');
    expect(payload.properties.error_message).toContain('kaboom');
  });

  it('marks every event anonymous and attributes the library', async () => {
    await trackEvent('search_query', { search_term: 'acetone' });
    const { properties } = payloadFromCall();
    expect(properties.$process_person_profile).toBe(false);
    expect(properties.$lib).toBe('chempal-extension');
    expect(properties.$lib_version).toBeTruthy();
  });

  it('truncates text params to the length limit and keeps numbers numeric', async () => {
    await trackEvent('render_error', { error_message: 'x'.repeat(500), count: 3 });
    const { properties } = payloadFromCall();
    expect(properties.error_message.length).toBe(100);
    expect(properties.count).toBe(3);
    expect(typeof properties.count).toBe('number');
  });

  it('reuses and persists a single distinct id across events', async () => {
    await trackEvent('search_query', { search_term: 'acetone' });
    await trackEvent('search_results', { search_term: 'acetone', result_count: 7 });

    const first = payloadFromCall(0).distinct_id;
    expect(payloadFromCall(1).distinct_id).toBe(first);
    expect(localStore[CACHE.ANALYTICS_DISTINCT_ID]).toBe(first);
  });

  it('does not reuse the retired GA client id, and clears it', async () => {
    localStore[CACHE.ANALYTICS_CLIENT_ID] = 'ga-legacy-id';
    await trackEvent('search_query', { search_term: 'acetone' });

    expect(payloadFromCall().distinct_id).not.toBe('ga-legacy-id');
    expect(localStore[CACHE.ANALYTICS_CLIENT_ID]).toBeUndefined();
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
