/**
 * Shared Chromium launch options for the extension e2e suites.
 *
 * Extensions can't run under Chromium's *old* headless mode, which is what
 * Playwright still uses for a plain `headless: true`. Opting into the new
 * headless implementation with `channel: "chromium"` loads extensions and starts
 * their MV3 service worker normally, so the suites no longer need to steal focus
 * with a visible browser window.
 *
 * Set `E2E_HEADED=1` to watch a run (or to debug with devtools):
 *
 * ```sh
 * E2E_HEADED=1 pnpm test:e2e:chrome
 * ```
 * @module launchOptions
 */

import { type BrowserContext, chromium, type LaunchOptions } from 'playwright';

/** Whether the caller asked for a visible browser via `E2E_HEADED=1`. */
export const HEADED = process.env.E2E_HEADED === '1';

/**
 * Builds the launch options that load the built extension unpacked.
 * @param buildDir - Absolute path to the built extension directory.
 * @param extraArgs - Additional Chromium flags to append.
 * @returns Options for `chromium.launchPersistentContext`.
 * @example
 * ```ts
 * const context = await chromium.launchPersistentContext("", {
 *   ...extensionLaunchOptions(buildDir),
 *   viewport: { width: 420, height: 800 },
 * });
 * ```
 * @source
 */
export function extensionLaunchOptions(
  buildDir: string,
  extraArgs: string[] = [],
): LaunchOptions & { args: string[] } {
  return {
    // Chromium's new headless mode; the old one can't load extensions.
    channel: 'chromium',
    headless: !HEADED,
    args: [
      `--disable-extensions-except=${buildDir}`,
      `--load-extension=${buildDir}`,
      '--no-first-run',
      '--disable-gpu',
      '--no-default-browser-check',
      ...extraArgs,
    ],
  };
}

/**
 * Default per-action timeout for the extension e2e suites.
 *
 * Playwright's built-in default is 30s, which the Windows CI runner sits right
 * on the edge of — it runs the suite roughly twice as slow as Linux or macOS,
 * so bare `.click()` calls flake there while passing everywhere else. The
 * suites already pass explicit timeouts wherever a wait is genuinely long; this
 * only widens the floor for the ones that don't.
 */
export const E2E_ACTION_TIMEOUT_MS = 60_000;

/** Extra options accepted alongside the persistent-context overrides. */
type LaunchExtensionOptions = NonNullable<
  Parameters<typeof chromium.launchPersistentContext>[1]
> & {
  /** Additional Chromium flags to append to the extension args. */
  extraArgs?: string[];
};

/**
 * Launches a persistent Chromium context with the built extension loaded and a
 * default action timeout applied.
 *
 * Prefer this over calling `chromium.launchPersistentContext` directly so every
 * suite picks up the same timeout floor.
 * @param buildDir - Absolute path to the built extension directory.
 * @param options - Persistent-context overrides, plus `extraArgs` for Chromium flags.
 * @returns The launched browser context.
 * @example
 * ```ts
 * const context = await launchExtensionContext(buildDir, {
 *   viewport: { width: 420, height: 800 },
 * });
 * ```
 * @source
 */
export async function launchExtensionContext(
  buildDir: string,
  options: LaunchExtensionOptions = {},
): Promise<BrowserContext> {
  const { extraArgs = [], ...overrides } = options;
  const context = await chromium.launchPersistentContext('', {
    ...extensionLaunchOptions(buildDir, extraArgs),
    ...overrides,
  });
  context.setDefaultTimeout(E2E_ACTION_TIMEOUT_MS);
  return context;
}
