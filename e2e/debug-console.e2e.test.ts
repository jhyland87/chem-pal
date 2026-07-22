import { expect as playwrightExpect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { type BrowserContext, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, it, expect as vitestExpect } from 'vitest';
import { extensionLaunchOptions } from './helpers/launchOptions';

/**
 * The `window.chempal` console helpers are unlocked by advanced mode.
 *
 * This has to run against the **production** bundle (`build:e2e` builds with
 * `--mode=production`), because a dev build exposes the helpers at startup and
 * would pass regardless. It also pins down that `help()` still prints: its body
 * is nothing but a console call, and `esbuild.pure` in vite.config.ts strips
 * bare `console.info`/`log` calls, which previously compiled `help()` down to an
 * empty function.
 */
const repoRoot = path.resolve(__dirname, '..');
const buildDir = path.resolve(repoRoot, 'build');

/** The Konami sequence bound to the advanced-mode toggle in config.json. */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// Every `window.chempal` access has to be written inline inside page.evaluate:
// the callback is serialized and runs in the browser, so it can't close over
// anything defined here. The cast is needed because the `Window.chempal`
// declaration lives in src/, which the e2e tsconfig doesn't include.
type ChempalWindow = { chempal?: { help?: () => void; simulateUpdate?: unknown } };

describe('Chem-Pal debug console', () => {
  let context: BrowserContext;
  let extensionId: string;

  beforeAll(async () => {
    execSync('pnpm build:e2e', { cwd: repoRoot, stdio: 'inherit' });
    ({ context, extensionId } = await (async () => {
      const ctx = await chromium.launchPersistentContext('', extensionLaunchOptions(buildDir));
      const sw = ctx.serviceWorkers().length
        ? ctx.serviceWorkers()[0]
        : await ctx.waitForEvent('serviceworker');
      return { context: ctx, extensionId: sw.url().split('/')[2] };
    })());
  }, 180_000);

  afterAll(async () => {
    await context?.close();
  });

  /** Types the Konami sequence, toggling advanced mode. */
  async function toggleAdvancedMode(page: Page): Promise<void> {
    await page.locator('body').click();
    for (const key of KONAMI) {
      await page.keyboard.press(key);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1_000);
  }

  it('exposes chempal only while advanced mode is unlocked', async () => {
    const page = await context.newPage();
    const logs: string[] = [];
    page.on('console', (message) => logs.push(message.text()));

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await playwrightExpect(page.getByRole('textbox', { name: 'search for products' })).toBeVisible({
      timeout: 10_000,
    });

    // A production build must not ship the helpers to ordinary users.
    vitestExpect(
      await page.evaluate(() => typeof (window as unknown as ChempalWindow).chempal),
    ).toBe('undefined');

    await toggleAdvancedMode(page);
    vitestExpect(
      await page.evaluate(() => typeof (window as unknown as ChempalWindow).chempal),
    ).toBe('object');
    vitestExpect(
      await page.evaluate(
        () => typeof (window as unknown as ChempalWindow).chempal?.simulateUpdate,
      ),
    ).toBe('function');

    // help() is pure console output, so a stripped body would leave it silent.
    await page.evaluate(() => (window as unknown as ChempalWindow).chempal?.help?.());
    await playwrightExpect
      .poll(() => logs.some((line) => line.includes('ChemPal debug helpers (window.chempal)')), {
        timeout: 5_000,
      })
      .toBe(true);

    // Re-locking takes the console surface away again.
    await toggleAdvancedMode(page);
    vitestExpect(
      await page.evaluate(() => typeof (window as unknown as ChempalWindow).chempal),
    ).toBe('undefined');

    await page.close();
  }, 120_000);
});
