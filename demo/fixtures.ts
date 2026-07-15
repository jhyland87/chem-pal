import { test as base, type BrowserContext, chromium, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installCursorOverlay } from "./cursor";
import { installKeycapsOverlay } from "./keycaps";
import { addIntroOutro, addSfxToVideo, installSfxCapture, startSfxTimeline } from "./sfx";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(dirname, "..", "build");
const videoDir = path.resolve(dirname, "output", "videos");

/**
 * Reads the extension version from the built manifest so the demo video can be
 * named per release (e.g. `chempal-demo-sfx_v1.1.0.mp4`). Returns undefined if
 * the manifest is missing or has no string version, so the caller can fall back
 * to an unversioned name.
 * @param manifestPath - Path to the built `manifest.json`.
 * @returns The version string (e.g. `"1.1.0"`), or undefined.
 * @example
 * ```ts
 * await readManifestVersion("/…/build/manifest.json"); // => "1.1.0"
 * ```
 * @source
 */
async function readManifestVersion(manifestPath: string): Promise<string | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    if (parsed && typeof parsed === "object" && "version" in parsed) {
      const version = parsed.version;
      if (typeof version === "string" && version.length > 0) {
        return version;
      }
    }
  } catch {
    // Missing/unreadable manifest — fall through to the unversioned name.
  }
  return undefined;
}

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
    // Draw a visible arrow pointer + click ripple in the recorded page.
    await installCursorOverlay(context);
    // Flash on-screen keycaps when the walkthrough fires keyboard shortcuts.
    await installKeycapsOverlay(context);
    const pages: Page[] = [];
    context.on("page", (page) => pages.push(page));

    await use(context);
    await context.close();

    // The video is finalized on close; add sound to the first page's recording,
    // then wrap it with the logo intro/outro.
    const video = pages[0]?.video();
    if (video) {
      // Name the output per release, e.g. chempal-demo-sfx_v1.1.0.mp4 (falls back
      // to an unversioned name if the manifest version can't be read). Overwrites
      // any existing file of the same name.
      const version = await readManifestVersion(path.resolve(buildDir, "manifest.json"));
      const baseName = version ? `chempal-demo-sfx_v${version}` : "chempal-demo-sfx";
      const finalMp4 = path.resolve(videoDir, `${baseName}.mp4`);
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
