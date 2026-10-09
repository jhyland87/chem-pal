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
      ['trace', 'trace', false],
      ['fatal', 'fatal', true],
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

    it('flattens an Error passed as a property of an object argument', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Err').error('failed', { error: new TypeError('bad input'), id: 7 });

      const { attributes } = fakePosthog.captureLog.mock.calls[0][0];
      expect(attributes).toMatchObject({ error_name: 'TypeError', error_message: 'bad input' });
      expect(attributes.error_stack).toEqual(expect.stringContaining('TypeError'));
      expect(attributes.arg_0).toBe('{"id":7}');
    });

    it('adds no arg attribute when the object held only the Error', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Err').error('failed', { error: new Error('boom') });

      const { attributes } = fakePosthog.captureLog.mock.calls[0][0];
      expect(attributes.error_name).toBe('Error');
      expect(attributes).not.toHaveProperty('arg_0');
    });

    it('only unwraps the first Error, and only at the top level of the object', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Err').error(
        'failed',
        { error: new Error('first') },
        { error: new Error('second') },
        { nested: { error: new Error('deep') } },
      );

      const { attributes } = fakePosthog.captureLog.mock.calls[0][0];
      expect(attributes.error_message).toBe('first');
      expect(attributes.arg_0).toBe('{"error":{"name":"Error","message":"second"}}');
      expect(attributes.arg_1).toBe('{"nested":{"error":{"name":"Error","message":"deep"}}}');
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

  describe('search context', () => {
    it('sends the active search query as an attribute', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      Logger.setContext({ search_query: 'sodium acetate' });
      new Logger('Ctx').warn('slow');

      expect(fakePosthog.captureLog.mock.calls[0][0].attributes).toMatchObject({
        search_query: 'sodium acetate',
      });
    });

    it('sends the query from a logger-level context too', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      const logger = new Logger('Supplier');
      logger.setContext({ search_query: 'ethanol' });
      logger.error('late log');

      expect(fakePosthog.captureLog.mock.calls[0][0].attributes.search_query).toBe('ethanol');
    });

    it('sends the trace id as the OpenTelemetry trace_id and as a visible attribute', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      Logger.setContext({ search_query: 'acetone', trace_id: traceId });
      new Logger('Ctx').warn('slow');

      const [log] = fakePosthog.captureLog.mock.calls[0];
      expect(log.trace_id).toBe(traceId);
      expect(log.attributes).toMatchObject({ search_query: 'acetone', trace_id: traceId });
    });

    it.each([
      ['malformed', 'not-a-trace-id'],
      ['all zeros', '0'.repeat(32)],
      ['upper-case', 'A'.repeat(32)],
    ])('does not send a %s trace id as the OpenTelemetry field', async (_label, traceId) => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      Logger.setContext({ trace_id: traceId });
      new Logger('Ctx').warn('odd');

      expect(fakePosthog.captureLog.mock.calls[0][0]).not.toHaveProperty('trace_id');
    });

    it('sends no trace_id outside a search', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      Logger.setContext(undefined);
      new Logger('Ctx').warn('idle');

      expect(fakePosthog.captureLog.mock.calls[0][0]).not.toHaveProperty('trace_id');
    });

    it('adds no search attributes outside a search', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      Logger.setContext(undefined);
      new Logger('Ctx').warn('idle');

      expect(fakePosthog.captureLog.mock.calls[0][0].attributes).not.toHaveProperty('search_query');
    });

    it('scrubs and bounds the query like any other value', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      Logger.setContext({
        search_query: `${'q'.repeat(LOG_CONFIG.maxArgChars + 50)} jane@example.com`,
      });
      new Logger('Ctx').warn('long');

      const query = fakePosthog.captureLog.mock.calls[0][0].attributes.search_query;
      expect(query).toHaveLength(LOG_CONFIG.maxArgChars + 1);
      Logger.setContext({ search_query: 'mail jane@example.com about acetone' });
      new Logger('Ctx').warn('email');
      expect(fakePosthog.captureLog.mock.calls[1][0].attributes.search_query).toBe(
        'mail [email] about acetone',
      );
    });
  });

  describe('source location', () => {
    it('sends the file, line and function of an instrumented call', async () => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Where').warnAt('suppliers/SupplierBase.ts:1431#SupplierBase.fetch', 'bad');

      expect(fakePosthog.captureLog.mock.calls[0][0].attributes).toMatchObject({
        'code.filepath': 'suppliers/SupplierBase.ts',
        'code.lineno': 1431,
        'code.function': 'SupplierBase.fetch',
      });
    });

    it.each([
      ['no function name', 'helpers/a.ts:5', { 'code.filepath': 'helpers/a.ts', 'code.lineno': 5 }],
      [
        'a Windows-style drive path',
        'C:/x/a.ts:9#f',
        { 'code.filepath': 'C:/x/a.ts', 'code.lineno': 9, 'code.function': 'f' },
      ],
    ])('handles %s', async (_label, location, expected) => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      new Logger('Where').errorAt(location, 'bad');

      const { attributes } = fakePosthog.captureLog.mock.calls[0][0];
      expect(attributes).toMatchObject(expected);
      if (!('code.function' in expected)) {
        expect(attributes).not.toHaveProperty('code.function');
      }
    });

    it.each([
      ['a plain, uninstrumented call', undefined],
      ['a malformed location', 'not-a-location'],
      ['a location with no line number', 'a.ts:abc'],
    ])('adds no code attributes for %s', async (_label, location) => {
      const { initRemoteLogs, Logger } = await load();
      await initRemoteLogs();
      const logger = new Logger('Where');
      if (location === undefined) logger.warn('bad');
      else logger.warnAt(location, 'bad');

      const keys = Object.keys(fakePosthog.captureLog.mock.calls[0][0].attributes);
      expect(keys.filter((key) => key.startsWith('code.'))).toEqual([]);
    });
  });
});
