import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const resolvePath = (...paths: string[]) => path.resolve(dirname, "..", ...paths);

/**
 * Playwright config for the ChemPal demo walkthrough (`pnpm run demo`).
 *
 * This suite is separate from the vitest-driven e2e tests under `e2e/` — it
 * exists purely to record a watchable, narrated walkthrough of the extension.
 *
 * NOTE: The demo loads an unpacked extension, which requires a manually
 * launched persistent context (see `demo/fixtures.ts`). Playwright's config
 * `use.video` / `use.viewport` / `use.launchOptions.slowMo` only apply to
 * contexts the runner creates for you — NOT to our own `launchPersistentContext`.
 * So recording, viewport, and slowMo are set in the fixture, not here.
 */
export default defineConfig({
  testDir: resolvePath("demo"),
  testMatch: "**/*.demo.ts",
  // Linear demo: one browser, no parallelism, generous per-test budget for
  // the build-free run (backdrop can take a while as suppliers stream in).
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  outputDir: resolvePath("demo-results"),
  // Absolute path: an HTML reporter's `outputFolder` is otherwise resolved
  // relative to this config file's dir (configs/), not the repo root.
  reporter: [["html", { outputFolder: resolvePath("demo-report"), open: "never" }]],
  use: {
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
