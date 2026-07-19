import { execSync } from "node:child_process";
import path from "node:path";
import { type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const buildDir = path.resolve(__dirname, "..", "build");

/**
 * Widths swept by the overflow check. Spans well below the popup's 800px floor
 * (where the regression lived), the floor itself, and comfortably above it.
 */
const VIEWPORT_WIDTHS = [320, 360, 400, 480, 600, 768, 800, 1024, 1280];

/**
 * The toolbar popup is sized for ~800px wide, but the same `index.html` also
 * renders in a browser tab (`?view=tab`) at whatever width the window happens
 * to be. A hard `min-width` on `<body>` used to apply in both contexts, forcing
 * the document to 800px in the tab view and overflowing horizontally at any
 * narrower window — content pinned to the left, dead space to the right.
 *
 * These tests load the real unpacked extension and assert the document never
 * grows wider than its viewport.
 */
describe("tab-view layout across viewport widths", () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;

  beforeAll(async () => {
    // Build the production bundle rather than assuming another spec left one
    // behind — file order isn't guaranteed, and a stale build/ would test the
    // wrong CSS.
    execSync("pnpm build:e2e", { cwd: path.resolve(__dirname, ".."), stdio: "inherit" });

    context = await chromium.launchPersistentContext("", {
      // Extensions require headed mode in Chromium.
      headless: false,
      viewport: { width: VIEWPORT_WIDTHS[0], height: 800 },
      args: [
        `--disable-extensions-except=${buildDir}`,
        `--load-extension=${buildDir}`,
        "--no-first-run",
        "--disable-gpu",
        "--no-default-browser-check",
      ],
    });

    const swTarget = context.serviceWorkers().length
      ? context.serviceWorkers()[0]
      : await context.waitForEvent("serviceworker");
    extensionId = swTarget.url().split("/")[2];
    page = await context.newPage();
  }, 60_000);

  afterAll(async () => {
    await context?.close();
  });

  it.each(VIEWPORT_WIDTHS)("does not overflow horizontally at %ipx", async (width) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`chrome-extension://${extensionId}/index.html?view=tab`);
    await page.waitForSelector("#root");

    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      rootWidth: document.getElementById("root")?.scrollWidth ?? 0,
    }));

    // scrollWidth > innerWidth is exactly what produces the horizontal scrollbar.
    expect(metrics.documentWidth, `document overflows at ${width}px`).toBeLessThanOrEqual(
      metrics.viewport,
    );
    expect(metrics.bodyWidth, `body overflows at ${width}px`).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.rootWidth, `#root overflows at ${width}px`).toBeLessThanOrEqual(
      metrics.viewport,
    );
  }, 60_000);

  it("keeps the popup's 800px floor when not in the tab view", async () => {
    // The floor is what makes the popup open at a usable size, so narrowing the
    // tab view must not cost the popup its minimum width.
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await page.waitForSelector("#root");

    const bodyMinWidth = await page.evaluate(() => getComputedStyle(document.body).minWidth);
    expect(bodyMinWidth).toBe("800px");
  }, 60_000);
});
