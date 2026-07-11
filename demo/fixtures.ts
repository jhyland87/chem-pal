import { test as base, type BrowserContext, chromium, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addIntroOutro, addSfxToVideo, installSfxCapture, startSfxTimeline } from "./sfx";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(dirname, "..", "build");
const videoDir = path.resolve(dirname, "output", "videos");

/**
 * Desktop viewport / recording canvas for the demo, which runs in the full
 * browser-tab view (`index.html?view=tab`). The popup-to-tab demo, when
 * re-enabled, sets its own smaller size for the popup stage.
 */
const DEMO_SIZE = { width: 1280, height: 800 };

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
      // Desktop-sized tab view (see DEMO_SIZE).
      viewport: DEMO_SIZE,
      // Record the whole session; the .webm is flushed on context.close().
      recordVideo: { dir: videoDir, size: DEMO_SIZE },
      args: [
        `--disable-extensions-except=${buildDir}`,
        `--load-extension=${buildDir}`,
        "--no-first-run",
        "--disable-gpu",
        "--no-default-browser-check",
      ],
    });

    // Stamp the recording start and capture real click/keystroke events so we
    // can mux matching sounds into an .mp4 after the video is flushed.
    startSfxTimeline();
    await installSfxCapture(context);
    const pages: Page[] = [];
    context.on("page", (page) => pages.push(page));

    await use(context);
    await context.close();

    // The video is finalized on close; add sound to the first page's recording,
    // then wrap it with the logo intro/outro.
    const video = pages[0]?.video();
    if (video) {
      // Stable output name in demo/output/videos (only the walkthrough records).
      const finalMp4 = path.resolve(videoDir, "chempal-demo-sfx.mp4");
      const sfxMp4 = await addSfxToVideo(await video.path(), finalMp4);
      if (sfxMp4) {
        await addIntroOutro(sfxMp4);
      }
    }
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
