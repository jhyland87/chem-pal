import { expect as playwrightExpect } from "@playwright/test";
import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type BrowserContext, type Page, chromium } from "playwright";
import { extensionLaunchOptions } from "./helpers/launchOptions";
import { afterAll, beforeAll, beforeEach, describe, it, expect as vitestExpect } from "vitest";
import { setupMockRoutes } from "./helpers/mockRoutes";

const repoRoot = path.resolve(__dirname, "..");
const buildDir = path.resolve(repoRoot, "build");
const mockResponsesDir = path.resolve(__dirname, "mock-requests/responses");

// The app version baked into the build (from package.json). applyPendingMigrations
// stamps the cache marker with this once the chain finishes.
const EXPECTED_VERSION: string = JSON.parse(
  readFileSync(path.resolve(repoRoot, "package.json"), "utf8"),
).version;

// A throwaway migration copied into src/migrations/steps just for this suite, so
// the built extension actually contains a detectable step. Its source lives in
// __fixtures__/migration-step.ts (a real, type-checked module — it imports the
// Migration type via the `@/` alias, which resolves both in place and once copied
// into steps/). `to` is "1.0.0" (the floor app version), so it stays
// <= EXPECTED_VERSION as the version climbs. Created before the build and deleted
// in afterAll — never committed.
const fixtureStepPath = path.resolve(repoRoot, "src/migrations/steps/v0.9.0-to-v1.0.0.ts");
const FIXTURE_STEP = readFileSync(
  path.resolve(__dirname, "__fixtures__/migration-step.ts"),
  "utf8",
);

describe("Chem-Pal cache migration", () => {
  let context: BrowserContext;
  let extensionId: string;

  beforeAll(async () => {
    // Drop any fixture left behind by a previously-crashed run, then plant a
    // fresh one so the build bundles exactly one detectable migration step.
    rmSync(fixtureStepPath, { force: true });
    writeFileSync(fixtureStepPath, FIXTURE_STEP);

    execSync("pnpm build:e2e", { cwd: repoRoot, stdio: "inherit" });

    context = await chromium.launchPersistentContext("", extensionLaunchOptions(buildDir));

    const swTarget = context.serviceWorkers().length
      ? context.serviceWorkers()[0]
      : await context.waitForEvent("serviceworker");
    extensionId = swTarget.url().split("/")[2];
  }, 120_000);

  afterAll(async () => {
    await context?.close();
    // Always remove the throwaway migration so it never ships.
    rmSync(fixtureStepPath, { force: true });
  });

  // Start every test from a clean cache: nuke the whole `chempal` IndexedDB and
  // both chrome.storage areas so the first open is always a fresh install.
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

  /** Open a fresh extension page with hermetic routing wired up. */
  async function openExtension(): Promise<Page> {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await setupMockRoutes(page, {
      responsesDir: mockResponsesDir,
      fallback: "abort",
      verbose: false,
    });
    await playwrightExpect(page.getByRole("textbox", { name: "search for products" })).toBeVisible({
      timeout: 10_000,
    });
    return page;
  }

  /**
   * Roll the stored version marker back to 0.9.0 and seed a pre-migration
   * `search_results` row, simulating a cache written by an older release. Runs in
   * the extension page so it writes the real `chempal` IndexedDB. The row has no
   * `migratedBy` field yet — the migration adds it.
   */
  async function seedStaleCache(page: Page): Promise<void> {
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("chempal");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["app_meta", "search_results"], "readwrite");
        tx.objectStore("app_meta").put({ id: "current", appVersion: "0.9.0", updatedAt: 1 });
        tx.objectStore("search_results").put({
          id: "current",
          data: [{ id: "seed-1", supplier: "TestSupplier", title: "Seed product" }],
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
  }

  /** Read the version marker + the migration's tag off the cache. */
  async function readCacheState(page: Page): Promise<{ appVersion?: string; migratedBy?: string }> {
    return page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("chempal");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const read = (store: string) =>
        new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
          const req = db.transaction(store, "readonly").objectStore(store).get("current");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      const meta = await read("app_meta");
      const results = await read("search_results");
      db.close();
      return {
        appVersion: typeof meta?.appVersion === "string" ? meta.appVersion : undefined,
        migratedBy: typeof results?.migratedBy === "string" ? results.migratedBy : undefined,
      };
    });
  }

  it("detects a stale cache, shows the prompt, and applies the migration on Apply", async () => {
    const page = await openExtension();

    // A clean first open must NOT prompt (fresh install → version seeded).
    await playwrightExpect(page.getByTestId("migration-apply")).toBeHidden();

    // Simulate an older cache, then reopen so the mount effect re-checks.
    await seedStaleCache(page);
    await page.reload();

    // Detection → prompt: the modal lists the pending 0.9.0 → 1.0.0 step.
    const applyButton = page.getByTestId("migration-apply");
    await playwrightExpect(applyButton).toBeVisible({ timeout: 10_000 });
    const modal = page.getByTestId("migration-modal");
    await playwrightExpect(modal).toContainText("0.9.0");
    await playwrightExpect(modal).toContainText("1.0.0");

    // Apply → the migration runs and the prompt closes.
    await applyButton.click();
    await playwrightExpect(applyButton).toBeHidden({ timeout: 10_000 });

    // Verify the update was applied: marker advanced + cached row transformed.
    const state = await readCacheState(page);
    vitestExpect(state.appVersion).toBe(EXPECTED_VERSION);
    vitestExpect(state.migratedBy).toBe("0.9.0->1.0.0");

    await page.close();
  }, 200_000);

  it("clears the cache and starts fresh on Cancel", async () => {
    const page = await openExtension();

    await seedStaleCache(page);
    await page.reload();

    const cancelButton = page.getByTestId("migration-cancel");
    await playwrightExpect(cancelButton).toBeVisible({ timeout: 10_000 });

    // Cancel → clear the cache and stamp the current version (no migration tag).
    await cancelButton.click();
    await playwrightExpect(cancelButton).toBeHidden({ timeout: 10_000 });

    const state = await readCacheState(page);
    vitestExpect(state.appVersion).toBe(EXPECTED_VERSION);
    vitestExpect(state.migratedBy).toBeUndefined();

    await page.close();
  }, 200_000);
});
