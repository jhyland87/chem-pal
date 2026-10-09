import { expect as playwrightExpect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, it, expect as vitestExpect } from 'vitest';
import { launchExtensionContext } from './helpers/launchOptions';

/**
 * Non-English locales are lazy chunks (`assets/messages-*.js`) so they stay out of the
 * startup bundle. That only works if the production extension can actually fetch and apply
 * them, which a unit test running against Vite's dev glob cannot prove.
 */
const repoRoot = path.resolve(__dirname, '..');
const buildDir = path.resolve(repoRoot, 'build');

/** Matches the lazy locale chunks Rollup emits for the non-English `messages.json` files. */
const LOCALE_CHUNK = /\/assets\/messages-[\w-]+\.js$/;

describe('Chem-Pal lazy locale loading', () => {
  let context: BrowserContext;
  let extensionId: string;

  beforeAll(async () => {
    execSync('pnpm build:e2e', { cwd: repoRoot, stdio: 'inherit' });
    ({ context, extensionId } = await (async () => {
      const ctx = await launchExtensionContext(buildDir);
      const sw = ctx.serviceWorkers().length
        ? ctx.serviceWorkers()[0]
        : await ctx.waitForEvent('serviceworker');
      return { context: ctx, extensionId: sw.url().split('/')[2] };
    })());
  }, 180_000);

  afterAll(async () => {
    await context?.close();
  });

  /** Opens the popup page, recording every locale chunk it requests. */
  async function openPopup(chunks: string[]): Promise<Page> {
    const page = await context.newPage();
    page.on('request', (request) => {
      if (LOCALE_CHUNK.test(new URL(request.url()).pathname)) chunks.push(request.url());
    });
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    return page;
  }

  it('renders English without fetching any locale chunk', async () => {
    const chunks: string[] = [];
    const page = await openPopup(chunks);

    await playwrightExpect(page.getByRole('textbox', { name: 'search for products' })).toBeVisible({
      timeout: 10_000,
    });
    await playwrightExpect(page).toHaveTitle('ChemPal - Chemical Reagent Search Engine');
    vitestExpect(chunks).toEqual([]);
    await page.close();
  });

  it('fetches the selected locale on demand and renders it', async () => {
    const seed = await context.newPage();
    await seed.goto(`chrome-extension://${extensionId}/index.html`);
    await seed.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          chrome.storage.local.get(['user_settings'], (existing) => {
            const merged = { ...(existing.user_settings ?? {}), language: 'pl' };
            chrome.storage.local.set({ user_settings: merged }, () => {
              const err = chrome.runtime.lastError;
              if (err) reject(new Error(err.message));
              else resolve();
            });
          });
        }),
    );
    await seed.close();

    const chunks: string[] = [];
    const page = await openPopup(chunks);

    await playwrightExpect(page.getByPlaceholder('Szukaj produktów...')).toBeVisible({
      timeout: 10_000,
    });
    vitestExpect(chunks).toHaveLength(1);
    await page.close();
  });
});
