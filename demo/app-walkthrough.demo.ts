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

/**
 * Guided walkthrough that opens the extension in the full browser-tab view
 * (`index.html?view=tab`, desktop-sized) and runs a live search against the
 * saved mock data — no supplier requests hit the network (`fallback: "abort"`).
 */
test("ChemPal search walkthrough", async ({ context, extensionId }) => {
  const page = await context.newPage();

  // Wire hermetic mocking BEFORE navigating so nothing escapes to the internet.
  await setupMockRoutes(page, {
    responsesDir: mockResponsesDir,
    fallback: "abort",
    verbose: false,
  });

  // Full browser-tab view (?view=tab): fills the desktop window.
  await page.goto(`chrome-extension://${extensionId}/index.html?view=tab`);

  const searchInput = page.getByRole("textbox", { name: "search for products" });
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1000);

  // 1. Point out the search box.
  await highlight(searchInput);
  await showDemoPopover(page, searchInput, "Type a chemical name to search");
  await page.waitForTimeout(1800);

  // 2. Type the query, character by character.
  await typeInto(searchInput, "sodium borohydride");
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

  // --- Column visibility ---
  const columnsButton = page.getByRole("button", { name: "Show or hide columns" });
  await highlight(columnsButton);
  await showDemoPopover(page, columnsButton, "Show or hide any column");
  await page.waitForTimeout(1400);
  await closeDemoPopover(page);
  await clearHighlight(columnsButton);
  await columnsButton.click();

  // Toggle the PubChem column off, then back on, so the effect is visible.
  const pubchemToggle = page.getByRole("checkbox", { name: "PubChem" });
  await expect(pubchemToggle).toBeVisible({ timeout: 5_000 });
  await pubchemToggle.click();
  await page.waitForTimeout(1200);
  await pubchemToggle.click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");

  // --- Column filters ---
  const filterButton = page.getByRole("button", { name: "Toggle column filters" });
  await highlight(filterButton);
  await showDemoPopover(page, filterButton, "Filter results by column");
  await page.waitForTimeout(1400);
  await closeDemoPopover(page);
  await clearHighlight(filterButton);
  await filterButton.click();

  // Type into the Title column's filter to narrow the results.
  const titleFilter = page.getByPlaceholder("Title...");
  await expect(titleFilter).toBeVisible({ timeout: 5_000 });
  await highlight(titleFilter);
  await showDemoPopover(page, titleFilter, "Filter by product name");
  await page.waitForTimeout(1200);
  await typeInto(titleFilter, "Sodium Borohydride");
  await page.waitForTimeout(2000);
  await closeDemoPopover(page);
  await clearHighlight(titleFilter);
  await page.screenshot({ path: path.join(screenshotDir, "walkthrough-filtered.png") });

  // Clear the filter, then hide the filter row again.
  await page.getByRole("button", { name: "Clear all filters" }).click();
  await page.waitForTimeout(1000);
  await filterButton.click();
  await page.waitForTimeout(800);

  // Give the just-recorded price series 2–4 points each, then expand a product
  // to reveal the price-history sparkline in its detail panel.
  const seeded = await seedPriceHistoryFromResults(page);
  console.log(`[demo] Seeded price history: ${seeded.series} series, ${seeded.points} points`);

  const priceHistoryLabel = await expandFirstProductDetail(page);
  await priceHistoryLabel.scrollIntoViewIfNeeded();

  // Product-level: the sparkline + percentage next to the label — the average
  // trend across the product and all its variants.
  const avgTrend = priceHistoryLabel.locator(
    "xpath=following-sibling::span[contains(@class,'detail-value')]",
  );
  await highlight(avgTrend);
  await showDemoPopover(page, avgTrend, "Average price trend across the product & its variants");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotDir, "walkthrough-avg-trend.png") });
  await page.waitForTimeout(1500);
  await closeDemoPopover(page);
  await clearHighlight(avgTrend);

  // Per-variant: each variant carries its own tracked trend.
  const variantTrends = page.locator(".variant-trend").filter({ hasText: "%" });
  await variantTrends.first().scrollIntoViewIfNeeded();
  await highlightGroup(page, variantTrends);
  await showDemoPopover(page, variantTrends.first(), "Every variant has its trend monitored too");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotDir, "walkthrough-variant-trends.png") });
  await page.waitForTimeout(1500);
  await closeDemoPopover(page);
  await clearGroupHighlight(page);

  // --- Ignore a product (right-click → Ignore Product) ---
  const ignoreRow = resultsTable.locator("tbody tr").first();
  await ignoreRow.scrollIntoViewIfNeeded();
  await highlight(ignoreRow);
  await showDemoPopover(page, ignoreRow, "Right-click any product…");
  await page.waitForTimeout(1500);
  await closeDemoPopover(page);
  await clearHighlight(ignoreRow);
  await ignoreRow.click({ button: "right" });

  const ignoreItem = page.getByRole("menuitem", { name: "Ignore Product" });
  await expect(ignoreItem).toBeVisible({ timeout: 5_000 });
  await highlight(ignoreItem);
  await showDemoPopover(page, ignoreItem, "…to hide it from the results");
  await page.waitForTimeout(1800);
  await closeDemoPopover(page);
  await ignoreItem.click();
  await page.waitForTimeout(1200);

  // --- Second search: refine suppliers via the right-hand side panel ---
  const optionsButton = page.getByRole("button", { name: "Open options" });
  await highlight(optionsButton);
  await showDemoPopover(page, optionsButton, "Open the side panel to refine your search");
  await page.waitForTimeout(1500);
  await closeDemoPopover(page);
  await clearHighlight(optionsButton);
  await optionsButton.click();

  // The drawer opens on Settings; switch to the Search tab.
  const searchTab = page.getByRole("tab", { name: "SEARCH" });
  await expect(searchTab).toBeVisible({ timeout: 5_000 });
  await searchTab.click();
  await page.waitForTimeout(600);

  // Expand the supplier section and pick a single supplier.
  await page.getByRole("button", { name: /search suppliers/i }).click();
  const supplierInput = page.getByRole("combobox", { name: "Filter by search suppliers" });
  await expect(supplierInput).toBeVisible({ timeout: 5_000 });
  await highlight(supplierInput);
  await showDemoPopover(page, supplierInput, "Narrow the search to a single supplier");
  await page.waitForTimeout(1400);
  await closeDemoPopover(page);
  await clearHighlight(supplierInput);
  await typeInto(supplierInput, "AladdinSci");
  await page.getByRole("option", { name: "AladdinSci" }).first().click();
  await page.waitForTimeout(500);
  // Dismiss the still-open supplier dropdown (Escape only closes the popup, not
  // the drawer) so it doesn't overlap the query field.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // The query field is cleared after the prior search — retype it, then re-run.
  // Scope to the Search tab panel and match the textbox role (the label alone is
  // ambiguous — MUI exposes it on two nodes).
  const drawerQuery = page
    .locator("#drawer-tabpanel-0")
    .getByRole("textbox", { name: "Product name or keyword" })
    .first();
  await drawerQuery.fill("");
  await typeInto(drawerQuery, "Sodium Borohydride");
  const drawerSearch = page.getByRole("button", { name: "Search", exact: true });
  await highlight(drawerSearch);
  await showDemoPopover(page, drawerSearch, "Run the search again with these suppliers");
  await page.waitForTimeout(1400);
  await closeDemoPopover(page);
  await clearHighlight(drawerSearch);
  await drawerSearch.click();

  // The drawer closes and the supplier-scoped search runs.
  const backdrop2 = page.locator("#loading-backdrop");
  await expect(backdrop2).toBeVisible({ timeout: 10_000 });
  await expect(backdrop2).toBeHidden({ timeout: 120_000 });
  await expect(resultsTable.locator("tbody tr td").first()).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(screenshotDir, "walkthrough-supplier-search.png") });

  // Final beauty shot for the deck.
  await page.screenshot({ path: path.join(screenshotDir, "walkthrough-results.png") });
  await page.waitForTimeout(1000);
});
