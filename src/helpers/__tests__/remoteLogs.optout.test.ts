import { CACHE } from '@/constants/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the real analytics gate (not the global stub) so these tests prove that
// `shareUsageData` itself controls whether logs are sent.
vi.unmock('@/helpers/analytics');

const { fakePosthog, localStore, sessionStore, storageListeners } = vi.hoisted(() => ({
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
  sessionStore: {} as Record<string, unknown>,
  storageListeners: [] as Array<(changes: Record<string, unknown>, area: string) => void>,
}));

vi.mock('posthog-js/full/no-external', () => ({ default: fakePosthog }));

function makeStoreArea(store: Record<string, unknown>) {
  return {
    get: async (key: string) => ({ [key]: store[key] }),
    set: async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    },
    remove: async (key: string) => {
      delete store[key];
    },
  };
}
vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: makeStoreArea(localStore),
    session: makeStoreArea(sessionStore),
    onChanged: {
      addListener: (listener: (changes: Record<string, unknown>, area: string) => void) => {
        storageListeners.push(listener);
      },
    },
  },
}));

/** Loads fresh copies of the module under test and the `Logger` it registers with. */
async function load() {
  vi.resetModules();
  const { Logger } = await import('@/utils/Logger');
  const { initRemoteLogs } = await import('@/helpers/remoteLogs');
  return { Logger, initRemoteLogs };
}

/** Writes the stored settings and notifies listeners, as another extension page would. */
function saveSettings(settings: Record<string, unknown> | undefined) {
  localStore[CACHE.USER_SETTINGS] = settings;
  for (const listener of storageListeners) {
    listener({ [CACHE.USER_SETTINGS]: {} }, 'local');
  }
}

describe('remoteLogs honors shareUsageData', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'development');
    for (const mock of Object.values(fakePosthog)) {
      mock.mockReset();
    }
    for (const store of [localStore, sessionStore]) {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    }
    storageListeners.length = 0;
  });

  it.each([
    ['shareUsageData is true', { shareUsageData: true }, true],
    ['shareUsageData is unset (defaults to on)', { currency: 'USD' }, true],
    ['no settings are stored yet (defaults to on)', undefined, true],
    ['shareUsageData is false', { shareUsageData: false }, false],
  ])('when %s, logs are sent: %s', async (_label, settings, sent) => {
    localStore[CACHE.USER_SETTINGS] = settings;
    const { initRemoteLogs, Logger } = await load();
    await initRemoteLogs();
    new Logger('OptOut').error('probe');

    expect(fakePosthog.init).toHaveBeenCalledTimes(sent ? 1 : 0);
    expect(fakePosthog.captureLog).toHaveBeenCalledTimes(sent ? 1 : 0);
  });

  it('never loads posthog or buffers a log for an opted-out user', async () => {
    localStore[CACHE.USER_SETTINGS] = { shareUsageData: false };
    const { initRemoteLogs, Logger } = await load();
    const started = initRemoteLogs();
    new Logger('OptOut').error('logged during startup');
    await started;
    new Logger('OptOut').error('logged afterwards');

    expect(fakePosthog.init).not.toHaveBeenCalled();
    expect(fakePosthog.captureLog).not.toHaveBeenCalled();
  });

  it('stops as soon as the user turns sharing off, and resumes when they turn it back on', async () => {
    localStore[CACHE.USER_SETTINGS] = { shareUsageData: true };
    const { initRemoteLogs, Logger } = await load();
    await initRemoteLogs();
    new Logger('OptOut').warn('while on');
    expect(fakePosthog.captureLog).toHaveBeenCalledTimes(1);

    saveSettings({ shareUsageData: false });
    await vi.waitFor(() => expect(fakePosthog.opt_out_capturing).toHaveBeenCalled());
    new Logger('OptOut').error('while off');
    expect(fakePosthog.captureLog).toHaveBeenCalledTimes(1);

    saveSettings({ shareUsageData: true });
    await vi.waitFor(() => expect(fakePosthog.opt_in_capturing).toHaveBeenCalled());
    new Logger('OptOut').error('on again');
    expect(fakePosthog.captureLog).toHaveBeenCalledTimes(2);
  });

  it('still sends nothing when sharing is off but verbose levels are selected', async () => {
    localStore[CACHE.USER_SETTINGS] = {
      shareUsageData: false,
      remoteLogLevels: ['debug', 'log', 'warn', 'error'],
    };
    const { initRemoteLogs, Logger } = await load();
    await initRemoteLogs();
    new Logger('OptOut').debug('verbose');
    new Logger('OptOut').error('serious');

    expect(fakePosthog.init).not.toHaveBeenCalled();
    expect(fakePosthog.captureLog).not.toHaveBeenCalled();
  });
});
