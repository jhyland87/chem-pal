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
  smoothScrollIntoView,
  smoothScrollToTop,
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
    // Supplier API calls stay hermetic (aborted), but let product images and the
    // currency-rate API through so photos render and currency switching works live.
    allowImages: true,
    allowHosts: ["hexarate.paikama.co"],
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

  // 4. The loading backdrop appears while suppliers stream in and shows a Cancel
  // button; it disappears once every supplier finishes.
  const backdrop = page.locator("#loading-backdrop");
  // Plain CSS on the DOM <button> — getByRole can miss it inside the backdrop's
  // a11y subtree. Wait on the button directly so we catch it while it's up.
  const cancelSearch = backdrop.locator("button");

  // While the search is still loading, point out the Cancel button (without
  // clicking it). Guarded so a fast-finishing search can't fail the demo.
  try {
    await expect(cancelSearch).toBeVisible({ timeout: 10_000 });
    await highlight(cancelSearch);
    await showDemoPopover(
      page,
      cancelSearch,
      "Canceling the current search will preserve any results that have already been found",
    );
    await page.waitForTimeout(2200);
    await closeDemoPopover(page);
    await clearHighlight(cancelSearch);
  } catch (error) {
    console.warn("[demo] Cancel-button highlight skipped:", error);
    await closeDemoPopover(page);
  }

  await expect(backdrop).toBeHidden({ timeout: 120_000 });

  // 5. Ease down to the pagination controls, switch to showing every result on
  // one page, then ease back up to the top — smooth scrolls, not jumps.
  const resultsTable = page.locator("table").nth(1);
  await expect(resultsTable.locator("tbody tr td").first()).toBeVisible({ timeout: 5_000 });

  const rowsPerPage = page.locator('[aria-label="rows per page"]');
  await smoothScrollIntoView(page, rowsPerPage, "end");
  await rowsPerPage.click();
  await page.getByRole("option", { name: "All" }).click();
  await page.waitForTimeout(700);
  await smoothScrollToTop(page, resultsTable);

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

  // Hover a variant's trend to reveal its price-history popover — a sparkline
  // and the dated list of previous prices — then highlight and explain it.
  const hoverTrend = variantTrends.first();
  await hoverTrend.scrollIntoViewIfNeeded();
  await hoverTrend.hover();
  const trendPopup = page.locator(".MuiTooltip-tooltip").first();
  await expect(trendPopup).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(700);
  await highlight(trendPopup);
  await showDemoPopover(
    page,
    trendPopup,
    "The previous prices are viewable when hovering over it",
  );
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(screenshotDir, "walkthrough-variant-trend-hover.png") });
  await closeDemoPopover(page);
  await clearHighlight(trendPopup);
  // Move the mouse away so the hover popover dismisses before the next step.
  await page.mouse.move(2, 2);
  await page.waitForTimeout(500);

  // --- Drawer: History tab + live currency switching (detail panel still open) ---
  const optionsBtn = page.getByRole("button", { name: "Open options" });
  await highlight(optionsBtn);
  await showDemoPopover(page, optionsBtn, "Open the side panel for history and settings");
  await page.waitForTimeout(1200);
  await closeDemoPopover(page);
  await clearHighlight(optionsBtn);
  await optionsBtn.click();

  // Open the History tab to reveal past searches — but don't click an entry
  // (that would re-run that search).
  const historyTab = page.getByRole("tab", { name: "HISTORY" });
  await expect(historyTab).toBeVisible({ timeout: 5_000 });
  await historyTab.click();
  await page.waitForTimeout(700);
  const historyPanel = page.locator("#drawer-tabpanel-1");
  await expect(historyPanel).toBeVisible({ timeout: 5_000 });
  await highlight(historyPanel);
  await showDemoPopover(page, historyPanel, "Every search you run is saved here — one click re-runs it");
  await page.waitForTimeout(2200);
  await closeDemoPopover(page);
  await clearHighlight(historyPanel);

  // Switch to Settings and change currency — watch every price convert live.
  await page.getByRole("tab", { name: "SETTINGS" }).click();
  await page.waitForTimeout(600);
  const currencyInput = page.locator("#drawer-tabpanel-2").getByPlaceholder("Currency");
  await expect(currencyInput).toBeVisible({ timeout: 5_000 });
  await highlight(currencyInput);
  await showDemoPopover(page, currencyInput, "Switch currency — every price on screen converts instantly");
  await page.waitForTimeout(1200);

  // USD → PLN
  await currencyInput.click();
  await currencyInput.fill("PLN");
  const plnOption = page.getByRole("option", { name: "PLN (zł)" }).first();
  await expect(plnOption).toBeVisible({ timeout: 5_000 });
  await plnOption.click();
  await page.waitForTimeout(2200);

  // PLN → USD
  await currencyInput.click();
  await currencyInput.fill("USD");
  const usdOption = page.getByRole("option", { name: "USD ($)" }).first();
  await expect(usdOption).toBeVisible({ timeout: 5_000 });
  await usdOption.click();
  await page.waitForTimeout(1800);

  await closeDemoPopover(page);
  await clearHighlight(currencyInput);
  // Close the drawer by clicking the backdrop (to the left of the right-anchored drawer).
  await page.mouse.click(30, 400);
  await page.waitForTimeout(700);

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
