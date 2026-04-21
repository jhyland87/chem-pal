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
