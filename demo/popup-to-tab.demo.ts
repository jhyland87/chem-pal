import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupMockRoutes } from "../e2e/helpers/mockRoutes";
import {
  clearGroupHighlight,
  clearHighlight,
  closeDemoPopover,
  highlight,
  highlightGroup,
  showDemoPopover,
  typeInto,
} from "./helpers";
import { seedPriceHistoryFromResults } from "./seedPriceHistory";
import { expandFirstProductDetail } from "./expandDetail";
import { expect, test } from "./fixtures";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const mockResponsesDir = path.resolve(dirname, "..", "e2e", "mock-requests", "responses");
const screenshotDir = path.resolve(dirname, "..", "demo-results", "screenshots");
const stitchedVideo = path.resolve(dirname, "..", "demo-results", "popup-to-tab-full.webm");

/**
 * Concatenate the popup clip and the tab clip into one continuous video with
 * ffmpeg. Both clips share the context's 800x600 recording canvas, so a plain
 * concat (no rescaling) joins them cleanly. Best-effort: logs and returns if
 * ffmpeg is missing or a clip path is unavailable, so it never fails the demo.
 */
function stitchClips(popupClip: string | undefined, tabClip: string | undefined): void {
  if (!popupClip || !tabClip || !existsSync(popupClip) || !existsSync(tabClip)) {
    console.warn("[demo] Skipping stitch — a video clip was not available.", {
      popupClip,
      tabClip,
    });
    return;
  }
  try {
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        popupClip,
        "-i",
        tabClip,
        "-filter_complex",
        "[0:v:0][1:v:0]concat=n=2:v=1:a=0[outv]",
        "-map",
        "[outv]",
        stitchedVideo,
      ],
      { stdio: "inherit" },
    );
    console.log(`[demo] Stitched popup→tab video written to ${stitchedVideo}`);
  } catch (error) {
    console.warn("[demo] ffmpeg stitch failed (is ffmpeg installed?):", { error });
  }
}

/**
 * Popup → tab handoff walkthrough. Opens the extension "as the popup" (the
 * fixture's 800x600 window), clicks the "Open in tab" button, follows the newly
 * opened full-tab page, scales it up to a desktop viewport, and runs a search
 * there — all while the fixture records video.
 *
 * Note on sizing: the popup renders `#root` at min-width 800px (`src/App.scss`),
 * so the "popup" stage sizes its page to 800x600 (a 360px window would force
 * horizontal scroll and look broken); the tab stage scales up to 1280x800.
 *
 * Skipped by default — the main demo runs entirely in the browser-tab view
 * (see app-walkthrough.demo.ts). Kept here for the popup→tab handoff if needed;
 * remove `.skip` to run it.
 */
test.skip("ChemPal popup-to-tab walkthrough", async ({ context, extensionId }) => {
  // --- STAGE 1: the "popup" ---
  const popupPage = await context.newPage();
  // Size this page down to popup dimensions (the fixture defaults to desktop).
  await popupPage.setViewportSize({ width: 800, height: 600 });
  // Grab the Video handle now; its path is read after the page closes below.
  const popupVideo = popupPage.video();
  await setupMockRoutes(popupPage, { responsesDir: mockResponsesDir, fallback: "abort" });
  await popupPage.goto(`chrome-extension://${extensionId}/index.html`);

  const popupSearch = popupPage.getByRole("textbox", { name: "search for products" });
  await expect(popupSearch).toBeVisible({ timeout: 10_000 });
  await popupPage.waitForTimeout(1200);

  // Show what the popup is, and type a query into it.
  await highlight(popupSearch);
  await showDemoPopover(popupPage, popupSearch, "The popup — quick searches live here");
  await popupPage.waitForTimeout(1800);
  await typeInto(popupSearch, "sodium borohydride");
  await popupPage.waitForTimeout(600);
  await closeDemoPopover(popupPage);
  await clearHighlight(popupSearch);

  // Point out the "open in tab" button.
  const openInTab = popupPage.getByRole("button", { name: "Open in tab" });
  await highlight(openInTab);
  await showDemoPopover(popupPage, openInTab, "Open the full app in a browser tab");
  await popupPage.waitForTimeout(1800);
  await closeDemoPopover(popupPage);

  // --- STAGE 2: the handoff ---
  // openExtensionTab() calls chrome.tabs.create(), which opens a new page in
  // this context. Start listening BEFORE the click so we catch it.
  const tabPromise = context.waitForEvent("page");
  await openInTab.click();
  const appTab = await tabPromise;
  const appVideo = appTab.video();
  await appTab.waitForLoadState();

  // Scale up to a desktop experience and focus the new tab.
  await appTab.setViewportSize({ width: 1280, height: 800 });
  await appTab.bringToFront();

  // --- STAGE 3: drive the full-tab app ---
  await setupMockRoutes(appTab, { responsesDir: mockResponsesDir, fallback: "abort" });

  const tabSearch = appTab.getByRole("textbox", { name: "search for products" });
  await expect(tabSearch).toBeVisible({ timeout: 10_000 });
  await appTab.waitForTimeout(1000);

  await highlight(tabSearch);
  await showDemoPopover(appTab, tabSearch, "Same search, now full-width");
  await appTab.waitForTimeout(1500);
  await typeInto(tabSearch, "sodium borohydride");
  await closeDemoPopover(appTab);
  await clearHighlight(tabSearch);

  // Run the search and wait for it to finish (backdrop visible → hidden).
  await appTab.getByRole("button", { name: "search" }).click();
  const backdrop = appTab.locator("#loading-backdrop");
  await expect(backdrop).toBeVisible({ timeout: 10_000 });
  await expect(backdrop).toBeHidden({ timeout: 120_000 });

  await appTab.locator('[aria-label="rows per page"]').click();
  await appTab.getByRole("option", { name: "All" }).click();

  const resultsTable = appTab.locator("table").nth(1);
  await expect(resultsTable.locator("tbody tr td").first()).toBeVisible({ timeout: 5_000 });
  await highlight(resultsTable);
  await showDemoPopover(appTab, resultsTable, "The full results view, in its own tab");
  await appTab.waitForTimeout(2500);
  await closeDemoPopover(appTab);
  await clearHighlight(resultsTable);

  // Enrich the recorded price series to 2–4 points each, then expand a product
  // to show the price-history sparkline in the full-width detail panel.
  const seeded = await seedPriceHistoryFromResults(appTab);
  console.log(`[demo] Seeded price history: ${seeded.series} series, ${seeded.points} points`);

  const priceHistoryLabel = await expandFirstProductDetail(appTab);
  await priceHistoryLabel.scrollIntoViewIfNeeded();

  // Product-level average trend: the sparkline + percentage next to the label.
  const avgTrend = priceHistoryLabel.locator(
    "xpath=following-sibling::span[contains(@class,'detail-value')]",
  );
  await highlight(avgTrend);
  await showDemoPopover(appTab, avgTrend, "Average price trend across the product & its variants");
  await appTab.waitForTimeout(2500);
  await closeDemoPopover(appTab);
  await clearHighlight(avgTrend);

  // Per-variant trends: each variant carries its own tracked trend.
  const variantTrends = appTab.locator(".variant-trend").filter({ hasText: "%" });
  await variantTrends.first().scrollIntoViewIfNeeded();
  await highlightGroup(appTab, variantTrends);
  await showDemoPopover(appTab, variantTrends.first(), "Every variant has its trend monitored too");
  await appTab.waitForTimeout(2500);
  await closeDemoPopover(appTab);
  await clearGroupHighlight(appTab);

  await appTab.screenshot({ path: path.join(screenshotDir, "popup-to-tab-results.png") });
  await appTab.waitForTimeout(1000);

  // Close both pages so their videos are flushed to disk, then read the clip
  // paths and stitch popup + tab into one continuous demo video.
  await appTab.close();
  if (!popupPage.isClosed()) await popupPage.close();

  const popupClip = await popupVideo?.path();
  const tabClip = await appVideo?.path();
  stitchClips(popupClip, tabClip);
});
