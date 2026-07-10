import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Expand the first expandable product row so its detail panel (with the price
 * history sparkline) renders, and wait for the "Price history" label to appear.
 * Only rows with expandable detail render an expander button in their first
 * cell, so clicking the first such button reliably opens a real detail panel.
 * @param page - A page showing the results table.
 * @returns The "Price history (…)" label locator inside the opened panel, for
 *   highlighting.
 * @example
 * ```ts
 * const priceHistoryLabel = await expandFirstProductDetail(page);
 * await highlight(priceHistoryLabel);
 * ```
 * @source
 */
export async function expandFirstProductDetail(page: Page): Promise<Locator> {
  const resultsTable = page.locator("table").nth(1);
  const expander = resultsTable.locator("tbody tr td:first-child button").first();
  await expect(expander).toBeVisible({ timeout: 5_000 });
  await expander.click();

  // The label always renders in the panel (tracking is on by default); it shows
  // the sparkline when the series has ≥2 points.
  const priceHistoryLabel = page.getByText(/Price history/i).first();
  await expect(priceHistoryLabel).toBeVisible({ timeout: 5_000 });
  return priceHistoryLabel;
}
