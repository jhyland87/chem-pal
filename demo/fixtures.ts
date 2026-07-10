import { test as base, type BrowserContext, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(dirname, "..", "build");
const videoDir = path.resolve(dirname, "..", "demo-results", "videos");

/**
 * Popup dimensions. The toolbar popup renders `#root` at `min-width: 800px;
 * max-height: 600px` (`src/App.scss`), so an 800x600 window reproduces the
 * popup faithfully — this is the workaround that lets the demo show the UI
 * "as if" it were the toolbar popup (a real action popup is a transient window
 * Playwright can't drive).
 */
const POPUP_SIZE = { width: 800, height: 600 };

interface DemoFixtures {
  context: BrowserContext;
  extensionId: string;
}

/**
 * Playwright test/fixture pair that launches Chromium with the unpacked ChemPal
 * extension loaded, records video of the whole run, and exposes the extension
 * id. Adapted from Playwright's official Chrome-extension recipe; the launch
 * args mirror the e2e suite (`e2e/search-query.e2e.test.ts`).
 * @example
 * ```ts
 * import { test, expect } from "./fixtures";
 * test("walkthrough", async ({ context, extensionId }) => {
 *   const page = await context.newPage();
 *   await page.goto(`chrome-extension://${extensionId}/index.html`);
 * });
 * ```
 * @source
 */
export const test = base.extend<DemoFixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      // Extensions require headed mode in Chromium.
      headless: false,
      // Watchable pace so an audience can follow each action.
      slowMo: 700,
      // Simulate the popup window (see POPUP_SIZE).
      viewport: POPUP_SIZE,
      // Record the whole session; the .webm is flushed on context.close().
      recordVideo: { dir: videoDir, size: POPUP_SIZE },
      args: [
        `--disable-extensions-except=${buildDir}`,
        `--load-extension=${buildDir}`,
        "--no-first-run",
        "--disable-gpu",
        "--no-default-browser-check",
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // The service worker's URL is `chrome-extension://<id>/service-worker.js`.
    const worker = context.serviceWorkers().length
      ? context.serviceWorkers()[0]
      : await context.waitForEvent("serviceworker");
    const extensionId = worker.url().split("/")[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
