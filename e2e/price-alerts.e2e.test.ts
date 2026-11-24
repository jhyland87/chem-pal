import { expect as playwrightExpect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import type { BrowserContext, Page, Route } from 'playwright';
import { afterAll, beforeAll, describe, it, expect as vitestExpect } from 'vitest';
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

    // Pretend every price was higher at the last check, then let the alarm fire for real.
    const [alert] = await readAlerts(page);
    await page.evaluate(async ({ key, ...value }) => {
      for (const snapshot of Object.values<{ price: number }>(value.lastPrices)) {
        snapshot.price *= 2;
      }
      await chrome.storage.local.set({ [key]: value });
      await chrome.alarms.create('price_alerts_check', { when: Date.now() });
    }, alert);

    await playwrightExpect
      .poll(async () => (await readAlerts(page))[0].lastDrop, { timeout: 60_000 })
      .toBeTruthy();

    const [checked] = await readAlerts(page);
    vitestExpect(checked.lastStatus).toBe('ok');
    vitestExpect(checked.failures).toBe(0);
    vitestExpect(checked.lastDrop.from).toBeCloseTo(checked.lastDrop.to * 2);
    vitestExpect(checked.lastPrices).toEqual(alert.lastPrices);

    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Disable price reduction alerts' }).click();
    await playwrightExpect.poll(async () => (await readAlerts(page)).length).toBe(0);
    await playwrightExpect
      .poll(() => page.evaluate(async () => (await chrome.alarms.getAll()).length))
      .toBe(0);
  }, 200_000);
});
