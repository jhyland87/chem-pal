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

import type { LaunchOptions } from 'playwright';

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
