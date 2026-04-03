import { expect as playwrightExpect } from "@playwright/test";
import { execSync } from "node:child_process";
import path from "node:path";
import { type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, it, expect as vitestExpect } from "vitest";
import { setupMockRoutes } from "@e2e/helpers/mockRoutes";

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

  /** Open a fresh extension page */
  async function openExtension(): Promise<Page> {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await playwrightExpect(page.getByRole("textbox", { name: "search for products" })).toBeVisible({
      timeout: 10_000,
    });
    return page;
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

  it("should query for 'potassium' and display 78 results from mock data", async () => {
    const page = await openExtension();

    // Set up mock routes to intercept all HTTPS requests
    await setupMockRoutes(page, {
      responsesDir: mockResponsesDir,
      fallback: "passthrough",
      verbose: false,
    });

    // Type the search query and submit
    const searchInput = page.getByRole("textbox", {
      name: "search for products",
    });
    await searchInput.fill("potassium");
    await page.getByRole("button", { name: "search" }).click();

    // Wait for search to complete: the backdrop appears while searching, then
    // disappears when done. The results count text confirms data has loaded.
    // Use the results count as the primary signal since the backdrop can
    // appear and disappear faster than the polling interval.
    const resultsCount = page.locator("text=Results:");
    await playwrightExpect(resultsCount).toContainText("Results: 78", {
      timeout: 120_000,
    });

    // Change the page size to "All" so all rows are visible
    // MUI Select renders a custom dropdown — target the trigger div by aria-label
    const pageSizeSelect = page.locator('[aria-label="rows per page"]');
    await pageSizeSelect.click();
    await page.getByRole("option", { name: "All" }).click();

    // Verify table rows are visible (skip the hidden measurement table which is first in DOM)
    const resultsTable = page.locator("table").nth(1);
    const firstCell = resultsTable.locator("tbody tr td").first();
    await playwrightExpect(firstCell).toBeVisible({ timeout: 5_000 });

    const rowCount = await resultsTable.locator("tbody tr").filter({ has: page.locator("td") }).count();
    vitestExpect(rowCount).toBe(78);

    // Pause so you can inspect DevTools (Network tab, console, etc.)
    // The test will wait here until you call `playwright.resume()` in the
    // browser's DevTools console, or press the resume button in the Playwright inspector.
    //await page.pause();

    await page.close();
  }, 120_000);
});
