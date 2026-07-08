// Chem Pal background service worker.
//
// Required by Manifest V3 for the extension to participate in the Chrome
// extension lifecycle (install / update events) and to provide a discoverable
// entry point for Playwright-driven end-to-end tests, which identify the
// loaded extension by its service-worker URL.

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.info("Chem Pal installed");
  } else if (reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.info("Chem Pal updated");
  }
});

// Right-click "Search selection in Chem Pal" context menu.
//
// A single item that appears whenever text is selected. On click we stash the
// selection as a pending search in chrome.storage.session and open (or focus) the
// extension's full-tab view, which runs the search. The app classifies the query
// type itself (via detectTermType) to colorize the search box — nothing chemical
// is detected here.

const CONTEXT_MENU_ID = "chempal-search-selection";
// Full-tab view URL; ?view=tab is recognized by the app (see utils/displayContext.ts).
const TAB_VIEW_PATH = "index.html?view=tab";

// (Re)create the menu. removeAll first so install/update/startup never double-adds.
// The MV3 worker is ephemeral, so this runs on both onInstalled and onStartup.
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      // %s is substituted with the selected text by the contextMenus API.
      title: chrome.i18n.getMessage("context_menu_search_selection"),
      contexts: ["selection"],
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;

  const query = (info.selectionText || "").trim();
  if (!query) return;

  // Seed the pending-search inbox the app already consumes. Raw (uncompressed)
  // values are fine: the app's storage layer (utils/storage.ts decodeValue) passes
  // non-LZ-envelope values through unchanged. Keys mirror the CACHE enum in
  // src/constants/common.ts — CACHE.QUERY ("query") and
  // CACHE.SEARCH_IS_NEW_SEARCH ("is_new_search").
  await chrome.storage.session.set({ query, is_new_search: true });

  // Focus the existing full-tab view if one is open, otherwise open a new one.
  // Mirrors findExtensionTab/openExtensionTab in src/utils/displayContext.ts.
  const url = chrome.runtime.getURL(TAB_VIEW_PATH);
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
});

// Generic fetch proxy. Extension pages (side panel) are subject to page CORS for
// cross-origin requests, but the background service worker is not (given matching
// host_permissions). Any context can run a request here by sending:
//
//   { type: "BACKGROUND_FETCH", url: string, init?: RequestInit-ish }
//
// and gets back a serialized response (Response objects aren't structured-cloneable):
//
//   { ok, status, statusText, headers: Record<string,string>, body: string }
//   | { error: string }
//
// The client side lives in src/helpers/backgroundFetch.ts.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "BACKGROUND_FETCH") {
    return; // Not ours — leave the channel for other listeners.
  }

  (async () => {
    try {
      const response = await fetch(message.url, message.init ?? {});
      const body = await response.text();
      const headers = {};
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
