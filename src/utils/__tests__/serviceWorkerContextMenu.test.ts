import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the "Search selection in Chem Pal" context menu in the
 * background service worker (public/service-worker.js).
 *
 * The worker is plain JS that registers its listeners at import time, so each
 * test installs a fresh fake `chrome`, imports the worker (capturing the
 * registered listeners), and then invokes a listener directly — there's no way
 * to fire a real right-click from a unit test, but the click handler's logic
 * (which storage keys it writes, and whether it focuses an existing tab vs
 * opens a new one) is exactly what we want to pin down here.
 */

const MENU_ID = "chempal-search-selection";
const EXT_ORIGIN = "chrome-extension://abcextensionid/";
const TAB_VIEW_URL = `${EXT_ORIGIN}index.html?view=tab`;

/** Minimal shape of the `info` object the worker reads from an onClicked event. */
interface OnClickInfo {
  menuItemId: string | number;
  selectionText?: string;
}

type OnInstalled = (details: { reason: string }) => void;
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

  const removeAll = vi.fn((cb?: () => void) => cb?.());
  const create = vi.fn();
  const sessionSet = vi.fn(async () => {});
  const tabsQuery = vi.fn(async (): Promise<Array<Partial<chrome.tabs.Tab>>> => []);
  const tabsUpdate = vi.fn(async () => ({}));
  const tabsCreate = vi.fn(async () => ({}));
  const windowsUpdate = vi.fn(async () => ({}));

  const chromeMock = {
    runtime: {
      OnInstalledReason: { INSTALL: "install", UPDATE: "update" },
      getURL: (path: string) => EXT_ORIGIN + path,
      onInstalled: { addListener: (fn: OnInstalled) => onInstalled.push(fn) },
      onStartup: { addListener: (fn: () => void) => onStartup.push(fn) },
      onMessage: { addListener: vi.fn() },
    },
    contextMenus: {
      removeAll,
      create,
      onClicked: { addListener: (fn: OnClicked) => onClicked.push(fn) },
    },
    tabs: { query: tabsQuery, update: tabsUpdate, create: tabsCreate },
    windows: { update: windowsUpdate },
    storage: { session: { set: sessionSet } },
    i18n: { getMessage: (key: string) => key },
  };

  return {
    chromeMock,
    onInstalled,
    onStartup,
    onClicked,
    removeAll,
    create,
    sessionSet,
    tabsQuery,
    tabsUpdate,
    tabsCreate,
    windowsUpdate,
  };
}

/**
 * Imports the plain-JS service worker for its listener-registration side
 * effects. Modules are reset before each import so the worker re-runs against
 * the current fake chrome.
 * @source
 */
async function loadServiceWorker(): Promise<void> {
  // @ts-expect-error - untyped plain-JS module, imported for side effects only
  await import("../../../public/service-worker.js");
}

describe("service worker context-menu search", () => {
  let mock: ReturnType<typeof makeChromeMock>;

  beforeEach(async () => {
    vi.resetModules();
    mock = makeChromeMock();
    vi.stubGlobal("chrome", mock.chromeMock);
    await loadServiceWorker();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers a single selection context-menu item on install", () => {
    for (const listener of mock.onInstalled) listener({ reason: "install" });

    expect(mock.removeAll).toHaveBeenCalled();
    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: MENU_ID, contexts: ["selection"] }),
    );
  });

  it("re-creates the menu on browser startup", () => {
    for (const listener of mock.onStartup) listener();

    expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ id: MENU_ID }));
  });

  it("writes the pending search and opens a new tab when none is open", async () => {
    const [onClicked] = mock.onClicked;
    await onClicked({ menuItemId: MENU_ID, selectionText: "  acetone  " });

    // Selection is trimmed and seeded as a pending search (keys mirror CACHE).
    expect(mock.sessionSet).toHaveBeenCalledWith({ query: "acetone", is_new_search: true });
    expect(mock.tabsCreate).toHaveBeenCalledWith({ url: TAB_VIEW_URL, active: true });
    expect(mock.tabsUpdate).not.toHaveBeenCalled();
  });

  it("focuses the existing full-tab view instead of opening a duplicate", async () => {
    mock.tabsQuery.mockResolvedValueOnce([{ id: 5, windowId: 9, url: TAB_VIEW_URL }]);

    const [onClicked] = mock.onClicked;
    await onClicked({ menuItemId: MENU_ID, selectionText: "NaCl" });

    expect(mock.sessionSet).toHaveBeenCalledWith({ query: "NaCl", is_new_search: true });
    expect(mock.tabsUpdate).toHaveBeenCalledWith(5, { active: true });
    expect(mock.windowsUpdate).toHaveBeenCalledWith(9, { focused: true });
    expect(mock.tabsCreate).not.toHaveBeenCalled();
  });

  it("matches an existing tab by its pending (still-loading) URL", async () => {
    mock.tabsQuery.mockResolvedValueOnce([{ id: 7, windowId: 3, pendingUrl: TAB_VIEW_URL }]);

    const [onClicked] = mock.onClicked;
    await onClicked({ menuItemId: MENU_ID, selectionText: "water" });

    expect(mock.tabsUpdate).toHaveBeenCalledWith(7, { active: true });
    expect(mock.tabsCreate).not.toHaveBeenCalled();
  });

  it("ignores clicks on unrelated menu items", async () => {
    const [onClicked] = mock.onClicked;
    await onClicked({ menuItemId: "some-other-item", selectionText: "acetone" });

    expect(mock.sessionSet).not.toHaveBeenCalled();
    expect(mock.tabsCreate).not.toHaveBeenCalled();
    expect(mock.tabsUpdate).not.toHaveBeenCalled();
  });

  it("ignores blank selections", async () => {
    const [onClicked] = mock.onClicked;
    await onClicked({ menuItemId: MENU_ID, selectionText: "   " });

    expect(mock.sessionSet).not.toHaveBeenCalled();
    expect(mock.tabsCreate).not.toHaveBeenCalled();
  });
});
