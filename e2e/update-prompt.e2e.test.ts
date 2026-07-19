import { expect as playwrightExpect } from "@playwright/test";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type BrowserContext, type Page, chromium } from "playwright";
import { extensionLaunchOptions } from "./helpers/launchOptions";
import { afterAll, beforeAll, beforeEach, describe, it, expect as vitestExpect } from "vitest";

const repoRoot = path.resolve(__dirname, "..");
const buildDir = path.resolve(repoRoot, "build");

const GITHUB_RELEASES_PATTERN = "**://api.github.com/repos/*/*/releases/latest";
const NEWER_VERSION = "99.0.0";
const RELEASE_URL = `https://github.com/owner/repo/releases/tag/v${NEWER_VERSION}`;

const manifestPath = path.resolve(buildDir, "manifest.json");

/** Boots a Chromium profile with the built extension loaded unpacked. */
async function launchWithExtension(): Promise<{ context: BrowserContext; extensionId: string }> {
  const context = await chromium.launchPersistentContext("", extensionLaunchOptions(buildDir));

  const swTarget = context.serviceWorkers().length
    ? context.serviceWorkers()[0]
    : await context.waitForEvent("serviceworker");
  return { context, extensionId: swTarget.url().split("/")[2] };
}

// Built once for the whole file; each suite then loads it in its own profile.
beforeAll(() => {
  execSync("pnpm build:e2e", { cwd: repoRoot, stdio: "inherit" });
}, 180_000);

describe("Chem-Pal update prompt", () => {
  let context: BrowserContext;
  let extensionId: string;

  beforeAll(async () => {
    ({ context, extensionId } = await launchWithExtension());
  }, 120_000);

  afterAll(async () => {
    await context?.close();
  });

  // Every test starts with no update bookkeeping, so the mount effect always
  // takes the "throttle expired" path unless the test seeds otherwise.
  beforeEach(async () => {
    if (!extensionId) return;
    const resetPage = await context.newPage();
    try {
      await resetPage.goto(`chrome-extension://${extensionId}/index.html`);
      await resetPage.evaluate(
        async () => await new Promise<void>((resolve) => chrome.storage.local.clear(() => resolve())),
      );
    } finally {
      await resetPage.close();
    }
  });

  /**
   * Opens the extension with the GitHub releases endpoint stubbed. Routes are
   * registered before navigation so the mount-time poll is intercepted.
   * @param tag - Tag to serve, or `undefined` to fail the request (offline).
   * @returns The opened page and a counter of intercepted GitHub calls.
   */
  async function openExtension(
    tag?: string,
    notesBody?: string,
  ): Promise<{ page: Page; calls: () => number }> {
    const page = await context.newPage();
    let callCount = 0;

    await page.route(GITHUB_RELEASES_PATTERN, async (route) => {
      callCount += 1;
      if (!tag) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tag_name: tag,
          html_url: RELEASE_URL,
          draft: false,
          prerelease: false,
          body: notesBody ?? null,
        }),
      });
    });

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await playwrightExpect(page.getByRole("textbox", { name: "search for products" })).toBeVisible({
      timeout: 10_000,
    });
    return { page, calls: () => callCount };
  }

  /** Reads the persisted update bookkeeping out of chrome.storage.local. */
  async function readUpdateCheck(page: Page): Promise<Record<string, unknown>> {
    return page.evaluate(async () => {
      const items = await new Promise<Record<string, unknown>>((resolve) =>
        chrome.storage.local.get(["update_check"], (result) => resolve(result)),
      );
      const stored = items["update_check"];
      const empty: Record<string, unknown> = {};
      return typeof stored === "object" && stored !== null
        ? { ...(stored as Record<string, unknown>) }
        : empty;
    });
  }

  it(
    "prompts with a release link when GitHub reports a newer version",
    async () => {
      const { page, calls } = await openExtension(`v${NEWER_VERSION}`);

      const snackbar = page.getByTestId("update-snackbar");
      await playwrightExpect(snackbar).toBeVisible({ timeout: 10_000 });
      await playwrightExpect(snackbar).toContainText(NEWER_VERSION);
      // Manual install → "View release", not "Reload now".
      await playwrightExpect(page.getByTestId("update-apply")).toHaveText("View release");
      vitestExpect(calls()).toBe(1);

      // The result is cached alongside the throttle stamp.
      const stored = await readUpdateCheck(page);
      vitestExpect(stored.latestVersion).toBe(NEWER_VERSION);
      vitestExpect(stored.releaseUrl).toBe(RELEASE_URL);
      vitestExpect(typeof stored.lastCheckedAt).toBe("number");

      await page.close();
    },
    120_000,
  );

  it(
    "stays quiet when the running build is already current",
    async () => {
      // v0.0.1 is older than any shipped version.
      const { page } = await openExtension("v0.0.1");

      await page.waitForTimeout(2_000);
      await playwrightExpect(page.getByTestId("update-snackbar")).toBeHidden();

      await page.close();
    },
    120_000,
  );

  it(
    "does not re-poll GitHub inside the throttle window",
    async () => {
      const { page } = await openExtension(`v${NEWER_VERSION}`);
      await playwrightExpect(page.getByTestId("update-snackbar")).toBeVisible({ timeout: 10_000 });
      await page.close();

      // A second open within 24h must serve the cached result without a request.
      const reopened = await openExtension(`v${NEWER_VERSION}`);
      await playwrightExpect(reopened.page.getByTestId("update-snackbar")).toBeVisible({
        timeout: 10_000,
      });
      vitestExpect(reopened.calls()).toBe(0);

      await reopened.page.close();
    },
    120_000,
  );

  it(
    "remembers a dismissal for that version across reopens",
    async () => {
      const { page } = await openExtension(`v${NEWER_VERSION}`);
      await playwrightExpect(page.getByTestId("update-snackbar")).toBeVisible({ timeout: 10_000 });

      await page.getByTestId("update-dismiss").click();
      await playwrightExpect(page.getByTestId("update-snackbar")).toBeHidden();
      await playwrightExpect
        .poll(async () => (await readUpdateCheck(page)).dismissedVersion, { timeout: 5_000 })
        .toBe(NEWER_VERSION);
      await page.close();

      const reopened = await openExtension(`v${NEWER_VERSION}`);
      await reopened.page.waitForTimeout(2_000);
      await playwrightExpect(reopened.page.getByTestId("update-snackbar")).toBeHidden();

      await reopened.page.close();
    },
    120_000,
  );

  it(
    "shows the changelog highlights in the What's new modal",
    async () => {
      const body = [
        "### Added",
        "",
        "- Options page for configuring Chem Pal outside the popup.",
        "- Advanced mode, which unlocks the supplier statistics panel.",
        "",
        "### Fixed",
        "",
        "- Search failing to return results in some cases.",
        "",
        `**Full Changelog**: https://github.com/jhyland87/chem-pal/compare/v1.2.0...v${NEWER_VERSION}`,
      ].join("\n");
      const { page } = await openExtension(`v${NEWER_VERSION}`, body);

      // With notes available the snackbar defers to the modal.
      const action = page.getByTestId("update-apply");
      await playwrightExpect(action).toHaveText("What's new", { timeout: 10_000 });
      await action.click();

      const modal = page.getByTestId("whats-new-modal");
      await playwrightExpect(modal).toBeVisible();
      await playwrightExpect(modal).toContainText("Added");
      await playwrightExpect(modal).toContainText("Options page for configuring Chem Pal");
      await playwrightExpect(modal).toContainText("Fixed");
      await playwrightExpect(modal).toContainText("Search failing to return results");
      // The auto-appended compare link is noise and must be filtered out.
      await playwrightExpect(modal).not.toContainText("Full Changelog");
      await playwrightExpect(page.getByTestId("whats-new-apply")).toHaveText("View release");

      await page.close();
    },
    120_000,
  );

  it(
    "keeps the prompt down after Later, but still prompts on the next open",
    async () => {
      const body = "### Added\n\n- Something worth reading.";
      const { page } = await openExtension(`v${NEWER_VERSION}`, body);

      const snackbar = page.getByTestId("update-snackbar");
      await playwrightExpect(snackbar).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("update-apply").click();

      // The modal replaces the snackbar rather than stacking on top of it.
      await playwrightExpect(page.getByTestId("whats-new-modal")).toBeVisible();
      await playwrightExpect(snackbar).toBeHidden();

      await page.getByTestId("whats-new-close").click();
      await playwrightExpect(page.getByTestId("whats-new-modal")).toBeHidden();
      await playwrightExpect(snackbar).toBeHidden();
      await page.close();

      // "Later" is session-only — unlike ✕ it records nothing, so a fresh open
      // still surfaces the update.
      const reopened = await openExtension(`v${NEWER_VERSION}`, body);
      await playwrightExpect(reopened.page.getByTestId("update-snackbar")).toBeVisible({
        timeout: 10_000,
      });

      await reopened.page.close();
    },
    120_000,
  );

  it(
    "falls back to the direct action when the release has no notes",
    async () => {
      const { page } = await openExtension(`v${NEWER_VERSION}`);

      // A bodyless release leaves nothing to expand, so the snackbar acts directly.
      await playwrightExpect(page.getByTestId("update-apply")).toHaveText("View release", {
        timeout: 10_000,
      });

      await page.close();
    },
    120_000,
  );

  it(
    "stays quiet and records the attempt when GitHub is unreachable",
    async () => {
      const { page, calls } = await openExtension(undefined);

      await page.waitForTimeout(2_000);
      await playwrightExpect(page.getByTestId("update-snackbar")).toBeHidden();
      vitestExpect(calls()).toBe(1);

      // The throttle stamp still lands, so a failed check can't cause a retry storm.
      const stored = await readUpdateCheck(page);
      vitestExpect(typeof stored.lastCheckedAt).toBe("number");

      await page.close();
    },
    120_000,
  );
});

/**
 * Chrome never fires `onUpdateAvailable` for a locally-loaded extension, but the
 * branch it drives is gated purely on `getInstallSource()`, which reads
 * `update_url` from the *runtime* manifest. Injecting that key into the built
 * manifest makes the extension report itself as Web Store-installed, so the
 * whole branch — staged-update record, notes lookup by tag, reload action — runs
 * for real. The manifest is restored afterwards.
 */
describe("Chem-Pal update prompt (Web Store install)", () => {
  const TAGS_PATTERN = "**://api.github.com/repos/*/*/releases/tags/*";

  let context: BrowserContext;
  let extensionId: string;
  let originalManifest: string;

  beforeAll(async () => {
    originalManifest = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(originalManifest);
    manifest.update_url = "https://clients2.google.com/service/update2/crx";
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    ({ context, extensionId } = await launchWithExtension());
  }, 120_000);

  afterAll(async () => {
    await context?.close();
    if (originalManifest) writeFileSync(manifestPath, originalManifest);
  });

  beforeEach(async () => {
    if (!extensionId) return;
    const resetPage = await context.newPage();
    try {
      await resetPage.goto(`chrome-extension://${extensionId}/index.html`);
      await resetPage.evaluate(
        async () => await new Promise<void>((resolve) => chrome.storage.local.clear(() => resolve())),
      );
    } finally {
      await resetPage.close();
    }
  });

  /**
   * Seeds a staged update the way the service worker's `onUpdateAvailable`
   * listener would, then opens the extension with both GitHub endpoints stubbed.
   * @param notesBody - Release body served for the tag lookup, if any.
   * @returns The page plus per-endpoint call counters.
   */
  async function openWithStagedUpdate(notesBody?: string): Promise<{
    page: Page;
    tagCalls: () => number;
    latestCalls: () => number;
  }> {
    const seedPage = await context.newPage();
    await seedPage.goto(`chrome-extension://${extensionId}/index.html`);
    await seedPage.evaluate(
      async (version) =>
        await new Promise<void>((resolve) =>
          chrome.storage.local.set(
            { update_pending: { version, detectedAt: Date.now() } },
            () => resolve(),
          ),
        ),
      NEWER_VERSION,
    );
    await seedPage.close();

    const page = await context.newPage();
    let tagCalls = 0;
    let latestCalls = 0;

    await page.route(TAGS_PATTERN, async (route) => {
      tagCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tag_name: `v${NEWER_VERSION}`,
          html_url: RELEASE_URL,
          draft: false,
          prerelease: false,
          body: notesBody ?? null,
        }),
      });
    });
    // The Web Store path must never poll for the latest release.
    await page.route(GITHUB_RELEASES_PATTERN, async (route) => {
      latestCalls += 1;
      await route.abort("failed");
    });

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await playwrightExpect(page.getByRole("textbox", { name: "search for products" })).toBeVisible({
      timeout: 10_000,
    });
    return { page, tagCalls: () => tagCalls, latestCalls: () => latestCalls };
  }

  it(
    "reports itself as a Web Store install",
    async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/index.html`);
      const updateUrl = await page.evaluate(() => chrome.runtime.getManifest().update_url);
      vitestExpect(updateUrl).toContain("clients2.google.com");
      await page.close();
    },
    120_000,
  );

  it(
    "offers a reload for an update Chrome has already staged",
    async () => {
      const { page, latestCalls } = await openWithStagedUpdate();

      const snackbar = page.getByTestId("update-snackbar");
      await playwrightExpect(snackbar).toBeVisible({ timeout: 10_000 });
      await playwrightExpect(snackbar).toContainText(NEWER_VERSION);
      // Web Store install → "Reload now", never "View release".
      await playwrightExpect(page.getByTestId("update-apply")).toHaveText("Reload now");
      vitestExpect(latestCalls()).toBe(0);

      await page.close();
    },
    120_000,
  );

  it(
    "looks up the staged version's notes by tag and shows them",
    async () => {
      const body = ["### Fixed", "", "- A bug that only Web Store users hit."].join("\n");
      const { page, tagCalls, latestCalls } = await openWithStagedUpdate(body);

      const action = page.getByTestId("update-apply");
      await playwrightExpect(action).toHaveText("What's new", { timeout: 10_000 });
      await action.click();

      const modal = page.getByTestId("whats-new-modal");
      await playwrightExpect(modal).toBeVisible();
      await playwrightExpect(modal).toContainText("A bug that only Web Store users hit.");
      // The CTA inside the modal still reloads rather than linking out.
      await playwrightExpect(page.getByTestId("whats-new-apply")).toHaveText("Reload now");
      vitestExpect(tagCalls()).toBe(1);
      vitestExpect(latestCalls()).toBe(0);

      await page.close();
    },
    120_000,
  );

  it(
    "applies the staged update by reloading the extension",
    async () => {
      const { page } = await openWithStagedUpdate();
      await playwrightExpect(page.getByTestId("update-apply")).toBeVisible({ timeout: 10_000 });

      // Stub the reload so the run isn't torn down mid-test; asserting the call
      // is what matters, and actually reloading would kill the page.
      await page.evaluate(() => {
        const w = window as unknown as { __reloaded?: boolean };
        w.__reloaded = false;
        chrome.runtime.reload = () => {
          w.__reloaded = true;
        };
      });
      await page.getByTestId("update-apply").click();

      const reloaded = await page.evaluate(
        () => (window as unknown as { __reloaded?: boolean }).__reloaded,
      );
      vitestExpect(reloaded).toBe(true);

      await page.close();
    },
    120_000,
  );

  it(
    "still prompts when the notes lookup fails",
    async () => {
      const seedPage = await context.newPage();
      await seedPage.goto(`chrome-extension://${extensionId}/index.html`);
      await seedPage.evaluate(
        async (version) =>
          await new Promise<void>((resolve) =>
            chrome.storage.local.set(
              { update_pending: { version, detectedAt: Date.now() } },
              () => resolve(),
            ),
          ),
        NEWER_VERSION,
      );
      await seedPage.close();

      const page = await context.newPage();
      await page.route("**://api.github.com/**", (route) => route.abort("failed"));
      await page.goto(`chrome-extension://${extensionId}/index.html`);

      // Notes are a nice-to-have; losing them must not cost the user the prompt.
      await playwrightExpect(page.getByTestId("update-apply")).toHaveText("Reload now", {
        timeout: 10_000,
      });

      await page.close();
    },
    120_000,
  );

  it(
    "remembers a dismissal for the staged version",
    async () => {
      const { page } = await openWithStagedUpdate();
      await playwrightExpect(page.getByTestId("update-snackbar")).toBeVisible({ timeout: 10_000 });

      await page.getByTestId("update-dismiss").click();
      await playwrightExpect(page.getByTestId("update-snackbar")).toBeHidden();
      await page.close();

      const reopened = await openWithStagedUpdate();
      await reopened.page.waitForTimeout(2_000);
      await playwrightExpect(reopened.page.getByTestId("update-snackbar")).toBeHidden();

      await reopened.page.close();
    },
    120_000,
  );
});
