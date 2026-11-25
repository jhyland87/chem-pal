import { expect as playwrightExpect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import type { BrowserContext, Page, Route } from 'playwright';
import { afterAll, beforeAll, describe, it, expect as vitestExpect } from 'vitest';
import { priceAlerts } from '../config.json';
import productFixture from '../src/suppliers/__fixtures__/thelabstockroom/product-with-variants.json';
import { launchExtensionContext } from './helpers/launchOptions';
import { setupMockRoutes } from './helpers/mockRoutes';

/**
 * E2E coverage for price alerts: a product is watched from the results table, and the real service
 * worker refetches it (with its own network stack and no DOM) and reports the drop.
 */

const buildDir = path.resolve(__dirname, '..', 'build');
const mockResponsesDir = path.resolve(__dirname, 'mock-requests/responses');
const shopifyUrl = 'https://hbarsci.myshopify.com/**';
const { badge } = priceAlerts;
const [product] = productFixture.data.nodes;
// Prices the live store doesn't have, so a request that escaped the mock would fail the test.
product.variants.edges.forEach(({ node }, index) => {
  node.price.amount = `${1000 + index}.50`;
});

/** Answers both the search and the by-id query with the fixture product. */
async function fulfillShopify(route: Route): Promise<void> {
  const isById = (route.request().postData() ?? '').includes('nodes(ids');
  await route.fulfill({
    json: isById ? productFixture : { data: { products: { edges: [{ node: product }] } } },
  });
}

describe('Chem-Pal price alerts', () => {
  let context: BrowserContext;
  let extensionId: string;
  let watched: Awaited<ReturnType<typeof readAlerts>>[number];

  beforeAll(async () => {
    // Lets context.route intercept what the service worker requests.
    process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
    execSync('pnpm build:e2e', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    context = await launchExtensionContext(buildDir);
    await context.route(shopifyUrl, fulfillShopify);
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    extensionId = worker.url().split('/')[2];
  }, 60_000);

  afterAll(async () => {
    await context?.close();
    // E2E files share one process.
    delete process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS;
  });

  /** Reads the stored price alerts. */
  async function readAlerts(page: Page) {
    return page.evaluate(async () => {
      const stored = await chrome.storage.local.get(null);
      return Object.entries(stored)
        .filter(([key]) => key.startsWith('price_alert:'))
        .map(([key, value]) => ({ key, ...value }));
    });
  }

  /** Pretends every price was higher at the last check, then lets the alarm fire for real. */
  async function triggerDrop(page: Page, alert: Awaited<ReturnType<typeof readAlerts>>[number]) {
    await page.evaluate(async ({ key, ...value }) => {
      for (const snapshot of Object.values<{ price: number }>(value.lastPrices)) {
        snapshot.price *= 2;
      }
      await chrome.storage.local.set({ [key]: value });
      await chrome.alarms.create('price_alerts_check', { when: Date.now() });
    }, alert);
  }

  /** Reads the toolbar badge's text and color. */
  async function readBadge(page: Page) {
    return page.evaluate(async () => ({
      text: await chrome.action.getBadgeText({}),
      color: (await chrome.action.getBadgeBackgroundColor({})).join(),
    }));
  }

  /** Waits for the badge to flash, then settle on one product with a drop. */
  async function expectFlash(page: Page) {
    const seen = new Set<string>();
    await playwrightExpect
      .poll(
        async () => {
          const { text, color } = await readBadge(page);
          if (text === '↓1') seen.add(color);
          return seen.size;
        },
        { timeout: 60_000, intervals: [100] },
      )
      .toBe(2);
    await page.waitForTimeout(badge.flashSeconds * 1000 + 1000);
    vitestExpect(await readBadge(page)).toEqual({ text: '↓1', color: '46,125,50,255' });
  }

  it('watches a product and reports its price drop from the background', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/index.html?view=tab`);
    await setupMockRoutes(page, {
      responsesDir: mockResponsesDir,
      fallback: 'abort',
      verbose: false,
    });
    await page.route(shopifyUrl, fulfillShopify);

    await page.getByRole('textbox', { name: 'search for products' }).fill(product.title);
    await page.keyboard.press('Enter');
    const row = page
      .locator('table')
      .nth(1)
      .locator('tbody tr', { hasText: product.title })
      .first();
    await playwrightExpect(row).toBeVisible({ timeout: 120_000 });
    await playwrightExpect(page.locator('#loading-backdrop')).toBeHidden({ timeout: 120_000 });

    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Enable price reduction alerts' }).click();
    await playwrightExpect.poll(async () => (await readAlerts(page)).length).toBe(1);

    const [alert] = await readAlerts(page);
    watched = alert;
    const resultsBadge = await readBadge(page);
    await triggerDrop(page, alert);
    await expectFlash(page);

    await playwrightExpect
      .poll(async () => (await readAlerts(page))[0].lastDrop, { timeout: 60_000 })
      .toBeTruthy();

    const [checked] = await readAlerts(page);
    vitestExpect(checked.lastStatus).toBe('ok');
    vitestExpect(checked.failures).toBe(0);
    vitestExpect(checked.lastDrop.from).toBeCloseTo(checked.lastDrop.to * 2);
    vitestExpect(checked.lastPrices).toEqual(alert.lastPrices);

    // Removing the alert also takes its drop off the badge.
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Disable price reduction alerts' }).click();
    await playwrightExpect.poll(async () => (await readAlerts(page)).length).toBe(0);
    await playwrightExpect
      .poll(() => page.evaluate(async () => (await chrome.alarms.getAll()).length))
      .toBe(0);
    await playwrightExpect.poll(() => readBadge(page)).toEqual(resultsBadge);
  }, 200_000);

  it('flashes the badge from the background while ChemPal is closed', async () => {
    // The options page doesn't control the badge, so this is all the worker's doing.
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    for (const other of context.pages()) if (other !== page) await other.close();
    await triggerDrop(page, watched);
    await expectFlash(page);
    vitestExpect((await readAlerts(page))[0].hasUnseenDrop).toBe(true);

    // Expanding the list counts as seeing its drops.
    await page.getByRole('button', { name: /^Price Alerts/ }).click();
    await playwrightExpect.poll(() => readBadge(page)).toEqual({ text: '', color: '0,0,0,0' });
    vitestExpect((await readAlerts(page))[0].hasUnseenDrop).toBe(false);
  }, 120_000);
});
