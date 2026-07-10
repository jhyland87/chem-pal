import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupMockRoutes } from "../e2e/helpers/mockRoutes";
import { clearHighlight, closeDemoPopover, highlight, showDemoPopover } from "./helpers";
import { expect, test } from "./fixtures";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const mockResponsesDir = path.resolve(dirname, "..", "e2e", "mock-requests", "responses");
const screenshotDir = path.resolve(dirname, "..", "demo-results", "screenshots");

/**
 * Guided walkthrough that opens the extension "as the popup" (800x600 window,
 * plain `index.html` with no `?view=tab`) and runs a live search against the
 * saved mock data — no supplier requests hit the network (`fallback: "abort"`).
 */
test("ChemPal popup search walkthrough", async ({ context, extensionId }) => {
  const page = await context.newPage();

  // Wire hermetic mocking BEFORE navigating so nothing escapes to the internet.
  await setupMockRoutes(page, {
    responsesDir: mockResponsesDir,
    fallback: "abort",
    verbose: false,
  });

  // Popup mode: plain index.html (no ?view=tab). The 800x600 viewport from the
  // fixture makes this read as the toolbar popup.
  await page.goto(`chrome-extension://${extensionId}/index.html`);

  const searchInput = page.getByRole("textbox", { name: "search for products" });
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1000);

  // 1. Point out the search box.
  await highlight(searchInput);
  await showDemoPopover(page, searchInput, "Type a chemical name to search");
  await page.waitForTimeout(1800);

  // 2. Type the query.
  await searchInput.fill("sodium borohydride");
  await page.waitForTimeout(800);
  await closeDemoPopover(page);
  await clearHighlight(searchInput);

  // 3. Run the search.
  const searchButton = page.getByRole("button", { name: "search" });
  await highlight(searchButton);
  await showDemoPopover(page, searchButton, "Search every supplier at once");
  await page.waitForTimeout(1200);
  await closeDemoPopover(page);
  await searchButton.click();

  // 4. Wait for the search to complete: the backdrop appears while suppliers
  // stream in, then disappears once every supplier finishes.
  const backdrop = page.locator("#loading-backdrop");
  await expect(backdrop).toBeVisible({ timeout: 10_000 });
  await expect(backdrop).toBeHidden({ timeout: 120_000 });

  // 5. Show all rows (skip pagination) and highlight the results.
  await page.locator('[aria-label="rows per page"]').click();
  await page.getByRole("option", { name: "All" }).click();

  const resultsTable = page.locator("table").nth(1);
  await expect(resultsTable.locator("tbody tr td").first()).toBeVisible({ timeout: 5_000 });

  const rowCount = await resultsTable
    .locator("tbody tr")
    .filter({ has: page.locator("td") })
    .count();
  expect(rowCount).toBeGreaterThanOrEqual(20);

  await highlight(resultsTable);
  await showDemoPopover(page, resultsTable, "Live results from many suppliers, ranked by match");
  await page.waitForTimeout(2500);
  await closeDemoPopover(page);
  await clearHighlight(resultsTable);

  // Final beauty shot for the deck.
  await page.screenshot({ path: path.join(screenshotDir, "walkthrough-results.png") });
  await page.waitForTimeout(1000);
});
