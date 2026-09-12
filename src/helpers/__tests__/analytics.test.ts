import { CACHE } from '@/constants/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// This file tests the real implementation, so opt out of the global stub in
// configs/vitest.setup.ts and the module's own MODE === "test" guard.
vi.unmock('@/helpers/analytics');

// Configure a project API key so the sender is active.
vi.mock('@/../config.json', async (importOriginal) => {
  const actual = await importOriginal<{ default: Record<string, unknown> }>();
  const analytics = { apiKey: 'phc_test123', host: 'https://us.i.posthog.com', paramValueLimit: 100 };
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

// analytics.ts reads chrome.runtime.OnInstalledReason. The global setup only
// provides chrome.i18n, so extend it here with a plain assignment — the shared
// afterEach calls vi.unstubAllGlobals(), which would strip a vi.stubGlobal.
Object.assign(globalThis, {
  chrome: {
    ...((globalThis as { chrome?: unknown }).chrome ?? {}),
    runtime: {
      OnInstalledReason: {
        INSTALL: 'install',
        UPDATE: 'update',
        CHROME_UPDATE: 'chrome_update',
        SHARED_MODULE_UPDATE: 'shared_module_update',
      },
    },
  },
});

const { CAPTURE_PATH, PARAM_VALUE_LIMIT, trackEvent, trackInstallOrUpgrade, trackRenderError } =
  await import('@/helpers/analytics');

/** The endpoint the sender is expected to POST to, built from the mocked host. */
const EXPECTED_ENDPOINT = `https://us.i.posthog.com${CAPTURE_PATH}`;

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
    // Bypass trackEvent's own MODE === "test" no-op so it takes the real path.
    vi.stubEnv('MODE', 'development');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts a $exception event to the capture endpoint with the api key in the body', async () => {
    await trackRenderError(new Error('kaboom'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [rawUrl, init] = fetchMock.mock.calls[0];
    expect(rawUrl).toBe(EXPECTED_ENDPOINT);
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
    expect(payload.event).toBe('$exception');
    expect(payload.distinct_id).toBeTruthy();
    expect(typeof payload.distinct_id).toBe('string');
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
    expect(payload.properties.error_name).toBe('Error');
    expect(payload.properties.error_message).toContain('kaboom');
  });

  it('shapes $exception_list like posthog-js captureException, with parsed stack frames', async () => {
    await trackRenderError(new Error('kaboom'));

    const { properties } = payloadFromCall();
    expect(properties.$exception_level).toBe('error');
    expect(properties.$exception_list).toHaveLength(1);

    const [exception] = properties.$exception_list;
    expect(exception.type).toBe('Error');
    expect(exception.value).toBe('kaboom');
    expect(exception.mechanism).toEqual({ type: 'generic', handled: true, synthetic: false });
    expect(exception.stacktrace.type).toBe('raw');

    // A real Error's .stack always has at least one frame for this test file.
    const frames = exception.stacktrace.frames;
    expect(frames.length).toBeGreaterThan(0);
    const frame = frames[frames.length - 1];
    expect(frame.platform).toBe('web:javascript');
    expect(typeof frame.filename).toBe('string');
    expect(typeof frame.lineno).toBe('number');
    expect(typeof frame.colno).toBe('number');
    expect(frame.in_app).toBe(true);
  });

  it('parses both V8 and Firefox stack frame formats, oldest frame last', async () => {
    const error = new Error('boom');
    error.stack = [
      'Error: boom',
      '    at innerFn (chrome-extension://abc/analytics.js:10:5)',
      '    at outerFn (chrome-extension://abc/main.js:20:15)',
    ].join('\n');
    await trackRenderError(error);
    const chromeFrames = payloadFromCall().properties.$exception_list[0].stacktrace.frames;
    expect(chromeFrames).toEqual([
      {
        platform: 'web:javascript',
        filename: 'chrome-extension://abc/main.js',
        function: 'outerFn',
        lineno: 20,
        colno: 15,
        in_app: true,
      },
      {
        platform: 'web:javascript',
        filename: 'chrome-extension://abc/analytics.js',
        function: 'innerFn',
        lineno: 10,
        colno: 5,
        in_app: true,
      },
    ]);

    const geckoError = new Error('boom');
    geckoError.stack = [
      'innerFn@moz-extension://abc/analytics.js:10:5',
      'outerFn@moz-extension://abc/main.js:20:15',
    ].join('\n');
    await trackRenderError(geckoError);
    const geckoFrames = payloadFromCall(1).properties.$exception_list[0].stacktrace.frames;
    expect(geckoFrames).toEqual([
      {
        platform: 'web:javascript',
        filename: 'moz-extension://abc/main.js',
        function: 'outerFn',
        lineno: 20,
        colno: 15,
        in_app: true,
      },
      {
        platform: 'web:javascript',
        filename: 'moz-extension://abc/analytics.js',
        function: 'innerFn',
        lineno: 10,
        colno: 5,
        in_app: true,
      },
    ]);
  });

  it('walks the Error.cause chain into additional $exception_list entries, always handled', async () => {
    const inner = new Error('inner boom');
    const outer = new Error('outer boom', { cause: inner });
    await trackRenderError(outer, { fatal: 1 });

    const list = payloadFromCall().properties.$exception_list;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      type: 'Error',
      value: 'outer boom',
      mechanism: { type: 'onuncaughtexception', handled: false, synthetic: false },
    });
    expect(list[1]).toMatchObject({
      type: 'Error',
      value: 'inner boom',
      mechanism: { type: 'generic', handled: true, synthetic: false },
    });
  });

  it('adds a flat error_cause property when the error has a cause', async () => {
    await trackRenderError(new Error('outer boom', { cause: new TypeError('inner boom') }));

    const { properties } = payloadFromCall();
    expect(properties.error_cause).toBe('TypeError: inner boom');
  });

  it('describes a non-Error cause as a plain string', async () => {
    await trackRenderError(new Error('outer boom', { cause: 'disk full' }));

    const { properties } = payloadFromCall();
    expect(properties.error_cause).toBe('disk full');
  });

  it('omits error_cause when the error has no cause', async () => {
    await trackRenderError(new Error('boom'));

    const { properties } = payloadFromCall();
    expect(properties).not.toHaveProperty('error_cause');
  });

  it('marks every event anonymous and attributes the library', async () => {
    await trackEvent('search_query', { search_term: 'acetone' });
    const { properties } = payloadFromCall();
    expect(properties.$process_person_profile).toBe(false);
    expect(properties.$lib).toBe('chempal-extension');
    expect(properties.$lib_version).toBeTruthy();
  });

  it('truncates text params to the length limit and keeps numbers numeric', async () => {
    await trackEvent('search_query', { error_message: 'x'.repeat(PARAM_VALUE_LIMIT * 5), count: 3 });
    const { properties } = payloadFromCall();
    expect(properties.error_message.length).toBe(PARAM_VALUE_LIMIT);
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

  it('merges caller params into the $exception event, as main.tsx does for fatal crashes', async () => {
    await trackRenderError(new Error('boom'), { fatal: 1 });

    const { properties } = payloadFromCall();
    expect(properties.error_name).toBe('Error');
    expect(properties.error_message).toContain('boom');
    expect(properties.fatal).toBe(1);
  });

  it('reports a fatal (uncaught-root) error as onuncaughtexception/handled: false', async () => {
    await trackRenderError(new Error('boom'), { fatal: 1 });
    const [exception] = payloadFromCall().properties.$exception_list;
    expect(exception.mechanism).toEqual({ type: 'onuncaughtexception', handled: false, synthetic: false });
  });

  it('reports an ErrorBoundary catch (no fatal param) as generic/handled: true', async () => {
    await trackRenderError(new Error('boom'));
    const [exception] = payloadFromCall().properties.$exception_list;
    expect(exception.mechanism).toEqual({ type: 'generic', handled: true, synthetic: false });
  });

  it('marks a non-Error throw as a synthetic exception', async () => {
    await trackRenderError('just a string');
    const [exception] = payloadFromCall().properties.$exception_list;
    expect(exception.mechanism.synthetic).toBe(true);
    expect(exception.value).toBe('just a string');
  });

  describe('trackInstallOrUpgrade', () => {
    it('sends extension_installed with no previous_version on a fresh install', async () => {
      await trackInstallOrUpgrade('install');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const payload = payloadFromCall();
      expect(payload.event).toBe('extension_installed');
      expect(payload.properties.app_version).toBeTruthy();
      expect(payload.properties).not.toHaveProperty('previous_version');
    });

    it('sends extension_upgraded carrying both versions on an update', async () => {
      await trackInstallOrUpgrade('update', '1.8.0');

      const payload = payloadFromCall();
      expect(payload.event).toBe('extension_upgraded');
      expect(payload.properties.previous_version).toBe('1.8.0');
      // The new version comes from the build-time define, not the caller.
      expect(payload.properties.app_version).not.toBe('1.8.0');
    });

    it('omits previous_version when Chrome does not supply one', async () => {
      await trackInstallOrUpgrade('update');

      const payload = payloadFromCall();
      expect(payload.event).toBe('extension_upgraded');
      expect(payload.properties).not.toHaveProperty('previous_version');
    });

    it('sends nothing when previousVersion is the running version (unpacked reload)', async () => {
      await trackInstallOrUpgrade('update', __APP_VERSION__);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(['chrome_update', 'shared_module_update'] as const)(
      'sends nothing for reason %s (the browser changed, not ChemPal)',
      async (reason) => {
        await trackInstallOrUpgrade(reason);
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it('respects the opt-out', async () => {
      localStore[CACHE.USER_SETTINGS] = { shareUsageData: false };
      await trackInstallOrUpgrade('install');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
