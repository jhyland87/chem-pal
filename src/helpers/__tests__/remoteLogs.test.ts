import { analytics as analyticsConfig } from '@/../config.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fakePosthog, localStore, storageListeners } = vi.hoisted(() => ({
  fakePosthog: {
    init: vi.fn(),
    captureLog: vi.fn(),
    reset: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    opt_out_capturing: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    opt_in_capturing: vi.fn(),
  },
  localStore: {} as Record<string, unknown>,
  storageListeners: [] as Array<(changes: Record<string, unknown>, area: string) => void>,
}));

vi.mock('posthog-js/full/no-external', () => ({ default: fakePosthog }));

vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: { get: async (key: string) => ({ [key]: localStore[key] }) },
    onChanged: {
      addListener: (listener: (changes: Record<string, unknown>, area: string) => void) => {
        storageListeners.push(listener);
      },
    },
  },
}));

const LOG_CONFIG = analyticsConfig.logs;

/**
 * Loads a fresh copy of the module under test (its state is module-level) together with the
 * `Logger` it registers with and the globally mocked analytics gate.
 * @returns The module's exports, a new `Logger` factory, and the gate mock.
 */
async function load() {
  vi.resetModules();
  const { Logger } = await import('@/utils/Logger');
  const remote = await import('@/helpers/remoteLogs');
  const analytics = await import('@/helpers/analytics');
  const canSend = vi.mocked(analytics.canSendAnalytics);
  canSend.mockResolvedValue(true);
  return { ...remote, Logger, canSend };
}

/** Simulates another extension page changing the stored user settings. */
function emitSettingsChange() {
  for (const listener of storageListeners) {
    listener({ user_settings: {} }, 'local');
  }
}

describe('remoteLogs', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'development');
    for (const mock of Object.values(fakePosthog)) {
      mock.mockReset();
    }
    for (const key of Object.keys(localStore)) {
      delete localStore[key];
    }
    storageListeners.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('gating', () => {
    it('does nothing under Vitest', async () => {
      vi.stubEnv('MODE', 'test');
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Gate').warn('x');

      expect(fakePosthog.init).not.toHaveBeenCalled();
      expect(fakePosthog.captureLog).not.toHaveBeenCalled();
    });

    it('does not load posthog when analytics may not be sent', async () => {
      const { initRemoteLogs, Logger, canSend } = await load();
      canSend.mockResolvedValue(false);
      await initRemoteLogs();
      new Logger('Gate').error('x');

      expect(fakePosthog.init).not.toHaveBeenCalled();
      expect(fakePosthog.captureLog).not.toHaveBeenCalled();
    });
  });

  describe('initialization', () => {
    it('initializes posthog for logs only, with the shared identity', async () => {
      const { initRemoteLogs } = await load();
      await initRemoteLogs();

      expect(fakePosthog.init).toHaveBeenCalledOnce();
      const [token, config] = fakePosthog.init.mock.calls[0];
      expect(token).toBe(analyticsConfig.apiKey);
      expect(config).toMatchObject({
        api_host: analyticsConfig.host,
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
        persistence: 'memory',
        bootstrap: { distinctID: 'fp_test', sessionID: 'test-session' },
        logs: { serviceName: LOG_CONFIG.serviceName },
      });
    });

    it('initializes only once across repeated calls', async () => {
      const { initRemoteLogs } = await load();
      await initRemoteLogs();
      await initRemoteLogs();

      expect(fakePosthog.init).toHaveBeenCalledOnce();
    });

    it('buffers startup logs until posthog has loaded', async () => {
      const { initRemoteLogs, Logger } = await load();
      const started = initRemoteLogs();
      new Logger('Boot').warn('early');
      await started;

      expect(fakePosthog.captureLog).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'early', level: 'warn' }),
      );
    });
  });

  describe('forwarding', () => {
    it.each([
      ['log', 'info', true],
      ['info', 'info', true],
      ['warn', 'warn', true],
      ['error', 'error', true],
      ['debug', 'debug', false],
    ] as const)('%s() is sent as %s by default: %s', async (method, severity, sent) => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Cache')[method]('hello');

      if (sent) {
        expect(fakePosthog.captureLog).toHaveBeenCalledWith(
          expect.objectContaining({
            body: 'hello',
            level: severity,
            attributes: expect.objectContaining({ logger: 'Cache', context: 'app' }),
          }),
        );
      } else {
        expect(fakePosthog.captureLog).not.toHaveBeenCalled();
      }
    });

    it('sends debug once the user selects it', async () => {
      localStore.user_settings = { remoteLogLevels: ['debug'] };
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Cache').debug('verbose');
      new Logger('Cache').warn('not selected');

      expect(fakePosthog.captureLog).toHaveBeenCalledOnce();
      expect(fakePosthog.captureLog).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'verbose', level: 'debug' }),
      );
    });

    it('stamps the shared identity in beforeSend and drops records when stopped', async () => {
      const { initRemoteLogs, canSend } = await load();
      await initRemoteLogs();
      const { logs } = fakePosthog.init.mock.calls[0][1];

      expect(logs.beforeSend({ body: 'x', attributes: { a: 1 } })).toEqual({
        body: 'x',
        attributes: { a: 1, distinct_id: 'fp_test', session_id: 'test-session' },
      });

      canSend.mockResolvedValue(false);
      emitSettingsChange();
      await vi.waitFor(() => expect(fakePosthog.opt_out_capturing).toHaveBeenCalled());

      expect(logs.beforeSend({ body: 'x' })).toBeNull();
    });
  });

  describe('sanitizing', () => {
    it('truncates long messages and arguments', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Big').warn('m'.repeat(LOG_CONFIG.maxMessageChars + 50), 'a'.repeat(1000));

      const [log] = fakePosthog.captureLog.mock.calls[0];
      expect(log.body).toHaveLength(LOG_CONFIG.maxMessageChars + 1);
      expect(log.attributes.arg_0).toHaveLength(LOG_CONFIG.maxArgChars + 1);
    });

    it('flattens the first Error into error_* attributes', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Err').error('failed', new TypeError('bad input'));

      const [log] = fakePosthog.captureLog.mock.calls[0];
      expect(log.attributes).toMatchObject({
        error_name: 'TypeError',
        error_message: 'bad input',
      });
      expect(log.attributes.error_stack).toEqual(expect.stringContaining('TypeError'));
      expect(log.attributes.arg_0).toBeUndefined();
    });

    it('caps the number of arguments and reports how many were dropped', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      const extra = LOG_CONFIG.maxArgs + 3;
      new Logger('Many').warn('lots', ...Array.from({ length: extra }, (_, i) => i));

      const [log] = fakePosthog.captureLog.mock.calls[0];
      expect(log.attributes.args_omitted).toBe(3);
      expect(log.attributes[`arg_${LOG_CONFIG.maxArgs}`]).toBeUndefined();
    });

    it.each([
      ['an object', { id: 7 }, '{"id":7}'],
      ['undefined', undefined, 'undefined'],
      ['a function', () => 1, '[function]'],
    ])('renders %s as a string', async (_label, arg, expected) => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Arg').warn('x', arg);

      expect(fakePosthog.captureLog.mock.calls[0][0].attributes.arg_0).toBe(expected);
    });

    it('survives a circular argument', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(() => new Logger('Loop').warn('x', circular)).not.toThrow();
      expect(fakePosthog.captureLog.mock.calls[0][0].attributes.arg_0).toBe(
        '{"self":"[circular]"}',
      );
    });
  });

  describe('personal data', () => {
    it('scrubs the message, string arguments, and object arguments', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Pii').warn(
        'Lookup for jane@example.com failed at https://shop.example.com/p?q=aspirin',
        'from 203.0.113.9',
        { headers: { Authorization: 'Bearer abcdefgh12345' }, location: 'US', sku: 'A1' },
      );

      const [log] = fakePosthog.captureLog.mock.calls[0];
      expect(log.body).toBe('Lookup for [email] failed at https://shop.example.com/p');
      expect(log.attributes.arg_0).toBe('from [ip]');
      expect(log.attributes.arg_1).toBe(
        '{"headers":{"Authorization":"[redacted]"},"location":"[redacted]","sku":"A1"}',
      );
    });

    it('scrubs the error message and the stack trace but keeps the stack', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      const error = new Error('no match for jane@example.com');
      error.stack = 'Error: no match for jane@example.com\n    at run (/Users/jane/dev/app.js:1:1)';
      new Logger('Pii').error('failed', error);

      const { attributes } = fakePosthog.captureLog.mock.calls[0][0];
      expect(attributes.error_message).toBe('no match for [email]');
      expect(attributes.error_stack).toBe(
        'Error: no match for [email]\n    at run (/Users/[user]/dev/app.js:1:1)',
      );
    });

    it('scrubs before truncating so a cut cannot leave part of an address', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      const padding = 'x'.repeat(LOG_CONFIG.maxMessageChars - 8);
      new Logger('Pii').warn(`${padding} jane.doe@example.com`);

      expect(fakePosthog.captureLog.mock.calls[0][0].body).not.toContain('jane');
    });
  });

  describe('live settings', () => {
    it('follows a change to the selected levels', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      localStore.user_settings = { remoteLogLevels: ['error'] };
      emitSettingsChange();
      await vi.waitFor(() => {
        fakePosthog.captureLog.mockClear();
        new Logger('Live').warn('probe');
        expect(fakePosthog.captureLog).not.toHaveBeenCalled();
      });
      new Logger('Live').error('kept');

      expect(fakePosthog.captureLog).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'kept' }),
      );
    });

    it('stops immediately on opt-out and resumes without an opt-in event', async () => {
      const { initRemoteLogs, Logger, canSend } = await load();
      await initRemoteLogs();

      canSend.mockResolvedValue(false);
      emitSettingsChange();
      await vi.waitFor(() => expect(fakePosthog.opt_out_capturing).toHaveBeenCalled());
      expect(fakePosthog.reset).toHaveBeenCalled();
      fakePosthog.captureLog.mockClear();
      new Logger('Live').warn('while opted out');
      expect(fakePosthog.captureLog).not.toHaveBeenCalled();

      canSend.mockResolvedValue(true);
      emitSettingsChange();
      await vi.waitFor(() =>
        expect(fakePosthog.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false }),
      );
      new Logger('Live').warn('back on');
      expect(fakePosthog.captureLog).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'back on' }),
      );
    });
  });
});
