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
