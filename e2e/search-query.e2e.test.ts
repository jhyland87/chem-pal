import { expect as playwrightExpect } from "@playwright/test";
import { execSync } from "node:child_process";
import path from "node:path";
import { type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, it, expect as vitestExpect } from "vitest";
import { setupMockRoutes } from "./helpers/mockRoutes";

const buildDir = path.resolve(__dirname, "..", "build");
const mockResponsesDir = path.resolve(__dirname, "mock-requests/responses");

describe("Chem-Pal search query", () => {
  let context: BrowserContext;
  let extensionId: string;

  beforeAll(async () => {
    // Build the extension (standard mode, not aggregate)
    execSync("pnpm build", {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
    });

    // Launch Chrome with the extension loaded
    context = await chromium.launchPersistentContext("", {
      headless: false, // Extensions require headed mode in Chromium
      args: [
        `--disable-extensions-except=${buildDir}`,
        `--load-extension=${buildDir}`,
        "--no-first-run",
        "--disable-gpu",
        "--no-default-browser-check",
        //"--auto-open-devtools-for-tabs",
      ],
    });

    // Wait for the service worker to register, which gives us the extension ID
    const swTarget = context.serviceWorkers().length
      ? context.serviceWorkers()[0]
      : await context.waitForEvent("serviceworker");

    extensionId = swTarget.url().split("/")[2];
  }, 60_000);

  afterAll(async () => {
    await context?.close();
  });

  /**
   * Wipe all per-test persistent state so each `it` starts from a clean
   * slate: the `chempal` IndexedDB (search results, history, supplier query
   * cache, product-detail cache, stats, excluded products) and both
   * `chrome.storage` areas (user_settings + session keys like the current
   * query / is-new-search flag).
   *
   * Without this, later tests reopen the extension and either (a) see the
   * previous run's rows hydrated from the `searchResults` store on mount,
   * or (b) hit the supplier query cache with stale, scorer-specific results
   * — both of which invalidate the per-test assertions.
   *
   * Runs in its own throwaway page so no test has to share cleanup work
   * with its own `openExtension()` page — keeps `it` blocks self-contained.
   */
  beforeEach(async () => {
    if (!extensionId) return; // `beforeAll` hasn't finished (shouldn't happen)

    const resetPage = await context.newPage();
    try {
      await resetPage.goto(`chrome-extension://${extensionId}/index.html`);
      await resetPage.evaluate(async () => {
        // Nuke the whole IndexedDB; re-created fresh on the next open.
        await new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase("chempal");
          req.onsuccess = () => resolve();
          // Swallow errors/blocks: worst case the DB is already gone or held
          // open by the tab we're running in, which doesn't actually matter
          // because the test re-opens a new page that will see an empty DB.
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
        await new Promise<void>((resolve) => chrome.storage.local.clear(() => resolve()));
        await new Promise<void>((resolve) => chrome.storage.session.clear(() => resolve()));
      });
    } finally {
      await resetPage.close();
    }
  });

  /**
   * Open a fresh extension page with hermetic mock routing already wired up.
   *
   * Every test in this file goes through this helper so the default is
   * always "mock or abort" — no test can accidentally escape to the live
   * internet, and supplier result counts stay deterministic even on CI where
   * supplier IPs get blocked. `fallback: "abort"` fails any request that
   * isn't covered by a saved mock, which is what we want: an unmocked request
   * should be a test-authoring signal, not silently-inflated results.
   */
  async function openExtension(): Promise<Page> {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await setupMockRoutes(page, {
      responsesDir: mockResponsesDir,
      // DO NOT CHANGE THIS TO "passthrough" - No need to spam the suppliers
      // for every test.
      fallback: "abort",
      verbose: false,
    });
    await playwrightExpect(page.getByRole("textbox", { name: "search for products" })).toBeVisible({
      timeout: 10_000,
    });

    return page;
  }

  /**
   * Seed `userSettings.fuzzScorerOverride` in `chrome.storage.local` and
   * reload the page so the App's mount effect picks it up. `useStorageCompression`
   * is `false` in config.json, so we can write plain JSON without LZ wrapping.
   * Keeps the existing per-location default for `currency`/`location` so the
   * suppliers behave the same as they would in the happy-path test — the only
   * variable under test is the scorer.
   */
  async function setFuzzScorerOverride(page: Page, scorer: string): Promise<void> {
    await page.evaluate((scorerName) => {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.get(["user_settings"], (existing) => {
          const merged = {
            ...(existing.user_settings ?? {}),
            fuzzScorerOverride: scorerName,
          };
          chrome.storage.local.set({ user_settings: merged }, () => {
            const err = chrome.runtime.lastError;
            if (err) reject(new Error(err.message));
            else resolve();
          });
        });
      });
    }, scorer);
    await page.reload();
    await playwrightExpect(page.getByRole("textbox", { name: "search for products" })).toBeVisible({
      timeout: 10_000,
    });
  }

  /**
   * Run the "potassium" search under a specific `fuzzScorerOverride` and
   * return the number of data rows the results table renders after the
   * search completes. Mirrors the waiting + page-size pattern used by the
   * happy-path test so counts stay comparable.
   */
  async function potassiumRowCountWithScorer(scorer: string): Promise<number> {
    const page = await openExtension();
    try {
      await setFuzzScorerOverride(page, scorer);

      const searchInput = page.getByRole("textbox", { name: "search for products" });
      await searchInput.fill("potassium");
      await page.getByRole("button", { name: "search" }).click();

      const backdrop = page.locator("#loading-backdrop");
      await playwrightExpect(backdrop).toBeVisible({ timeout: 10_000 });
      await playwrightExpect(backdrop).toBeHidden({ timeout: 120_000 });

      // Show all rows so the count is total, not paged.
      const pageSizeSelect = page.locator('[aria-label="rows per page"]');
      await pageSizeSelect.click();
      await page.getByRole("option", { name: "All" }).click();

      const resultsTable = page.locator("table").nth(1);
      const rowCount = await resultsTable
        .locator("tbody tr")
        .filter({ has: page.locator("td") })
        .count();
      return rowCount;
    } finally {
      await page.close();
    }
  }

  it("should load the extension and display the search input", async () => {
    vitestExpect(extensionId).toBeTruthy();

    const page = await openExtension();

    const searchInput = page.getByRole("textbox", {
      name: "search for products",
    });

    // Verify it has the expected placeholder
    await playwrightExpect(searchInput).toHaveAttribute("placeholder", "Search for products...");

    // Verify we can type into it
    await searchInput.fill("sodium chloride");
    await playwrightExpect(searchInput).toHaveValue("sodium chloride");

    await page.close();
  }, 30_000);

  it("should produce 94 results for 'potassium' when fuzzScorerOverride is 'WRatio'", async () => {
    const rowCount = await potassiumRowCountWithScorer("WRatio");
    vitestExpect(rowCount).toBe(94);
  }, 200_000);

  it("should produce 25 results for 'potassium' when fuzzScorerOverride is 'ratio'", async () => {
    const rowCount = await potassiumRowCountWithScorer("ratio");
    vitestExpect(rowCount).toBe(25);
  }, 200_000);

  it("should display 'No results found' for a query that matches nothing", async () => {
    const page = await openExtension();

    const query = "this should not return any results";

    const searchInput = page.getByRole("textbox", { name: "search for products" });
    await searchInput.fill(query);
    await page.getByRole("button", { name: "search" }).click();

    // Wait for search completion the same way the happy-path test does:
    // backdrop appears, then disappears once every supplier finishes.
    const backdrop = page.locator("#loading-backdrop");
    await playwrightExpect(backdrop).toBeVisible({ timeout: 10_000 });
    await playwrightExpect(backdrop).toBeHidden({ timeout: 120_000 });

    // Assert the results panel is showing the "no results" empty state.
    // `buildNoResultsMessage` emits a line starting with `No results found
    // for "<query>"` — match the prefix so a trailing PubChem-suggestion
    // hint (added when the query resolves to a known compound alias) doesn't
    // make the assertion brittle.
    const resultsTable = page.locator("table").nth(1);
    const emptyCell = resultsTable.locator("tbody td").first();
    await playwrightExpect(emptyCell).toContainText(`No results found for "${query}"`, {
      timeout: 5_000,
    });

    // And there really are zero data rows — only the empty-state row exists.
    const dataRowCount = await resultsTable
      .locator('tbody tr[role="row"], tbody tr[data-rowid]')
      .count();
    vitestExpect(dataRowCount).toBe(0);

    await page.close();
  }, 200_000);

  it("should query for 'potassium' and display 16 results from mock data", async () => {
    const page = await openExtension();

    // Type the search query and submit (mock routes + "abort" fallback are
    // already wired up by `openExtension()` — see that helper for the why).
    const searchInput = page.getByRole("textbox", {
      name: "search for products",
    });
    await searchInput.fill("potassium");
    await page.getByRole("button", { name: "search" }).click();

    // Wait for search to complete: the #loading-backdrop overlay is visible
    // while the suppliers are still streaming in results, and disappears
    // when every supplier has finished. Waiting on the backdrop (rather
    // than on a specific result count) makes the test robust to changes in
    // how many mock responses each supplier contributes.
    const backdrop = page.locator("#loading-backdrop");
    // The backdrop should appear shortly after the search is submitted.
    await playwrightExpect(backdrop).toBeVisible({ timeout: 10_000 });
    // Then wait for it to go away as suppliers complete.
    await playwrightExpect(backdrop).toBeHidden({ timeout: 120_000 });

    // Change the page size to "All" so all rows are visible
    // MUI Select renders a custom dropdown — target the trigger div by aria-label
    const pageSizeSelect = page.locator('[aria-label="rows per page"]');
    await pageSizeSelect.click();
    await page.getByRole("option", { name: "All" }).click();

    // Verify table rows are visible (skip the hidden measurement table which is first in DOM)
    const resultsTable = page.locator("table").nth(1);
    const firstCell = resultsTable.locator("tbody tr td").first();
    await playwrightExpect(firstCell).toBeVisible({ timeout: 5_000 });

    const rowCount = await resultsTable
      .locator("tbody tr")
      .filter({ has: page.locator("td") })
      .count();
    vitestExpect(rowCount).toBe(16);

    // Pause so you can inspect DevTools (Network tab, console, etc.)
    // The test will wait here until you call `playwright.resume()` in the
    // browser's DevTools console, or press the resume button in the Playwright inspector.
    //await page.pause();

    await page.close();
  }, 200_000);
});
