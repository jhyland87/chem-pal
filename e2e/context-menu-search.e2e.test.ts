import { expect as playwrightExpect } from "@playwright/test";
import { execSync } from "node:child_process";
import path from "node:path";
import { type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, it, expect as vitestExpect } from "vitest";
import { setupMockRoutes } from "./helpers/mockRoutes";

/**
 * E2E coverage for the right-click "Search selection in Chem Pal" flow.
 *
 * A native context-menu click can't be scripted from Playwright, and the
 * worker's own click handler is unit-tested separately
 * (src/utils/__tests__/serviceWorkerContextMenu.test.ts). What these tests pin
 * down is the *contract* that handler fulfils and the app consumes: the worker
 * seeds a pending search into `chrome.storage.session` (`query` +
 * `is_new_search`) and opens/focuses the `?view=tab` page, and the app then
 * runs that search — both when the tab is freshly opened (useSearch mount
 * effect) and when it's already open (App's storage.onChanged listener, gated
 * to the tab view).
 */

const buildDir = path.resolve(__dirname, "..", "build");
const mockResponsesDir = path.resolve(__dirname, "mock-requests/responses");
const testTimeout = 200_000;

describe("Chem-Pal context-menu search", () => {
  let context: BrowserContext;
  let extensionId: string;

  beforeAll(async () => {
    execSync("pnpm build", { cwd: path.resolve(__dirname, ".."), stdio: "inherit" });

    context = await chromium.launchPersistentContext("", {
      headless: false, // Extensions require headed mode in Chromium
      args: [
        `--disable-extensions-except=${buildDir}`,
        `--load-extension=${buildDir}`,
        "--no-first-run",
        "--disable-gpu",
        "--no-default-browser-check",
      ],
    });

    const swTarget =
      context.serviceWorkers().length ?
        context.serviceWorkers()[0]
      : await context.waitForEvent("serviceworker");
    extensionId = swTarget.url().split("/")[2];
  }, 60_000);

  afterAll(async () => {
    await context?.close();
  });

  // Wipe IndexedDB + both storage areas so each test starts clean (mirrors the
  // reset in search-query.e2e.test.ts).
  beforeEach(async () => {
    if (!extensionId) return;
    const resetPage = await context.newPage();
    try {
      await resetPage.goto(`chrome-extension://${extensionId}/index.html`);
      await resetPage.evaluate(async () => {
        await new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase("chempal");
          req.onsuccess = () => resolve();
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

  /** Writes the pending-search inbox exactly as the service worker does on click. */
  async function seedPendingSearch(page: Page, query: string): Promise<void> {
    await page.evaluate(
      (q) =>
        new Promise<void>((resolve) =>
          chrome.storage.session.set({ query: q, is_new_search: true }, () => resolve()),
        ),
      query,
    );
  }

  /**
   * Waits for a seeded search to run to completion. The `#loading-backdrop`
   * overlay is shown whenever a search is executing and hidden once every
   * supplier finishes, so it's the reliable signal that the search actually
   * triggered. If no search runs it never appears and this times out — which is
   * the failure we want.
   */
  async function waitForSearch(page: Page): Promise<void> {
    const backdrop = page.locator("#loading-backdrop");
    await playwrightExpect(backdrop).toBeVisible({ timeout: 15_000 });
    await playwrightExpect(backdrop).toBeHidden({ timeout: 120_000 });
  }

  /** Counts data rows in the results table (skips the hidden measurement table at nth(0)). */
  async function resultRowCount(page: Page): Promise<number> {
    const resultsTable = page.locator("table").nth(1);
    await playwrightExpect(resultsTable.locator("tbody tr td").first()).toBeVisible({
      timeout: 5_000,
    });
    return resultsTable
      .locator("tbody tr")
      .filter({ has: page.locator("td") })
      .count();
  }

  it(
    "grants the contextMenus permission to the loaded extension",
    async () => {
      const page = await context.newPage();
      try {
        await page.goto(`chrome-extension://${extensionId}/index.html`);
        const granted = await page.evaluate(
          () =>
            new Promise<boolean>((resolve) =>
              chrome.permissions.contains({ permissions: ["contextMenus"] }, resolve),
            ),
        );
        vitestExpect(granted).toBe(true);
      } finally {
        await page.close();
      }
    },
    30_000,
  );

  it(
    "runs the seeded search when the tab view is opened fresh (mount path)",
    async () => {
      // Seed the inbox first (as the worker does before creating the tab), then
      // open a brand-new ?view=tab page with mock routes wired up before the
      // navigation so the auto-fired search is intercepted from the start.
      const seed = await context.newPage();
      await seed.goto(`chrome-extension://${extensionId}/index.html`);
      await seedPendingSearch(seed, "potassium");
      await seed.close();

      const page = await context.newPage();
      try {
        await setupMockRoutes(page, { responsesDir: mockResponsesDir, fallback: "abort" });
        await page.goto(`chrome-extension://${extensionId}/index.html?view=tab`);

        // App.loadFromStorage should see the pending search, land on the results
        // panel, and ResultsTable's mount effect should execute it.
        await waitForSearch(page);
        vitestExpect(await resultRowCount(page)).toBeGreaterThanOrEqual(1);
      } finally {
        await page.close();
      }
    },
    testTimeout,
  );

  it(
    "runs the seeded search when the tab view is already open (onChanged path)",
    async () => {
      const page = await context.newPage();
      try {
        await page.goto(`chrome-extension://${extensionId}/index.html?view=tab`);
        await setupMockRoutes(page, { responsesDir: mockResponsesDir, fallback: "abort" });

        // App boots on the home panel with no pending search.
        const searchInput = page.getByRole("textbox", { name: "search for products" });
        await playwrightExpect(searchInput).toBeVisible({ timeout: 10_000 });

        // Now seed the inbox in the already-open tab; the storage.onChanged
        // listener should switch to results and execute the search.
        await seedPendingSearch(page, "potassium");

        await waitForSearch(page);
        vitestExpect(await resultRowCount(page)).toBeGreaterThanOrEqual(1);
      } finally {
        await page.close();
      }
    },
    testTimeout,
  );
});
