import { defaultSettings } from '@/../config.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The worker reports installs/upgrades on startup. Mocked so these tests assert
// the wiring without touching storage or the network.
const { trackInstallOrUpgrade } = vi.hoisted(() => ({ trackInstallOrUpgrade: vi.fn() }));
vi.mock('@/helpers/analytics', () => ({ trackInstallOrUpgrade }));

/**
 * Expected action popup when no explicit `openInTab` is persisted. The worker
 * falls back to the shipped config.json default, so this must track it: `''`
 * (cleared → opens a tab) when the default is on, `'index.html'` otherwise.
 */
const DEFAULT_POPUP = defaultSettings.display?.openInTab ? '' : 'index.html';

/**
 * Unit tests for the "Search selection in ChemPal" context menu in the
 * background service worker (src/service-worker.ts).
 *
 * The worker registers its listeners at import time, so each test installs a
 * fresh fake `chrome`, imports the worker (capturing the
 * registered listeners), and then invokes a listener directly — there's no way
 * to fire a real right-click from a unit test, but the click handler's logic
 * (which storage keys it writes, and whether it focuses an existing tab vs
 * opens a new one) is exactly what we want to pin down here.
 */

const EXT_ORIGIN = 'chrome-extension://abcextensionid/';

// Read off the worker module rather than restated here, so the test can't drift
// from the values it ships. Assigned in loadServiceWorker() and not by a
// top-level import: importing the worker registers its listeners, so it must not
// be loaded until a fake chrome is in place.
let MENU_ID: string;
let TAB_VIEW_URL: string;

/** Minimal shape of the `info` object the worker reads from an onClicked event. */
interface OnClickInfo {
  menuItemId: string | number;
  selectionText?: string;
}

type OnInstalled = (details: { reason: string; previousVersion?: string }) => unknown;
type OnClicked = (info: OnClickInfo) => unknown;

/**
 * Builds a fake `chrome` that records the listeners the worker registers and
 * exposes the individual method spies the click handler calls.
 * @returns The fake chrome plus the captured listeners and spies.
 * @source
 */
function makeChromeMock() {
  const onInstalled: OnInstalled[] = [];
  const onStartup: Array<() => void> = [];
  const onClicked: OnClicked[] = [];
  const onInputEntered: Array<(text: string) => unknown> = [];
  const actionClicked: Array<() => unknown> = [];
  const storageChanged: Array<(changes: Record<string, unknown>, areaName: string) => void> = [];

  const setDefaultSuggestion = vi.fn();

  const removeAll = vi.fn((cb?: () => void) => cb?.());
  const create = vi.fn();
  const sessionSet = vi.fn(async () => {});
  const localGet = vi.fn(async (): Promise<Record<string, unknown>> => ({}));
  const localSet = vi.fn(async () => {});
  const localRemove = vi.fn(async () => {});
  const setPopup = vi.fn(async () => {});
  const tabsQuery = vi.fn(async (): Promise<Array<Partial<chrome.tabs.Tab>>> => []);
  const tabsUpdate = vi.fn(async () => ({}));
  const tabsCreate = vi.fn(async () => ({}));
  const windowsUpdate = vi.fn(async () => ({}));

  const chromeMock = {
    runtime: {
      OnInstalledReason: { INSTALL: 'install', UPDATE: 'update' },
      getURL: (path: string) => EXT_ORIGIN + path,
      onInstalled: { addListener: (fn: OnInstalled) => onInstalled.push(fn) },
      onStartup: { addListener: (fn: () => void) => onStartup.push(fn) },
      onMessage: { addListener: vi.fn() },
    },
    action: {
      setPopup,
      onClicked: { addListener: (fn: () => unknown) => actionClicked.push(fn) },
    },
    contextMenus: {
      removeAll,
      create,
      onClicked: { addListener: (fn: OnClicked) => onClicked.push(fn) },
    },
    omnibox: {
      setDefaultSuggestion,
      onInputEntered: { addListener: (fn: (text: string) => unknown) => onInputEntered.push(fn) },
    },
    tabs: { query: tabsQuery, update: tabsUpdate, create: tabsCreate },
    windows: { update: windowsUpdate },
    storage: {
      session: { set: sessionSet },
      local: { get: localGet, set: localSet, remove: localRemove },
      onChanged: {
        addListener: (fn: (changes: Record<string, unknown>, areaName: string) => void) =>
          storageChanged.push(fn),
      },
    },
    i18n: { getMessage: (key: string) => key },
  };

  return {
    chromeMock,
    onInstalled,
    onStartup,
    onClicked,
    onInputEntered,
    actionClicked,
    storageChanged,
    setDefaultSuggestion,
    removeAll,
    create,
    sessionSet,
    localGet,
    localSet,
    localRemove,
    setPopup,
    tabsQuery,
    tabsUpdate,
    tabsCreate,
    windowsUpdate,
  };
}

/**
 * Imports the service worker for its listener-registration side effects. Modules
 * are reset before each import so the worker re-runs against the current fake
 * chrome.
 * @source
 */
async function loadServiceWorker(): Promise<void> {
  const worker = await import('../../service-worker');
  MENU_ID = worker.CONTEXT_MENU_ID;
  TAB_VIEW_URL = `${EXT_ORIGIN}${worker.TAB_VIEW_PATH}`;
}

describe('service worker context-menu search', () => {
  let mock: ReturnType<typeof makeChromeMock>;

  beforeEach(async () => {
    vi.resetModules();
    mock = makeChromeMock();
    vi.stubGlobal('chrome', mock.chromeMock);
    await loadServiceWorker();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers a single selection context-menu item on install', () => {
    for (const listener of mock.onInstalled) listener({ reason: 'install' });

    expect(mock.removeAll).toHaveBeenCalled();
    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: MENU_ID, contexts: ['selection'] }),
    );
  });

  it('seeds the review-prompt record with an install date on install', () => {
    for (const listener of mock.onInstalled) listener({ reason: 'install' });

    expect(mock.localSet).toHaveBeenCalledWith(
      expect.objectContaining({
        review_prompt: expect.objectContaining({
          installedAt: expect.any(Number),
          searchCount: 0,
          totalResults: 0,
          dismissCount: 0,
        }),
      }),
    );
  });

  it('re-creates the menu on browser startup', () => {
    for (const listener of mock.onStartup) listener();

    expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ id: MENU_ID }));
  });

  it('writes the pending search and opens a new tab when none is open', async () => {
    const [onClicked] = mock.onClicked;
    await onClicked({ menuItemId: MENU_ID, selectionText: '  acetone  ' });

    // Selection is trimmed and seeded as a pending search (keys mirror CACHE).
    expect(mock.sessionSet).toHaveBeenCalledWith({ query: 'acetone', is_new_search: true });
    expect(mock.tabsCreate).toHaveBeenCalledWith({ url: TAB_VIEW_URL, active: true });
    expect(mock.tabsUpdate).not.toHaveBeenCalled();
  });

  it('focuses the existing full-tab view instead of opening a duplicate', async () => {
    mock.tabsQuery.mockResolvedValueOnce([{ id: 5, windowId: 9, url: TAB_VIEW_URL }]);

    const [onClicked] = mock.onClicked;
    await onClicked({ menuItemId: MENU_ID, selectionText: 'NaCl' });

    expect(mock.sessionSet).toHaveBeenCalledWith({ query: 'NaCl', is_new_search: true });
    expect(mock.tabsUpdate).toHaveBeenCalledWith(5, { active: true });
    expect(mock.windowsUpdate).toHaveBeenCalledWith(9, { focused: true });
    expect(mock.tabsCreate).not.toHaveBeenCalled();
  });

  it('matches an existing tab by its pending (still-loading) URL', async () => {
    mock.tabsQuery.mockResolvedValueOnce([{ id: 7, windowId: 3, pendingUrl: TAB_VIEW_URL }]);

    const [onClicked] = mock.onClicked;
    await onClicked({ menuItemId: MENU_ID, selectionText: 'water' });

    expect(mock.tabsUpdate).toHaveBeenCalledWith(7, { active: true });
    expect(mock.tabsCreate).not.toHaveBeenCalled();
  });

  it('ignores clicks on unrelated menu items', async () => {
    const [onClicked] = mock.onClicked;
    await onClicked({ menuItemId: 'some-other-item', selectionText: 'acetone' });

    expect(mock.sessionSet).not.toHaveBeenCalled();
    expect(mock.tabsCreate).not.toHaveBeenCalled();
    expect(mock.tabsUpdate).not.toHaveBeenCalled();
  });

  it('ignores blank selections', async () => {
    const [onClicked] = mock.onClicked;
    await onClicked({ menuItemId: MENU_ID, selectionText: '   ' });

    expect(mock.sessionSet).not.toHaveBeenCalled();
    expect(mock.tabsCreate).not.toHaveBeenCalled();
  });
});

describe('service worker omnibox search', () => {
  let mock: ReturnType<typeof makeChromeMock>;

  beforeEach(async () => {
    vi.resetModules();
    mock = makeChromeMock();
    vi.stubGlobal('chrome', mock.chromeMock);
    await loadServiceWorker();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers a default omnibox suggestion', () => {
    expect(mock.setDefaultSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('seeds the pending search and opens a tab on omnibox entry', async () => {
    const [onInputEntered] = mock.onInputEntered;
    await onInputEntered('  acetone  ');

    // Same seed-and-open path as the context menu; input is trimmed.
    expect(mock.sessionSet).toHaveBeenCalledWith({ query: 'acetone', is_new_search: true });
    expect(mock.tabsCreate).toHaveBeenCalledWith({ url: TAB_VIEW_URL, active: true });
  });

  it('ignores a blank omnibox entry', async () => {
    const [onInputEntered] = mock.onInputEntered;
    await onInputEntered('   ');

    expect(mock.sessionSet).not.toHaveBeenCalled();
    expect(mock.tabsCreate).not.toHaveBeenCalled();
  });
});

describe('service worker toolbar-icon behavior', () => {
  let mock: ReturnType<typeof makeChromeMock>;

  beforeEach(async () => {
    vi.resetModules();
    mock = makeChromeMock();
    vi.stubGlobal('chrome', mock.chromeMock);
    await loadServiceWorker();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears the action popup on install when openInTab is enabled', async () => {
    mock.localGet.mockResolvedValueOnce({ user_settings: { display: { openInTab: true } } });

    for (const listener of mock.onInstalled) await listener({ reason: 'install' });

    expect(mock.setPopup).toHaveBeenCalledWith({ popup: '' });
  });

  it('keeps the popup when openInTab is explicitly off', async () => {
    mock.localGet.mockResolvedValueOnce({ user_settings: { display: { openInTab: false } } });

    for (const listener of mock.onStartup) await listener();

    expect(mock.setPopup).toHaveBeenCalledWith({ popup: 'index.html' });
  });

  it('falls back to the config default when settings are absent', async () => {
    mock.localGet.mockResolvedValueOnce({});

    for (const listener of mock.onInstalled) await listener({ reason: 'install' });

    // A never-configured profile must honor the shipped default the UI hydrates with,
    // not silently keep the popup.
    expect(mock.setPopup).toHaveBeenCalledWith({ popup: DEFAULT_POPUP });
  });

  it('falls back to the config default when display has no openInTab key', async () => {
    mock.localGet.mockResolvedValueOnce({ user_settings: { display: { fontSize: 'medium' } } });

    for (const listener of mock.onStartup) await listener();

    expect(mock.setPopup).toHaveBeenCalledWith({ popup: DEFAULT_POPUP });
  });

  it('falls back to the config default when settings are an unreadable LZ envelope', async () => {
    mock.localGet.mockResolvedValueOnce({ user_settings: { __lz: 1, d: 'compressed' } });

    for (const listener of mock.onInstalled) await listener({ reason: 'install' });

    expect(mock.setPopup).toHaveBeenCalledWith({ popup: DEFAULT_POPUP });
  });

  it('re-applies the popup state when user settings change', async () => {
    mock.localGet.mockResolvedValueOnce({ user_settings: { display: { openInTab: true } } });

    const [onChanged] = mock.storageChanged;
    onChanged({ user_settings: { newValue: { display: { openInTab: true } } } }, 'local');
    // Let the async applyActionBehavior settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(mock.setPopup).toHaveBeenCalledWith({ popup: '' });
  });

  it('ignores storage changes to other keys or areas', () => {
    const [onChanged] = mock.storageChanged;
    onChanged({ some_other_key: { newValue: 1 } }, 'local');
    onChanged({ user_settings: { newValue: {} } }, 'session');

    expect(mock.setPopup).not.toHaveBeenCalled();
  });

  it('opens or focuses the full tab when the toolbar icon is clicked', async () => {
    const [actionClicked] = mock.actionClicked;
    await actionClicked();

    expect(mock.tabsCreate).toHaveBeenCalledWith({ url: TAB_VIEW_URL, active: true });
  });
});

describe('service worker install/upgrade analytics', () => {
  let mock: ReturnType<typeof makeChromeMock>;

  beforeEach(async () => {
    vi.resetModules();
    trackInstallOrUpgrade.mockReset();
    mock = makeChromeMock();
    vi.stubGlobal('chrome', mock.chromeMock);
    await loadServiceWorker();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Fires every registered onInstalled listener with the given details, the way
   * Chrome would. Several listeners are registered (review-prompt seeding,
   * uninstall URL, action behavior, analytics); they all receive the event.
   * @param details - The onInstalled details to dispatch.
   * @source
   */
  async function fireOnInstalled(details: {
    reason: string;
    previousVersion?: string;
  }): Promise<void> {
    for (const listener of mock.onInstalled) await listener(details);
  }

  it('reports a fresh install', async () => {
    await fireOnInstalled({ reason: 'install' });

    expect(trackInstallOrUpgrade).toHaveBeenCalledWith('install', undefined);
  });

  it('reports an upgrade with the previous version', async () => {
    await fireOnInstalled({ reason: 'update', previousVersion: '1.8.0' });

    expect(trackInstallOrUpgrade).toHaveBeenCalledWith('update', '1.8.0');
  });

  it('forwards other reasons and lets the helper decide', async () => {
    await fireOnInstalled({ reason: 'chrome_update' });

    // The worker does not filter; trackInstallOrUpgrade owns that rule so the
    // decision lives in one place (covered in analytics.test.ts).
    expect(trackInstallOrUpgrade).toHaveBeenCalledWith('chrome_update', undefined);
  });
});
