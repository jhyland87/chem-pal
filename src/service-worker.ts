/**
 * Chem Pal background service worker.
 *
 * Required by Manifest V3 for the extension to participate in the Chrome
 * extension lifecycle (install / update events) and to provide a discoverable
 * entry point for Playwright-driven end-to-end tests, which identify the loaded
 * extension by its service-worker URL.
 *
 * Bundled as a self-contained IIFE (see `serviceWorkerBuildPlugin` in
 * vite.config.ts) so it can share TypeScript constants like {@link CACHE} with
 * the app while remaining a single classic script that works as both a Chrome
 * MV3 worker and a Firefox background script.
 * @module serviceWorker
 * @source
 */

import { CACHE, MESSAGE_TYPE } from "@/constants/common";

/** Context-menu item id for the "Search selection in Chem Pal" entry. */
const CONTEXT_MENU_ID = "chempal-search-selection";
/** Full-tab view URL; `?view=tab` is recognized by the app (see utils/displayContext.ts). */
const TAB_VIEW_PATH = "index.html?view=tab";

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.info("Chem Pal installed");
  } else if (reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.info("Chem Pal updated");
  }
});

/**
 * Focuses the extension tab already open at `url`, or opens a new one. Mirrors
 * findExtensionTab/openExtensionTab in src/utils/displayContext.ts.
 * @param url - The full extension URL to open or focus.
 * @returns A promise that resolves once the tab has been opened or focused.
 * @source
 */
async function openOrFocusExtensionTab(url: string): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url === url || tab.pendingUrl === url);

  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url, active: true });
  }
}

/**
 * (Re)creates the "Search selection" context-menu item. `removeAll` runs first
 * so install/update/startup never double-adds it. The MV3 worker is ephemeral,
 * so this is invoked on both `onInstalled` and `onStartup`.
 * @source
 */
function createContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: chrome.i18n.getMessage("context_menu_search_selection"),
      contexts: ["selection"],
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;

  const query = (info.selectionText ?? "").trim();
  if (!query) return;

  // Seed the pending-search inbox the app already consumes. Raw (uncompressed)
  // values are fine: the app's storage layer (utils/storage.ts decodeValue) passes
  // non-LZ-envelope values through unchanged.
  await chrome.storage.session.set({
    [CACHE.QUERY]: query,
    [CACHE.SEARCH_IS_NEW_SEARCH]: true,
  });

  // Focus the existing full-tab view if one is open, otherwise open a new one.
  await openOrFocusExtensionTab(chrome.runtime.getURL(TAB_VIEW_PATH));
});

// Toolbar-icon behavior. The `openInTab` user setting decides whether clicking
// the toolbar icon shows the popup (default) or opens Chem Pal in a full tab.
// We enforce it by toggling the action popup: clearing the popup makes clicks
// fire chrome.action.onClicked (below) instead of opening index.html as a popup.
//
// Settings live in chrome.storage.local under CACHE.USER_SETTINGS. Compression is
// disabled (config.json useStorageCompression=false), so the value is the plain
// object; an LZ envelope ({__lz}) would be unreadable here, so that case falls
// back to the default popup behavior.

/**
 * Reads the `openInTab` user setting from storage, defaulting to `false` (popup)
 * when it's unset, unreadable, or an unexpected shape.
 * @returns `true` when the toolbar icon should open the full-tab view.
 * @source
 */
async function readOpenInTab(): Promise<boolean> {
  try {
    const stored: Record<string, unknown> = await chrome.storage.local.get(CACHE.USER_SETTINGS);
    const settings = stored[CACHE.USER_SETTINGS];
    if (typeof settings !== "object" || settings === null) return false;
    return "openInTab" in settings && Boolean(settings.openInTab);
  } catch (error) {
    console.warn("Failed to read openInTab setting:", error);
    return false;
  }
}

/**
 * Applies the current `openInTab` setting to the toolbar action. An empty popup
 * makes clicks fire `chrome.action.onClicked`; `index.html` restores the popup.
 * @returns A promise that resolves once the action popup has been updated.
 * @source
 */
async function applyActionBehavior(): Promise<void> {
  const openInTab = await readOpenInTab();
  await chrome.action.setPopup({ popup: openInTab ? "" : "index.html" });
}

// The setPopup state resets to the manifest default on browser restart, so
// re-apply on startup as well as install/update.
chrome.runtime.onInstalled.addListener(applyActionBehavior);
chrome.runtime.onStartup.addListener(applyActionBehavior);

// Re-apply whenever the user toggles the setting in the settings panel.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[CACHE.USER_SETTINGS]) {
    void applyActionBehavior();
  }
});

// Fires only while the popup is cleared (openInTab on). Open/focus the full tab.
chrome.action.onClicked.addListener(() => {
  void openOrFocusExtensionTab(chrome.runtime.getURL(TAB_VIEW_PATH));
});

/** Message the background fetch proxy accepts; mirrors src/helpers/backgroundFetch.ts. */
interface BackgroundFetchRequest {
  type: MESSAGE_TYPE.BACKGROUND_FETCH;
  url: string;
  init?: RequestInit;
}

/**
 * Type-guard narrowing an unknown runtime message to a {@link BackgroundFetchRequest}.
 * @param message - The value received by the `chrome.runtime.onMessage` listener.
 * @returns `true` when `message` is a background-fetch request.
 * @source
 */
function isBackgroundFetchRequest(message: unknown): message is BackgroundFetchRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    Reflect.get(message, "type") === MESSAGE_TYPE.BACKGROUND_FETCH &&
    typeof Reflect.get(message, "url") === "string"
  );
}

// Generic fetch proxy. Extension pages (side panel) are subject to page CORS for
// cross-origin requests, but the background service worker is not (given matching
// host_permissions). Any context can run a request here by sending a
// BackgroundFetchRequest and gets back a serialized response (Response objects
// aren't structured-cloneable):
//
//   { ok, status, statusText, headers: Record<string,string>, body: string }
//   | { error: string }
//
// The client side lives in src/helpers/backgroundFetch.ts.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isBackgroundFetchRequest(message)) {
    return; // Not ours — leave the channel for other listeners.
  }

  void (async () => {
    try {
      const response = await fetch(message.url, message.init ?? {});
      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      sendResponse({
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
      });
    } catch (error) {
      sendResponse({ error: error instanceof Error ? error.message : String(error) });
    }
  })();

  return true; // Keep the message channel open for the async sendResponse.
});
