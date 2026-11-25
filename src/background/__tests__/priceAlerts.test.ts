import { defaultSettings } from '@/../config.json';
import {
  CHECK_ALARM,
  RESUME_ALARM,
  registerPriceAlerts,
  runPriceCheck,
  scheduleChecks,
} from '@/background/priceAlerts';
import { CACHE, PRODUCT_REFRESH_STATUS } from '@/constants/common';
import {
  addPriceAlert,
  loadPriceAlerts,
  removePriceAlerts,
  updatePriceAlert,
  type PriceAlert,
} from '@/helpers/priceAlerts';
import { trackEvent } from '@/helpers/analytics';
import { productSeriesKey } from '@/helpers/priceHistory';
import type { ProductRef } from '@/helpers/productRef';
import { BadgeAnimator } from '@/utils/BadgeAnimator';
import {
  clearAllCaches,
  clearPriceHistory,
  getPriceSeries,
  getSupplierProductDataCacheEntry,
  putSupplierProductDataCacheEntry,
} from '@/utils/idbCache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RefreshFn = (refs: ProductRef[]) => Promise<unknown[]>;

// Two fake suppliers whose refetch behaviour each test sets through `ctl`.
const ctl = vi.hoisted(() => ({
  refresh: {} as Record<string, (refs: ProductRef[]) => Promise<unknown[]>>,
  initCache: vi.fn(),
  constructed: [] as unknown[][],
}));

vi.mock('@/suppliers/priceAlertSuppliers', () => {
  const makeFake = (supplierName: string, host: string) =>
    class {
      static supplierName = supplierName;
      static requiredHosts = [host];
      constructor(...args: unknown[]) {
        ctl.constructed.push(args);
      }
      initCache(enabled: boolean) {
        ctl.initCache(supplierName, enabled);
      }
      refreshProducts(refs: ProductRef[]) {
        return ctl.refresh[supplierName](refs);
      }
    };
  return {
    FakeOne: makeFake('Fake One', 'https://one.example/*'),
    FakeTwo: makeFake('Fake Two', 'https://two.example/*'),
  };
});

const HOUR = 3_600_000;
const NOW = 1_800_000_000_000;

const product = (fields: Partial<Product>): Product => fields as unknown as Product;

const item = (cacheKey: string, price: number, fields: Partial<Product> = {}): Product =>
  product({
    cacheKey,
    supplier: 'Fake One',
    title: `Acetone ${cacheKey}`,
    url: `https://one.example/${cacheKey}`,
    permalink: `https://one.example/p/${cacheKey}`,
    price,
    usdPrice: price,
    currencyCode: 'USD',
    quantity: 500,
    uom: 'g',
    variants: [],
    ...fields,
  });

/** Installs a fake `chrome` and returns its spies and captured listeners. */
function installChrome({ withNotifications = true } = {}) {
  const data = new Map<string, unknown>();
  const alarms = new Map<string, chrome.alarms.Alarm>();
  const listeners = {
    storage: [] as Array<(changes: Record<string, unknown>, area: string) => void>,
    alarm: [] as Array<(alarm: { name: string }) => void>,
    installed: [] as Array<() => void>,
    startup: [] as Array<() => void>,
    permissionsAdded: [] as Array<() => void>,
    clicked: [] as Array<(id: string) => void>,
  };

  const storageLocal = {
    get: vi.fn(async (keys?: string | string[] | null) => {
      if (keys == null) return Object.fromEntries(data);
      const wanted = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(wanted.filter((k) => data.has(k)).map((k) => [k, data.get(k)]));
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) data.set(key, structuredClone(value));
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) data.delete(key);
    }),
  };
  const alarmsApi = {
    get: vi.fn(async (name: string) => alarms.get(name)),
    create: vi.fn(async (name: string, info: chrome.alarms.AlarmCreateInfo) => {
      alarms.set(name, { name, scheduledTime: 0, periodInMinutes: info.periodInMinutes });
    }),
    clear: vi.fn(async (name: string) => alarms.delete(name)),
    onAlarm: { addListener: (fn: (alarm: { name: string }) => void) => listeners.alarm.push(fn) },
  };
  const notifications = {
    create: vi.fn(async (_id: string, _options: { message: string }) => ''),
    clear: vi.fn(async () => true),
    onClicked: { addListener: vi.fn((fn: (id: string) => void) => listeners.clicked.push(fn)) },
  };
  const permissions = {
    contains: vi.fn(async () => true),
    onAdded: { addListener: (fn: () => void) => listeners.permissionsAdded.push(fn) },
  };
  const tabs = { create: vi.fn(async () => ({})) };
  const badge = { text: '' };
  const action = {
    getBadgeText: vi.fn(async () => badge.text),
    setBadgeText: vi.fn(async ({ text }: { text: string }) => {
      badge.text = text;
    }),
    setBadgeBackgroundColor: vi.fn(async () => {}),
  };
  // Rejects when no page is open, like the browser does.
  const sendMessage = vi.fn(async (): Promise<unknown> => {
    throw new Error('Receiving end does not exist.');
  });

  const chromeMock: Record<string, unknown> = {
    storage: {
      local: storageLocal,
      onChanged: {
        addListener: (fn: (changes: Record<string, unknown>, area: string) => void) =>
          listeners.storage.push(fn),
      },
    },
    alarms: alarmsApi,
    permissions,
    tabs,
    action,
    i18n: {
      getMessage: (key: string, subs?: string[]) => `${key}:${(subs ?? []).join(',')}`,
    },
    runtime: {
      getURL: (path: string) => `chrome-extension://id/${path}`,
      getPlatformInfo: vi.fn(async () => ({})),
      sendMessage,
      onInstalled: { addListener: (fn: () => void) => listeners.installed.push(fn) },
      onStartup: { addListener: (fn: () => void) => listeners.startup.push(fn) },
    },
  };
  if (withNotifications) chromeMock.notifications = notifications;
  vi.stubGlobal('chrome', chromeMock);

  return {
    chromeMock,
    data,
    alarms,
    alarmsApi,
    notifications,
    permissions,
    tabs,
    badge,
    sendMessage,
    listeners,
  };
}

/** Lets fire-and-forget work in listeners finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/** Sets what every supplier returns, by product cacheKey: a fresh product or a status. */
function serve(results: Record<string, Product | 'unavailable' | 'failed'>) {
  const refresh: RefreshFn = async (refs) =>
    refs.map((ref) => {
      const result = results[ref.cacheKey];
      if (result === 'unavailable') return { status: PRODUCT_REFRESH_STATUS.UNAVAILABLE, ref };
      if (result === 'failed') {
        return { status: PRODUCT_REFRESH_STATUS.FAILED, ref, reason: 'boom' };
      }
      return { status: PRODUCT_REFRESH_STATUS.OK, ref, product: result };
    });
  ctl.refresh['Fake One'] = vi.fn(refresh);
  ctl.refresh['Fake Two'] = vi.fn(refresh);
}

const setSettings = (env: ReturnType<typeof installChrome>, priceAlerts: object) =>
  env.data.set(CACHE.USER_SETTINGS, { ...defaultSettings, priceAlerts });

const alertFor = async (cacheKey: string): Promise<PriceAlert> => {
  const found = (await loadPriceAlerts()).find(({ ref }) => ref.cacheKey === cacheKey);
  if (!found) throw new Error(`No alert for ${cacheKey}`);
  return found;
};

describe('price alert background checks', () => {
  let env: ReturnType<typeof installChrome>;
  const flash = vi.spyOn(BadgeAnimator, 'flash').mockResolvedValue(undefined);

  beforeEach(async () => {
    flash.mockClear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    env = installChrome();
    ctl.initCache.mockClear();
    ctl.constructed.length = 0;
    serve({});
    await clearAllCaches();
    await clearPriceHistory();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('scheduleChecks', () => {
    it('clears the alarms when nothing is watched', async () => {
      await scheduleChecks();

      expect(env.alarmsApi.clear).toHaveBeenCalledWith(CHECK_ALARM);
      expect(env.alarmsApi.clear).toHaveBeenCalledWith(RESUME_ALARM);
      expect(env.alarmsApi.create).not.toHaveBeenCalled();
    });

    it('creates the alarm at the interval, firing soon for a never-checked alert', async () => {
      await addPriceAlert(item('a', 10));

      await scheduleChecks();

      expect(env.alarmsApi.create).toHaveBeenCalledWith(CHECK_ALARM, {
        delayInMinutes: 1,
        periodInMinutes: 12 * 60,
      });
    });

    it('delays the first run until the longest-unchecked alert is due', async () => {
      await addPriceAlert(item('a', 10));
      await addPriceAlert(item('b', 10));
      await updatePriceAlert((await alertFor('a')).id, { lastCheckedAt: NOW - 2 * HOUR });
      await updatePriceAlert((await alertFor('b')).id, { lastCheckedAt: NOW - 5 * HOUR });

      await scheduleChecks();

      expect(env.alarmsApi.create).toHaveBeenCalledWith(CHECK_ALARM, {
        delayInMinutes: 7 * 60,
        periodInMinutes: 12 * 60,
      });
    });

    it('does not recreate an alarm whose period is unchanged', async () => {
      await addPriceAlert(item('a', 10));
      await scheduleChecks();
      env.alarmsApi.create.mockClear();

      await scheduleChecks();

      expect(env.alarmsApi.create).not.toHaveBeenCalled();
    });

    it('recreates the alarm when the interval changes', async () => {
      await addPriceAlert(item('a', 10));
      await scheduleChecks();
      setSettings(env, { checkIntervalHours: 6, minDropPercent: 0 });

      await scheduleChecks();

      expect(env.alarmsApi.create).toHaveBeenLastCalledWith(
        CHECK_ALARM,
        expect.objectContaining({ periodInMinutes: 6 * 60 }),
      );
    });
  });

  describe('runPriceCheck', () => {
    it('refetches only due alerts, one call per supplier', async () => {
      await addPriceAlert(item('a', 10));
      await addPriceAlert(item('b', 10));
      await addPriceAlert(item('c', 10));
      await addPriceAlert(item('d', 10, { supplier: 'Fake Two' }));
      await updatePriceAlert((await alertFor('c')).id, { lastCheckedAt: NOW - HOUR });
      serve({ a: item('a', 10), b: item('b', 10), d: item('d', 10, { supplier: 'Fake Two' }) });

      await runPriceCheck();

      expect(ctl.refresh['Fake One']).toHaveBeenCalledTimes(1);
      expect(ctl.refresh['Fake Two']).toHaveBeenCalledTimes(1);
      const refs = vi.mocked(ctl.refresh['Fake One']).mock.calls[0][0];
      expect(refs.map(({ cacheKey }) => cacheKey).sort()).toEqual(['a', 'b']);
    });

    it('builds the supplier with the cache for product data turned off', async () => {
      await addPriceAlert(item('a', 10));
      serve({ a: item('a', 10) });

      await runPriceCheck();

      expect(ctl.initCache).toHaveBeenCalledWith('Fake One', false);
    });

    it('records a drop: updates the alert, history and caches, and notifies', async () => {
      const watched = item('a', 24);
      await addPriceAlert(watched);
      const key = productSeriesKey(watched)!;
      await putSupplierProductDataCacheEntry(key, {
        data: { cacheKey: 'a', price: 24, cas: '67-64-1' },
        timestamp: 7,
      });
      serve({ a: item('a', 19.5) });

      await runPriceCheck();

      const alert = await alertFor('a');
      expect(alert).toMatchObject({
        failures: 0,
        lastStatus: 'ok',
        lastCheckedAt: NOW,
        lastDrop: { title: 'Acetone a', from: 24, to: 19.5, at: NOW },
      });
      expect(alert.lastPrices[alert.id].price).toBe(19.5);
      expect((await getPriceSeries(key))?.points.map((p) => p.usd)).toEqual([19.5]);
      expect((await getSupplierProductDataCacheEntry(key))?.data).toMatchObject({
        price: 19.5,
        cas: '67-64-1',
      });
      expect(env.notifications.create).toHaveBeenCalledTimes(1);
      expect(env.notifications.create).toHaveBeenCalledWith(
        `price_alert:${alert.id}`,
        expect.objectContaining({
          type: 'basic',
          title: 'price_alert_notification_title:Fake One',
          message: 'Acetone a: $24.00 → $19.50',
        }),
      );
    });

    it('does not notify or log history when the price is unchanged', async () => {
      const watched = item('a', 24);
      await addPriceAlert(watched);
      // An exchange-rate-only move leaves the native price alone.
      serve({ a: item('a', 24, { usdPrice: 22 }) });

      await runPriceCheck();

      expect(env.notifications.create).not.toHaveBeenCalled();
      expect((await alertFor('a')).lastDrop).toBeUndefined();
      expect(await getPriceSeries(productSeriesKey(watched)!)).toBeUndefined();
    });

    it('moves the baseline silently on an increase', async () => {
      await addPriceAlert(item('a', 24));
      serve({ a: item('a', 30) });

      await runPriceCheck();

      const alert = await alertFor('a');
      expect(alert.lastPrices[alert.id].price).toBe(30);
      expect(env.notifications.create).not.toHaveBeenCalled();
    });

    it('ignores a drop below the configured threshold and keeps the baseline', async () => {
      setSettings(env, { checkIntervalHours: 12, minDropPercent: 10 });
      await addPriceAlert(item('a', 100));
      serve({ a: item('a', 95) });

      await runPriceCheck();

      const alert = await alertFor('a');
      expect(alert.lastPrices[alert.id].price).toBe(100);
      expect(alert.lastDrop).toBeUndefined();
      expect(env.notifications.create).not.toHaveBeenCalled();
    });

    it('resets failures when the product is unavailable', async () => {
      await addPriceAlert(item('a', 24));
      await updatePriceAlert((await alertFor('a')).id, { failures: 2 });
      serve({ a: 'unavailable' });

      await runPriceCheck();

      expect(await alertFor('a')).toMatchObject({ failures: 0, lastStatus: 'unavailable' });
    });

    it('counts a failed refetch and keeps the last prices', async () => {
      await addPriceAlert(item('a', 24));
      const before = await alertFor('a');
      serve({ a: 'failed' });

      await runPriceCheck();

      const after = await alertFor('a');
      expect(after).toMatchObject({ failures: 1, lastStatus: 'failed', lastCheckedAt: NOW });
      expect(after.lastPrices).toEqual(before.lastPrices);
    });

    it('does not notify or resurrect an alert removed during the check', async () => {
      await addPriceAlert(item('a', 24));
      const { id } = await alertFor('a');
      ctl.refresh['Fake One'] = vi.fn(async (refs: ProductRef[]) => {
        await removePriceAlerts([id]);
        return refs.map((ref) => ({
          status: PRODUCT_REFRESH_STATUS.OK,
          ref,
          product: item('a', 10),
        }));
      });

      await runPriceCheck();

      expect(await loadPriceAlerts()).toEqual([]);
      expect(env.notifications.create).not.toHaveBeenCalled();
    });

    it('lets one supplier fail without stopping another', async () => {
      await addPriceAlert(item('a', 24));
      await addPriceAlert(item('b', 24, { supplier: 'Fake Two' }));
      serve({ b: item('b', 12, { supplier: 'Fake Two' }) });
      ctl.refresh['Fake One'] = vi.fn(async () => {
        throw new Error('network down');
      });

      await runPriceCheck();

      expect(env.notifications.create).toHaveBeenCalledTimes(1);
      expect((await alertFor('b')).lastDrop).toMatchObject({ from: 24, to: 12 });
      expect((await alertFor('a')).lastCheckedAt).toBe(NOW);
    });

    it('still reports a drop when another product of the supplier cannot be applied', async () => {
      await addPriceAlert(item('a', 24));
      await addPriceAlert(item('b', 24));
      ctl.refresh['Fake One'] = vi.fn(async (refs: ProductRef[]) =>
        refs.map((ref) => ({
          status: PRODUCT_REFRESH_STATUS.OK,
          ref,
          product: ref.cacheKey === 'a' ? item('a', 12) : undefined,
        })),
      );

      await runPriceCheck();

      expect(env.notifications.create).toHaveBeenCalledTimes(1);
      expect((await alertFor('a')).lastDrop).toMatchObject({ from: 24, to: 12 });
    });

    it('fails every alert of a supplier without host permission', async () => {
      await addPriceAlert(item('a', 24));
      env.permissions.contains.mockResolvedValue(false);

      await runPriceCheck();

      expect(env.permissions.contains).toHaveBeenCalledWith({ origins: ['https://one.example/*'] });
      expect(ctl.refresh['Fake One']).not.toHaveBeenCalled();
      expect(await alertFor('a')).toMatchObject({ failures: 1, lastStatus: 'failed' });
    });

    it('fails alerts of a supplier that is no longer supported', async () => {
      await addPriceAlert(item('a', 24, { supplier: 'Retired Supplier' }));

      await runPriceCheck();

      expect(await alertFor('a')).toMatchObject({ failures: 1, lastStatus: 'failed' });
    });

    it('saves the drop without throwing when the notifications API is absent', async () => {
      env = installChrome({ withNotifications: false });
      await addPriceAlert(item('a', 24));
      serve({ a: item('a', 20) });

      await expect(runPriceCheck()).resolves.toBeUndefined();

      expect((await alertFor('a')).lastDrop).toMatchObject({ from: 24, to: 20 });
    });

    it('sums up more drops than the configured maximum in one notification', async () => {
      const keys = ['a', 'b', 'c', 'd'];
      for (const key of keys) await addPriceAlert(item(key, 20));
      serve(Object.fromEntries(keys.map((key) => [key, item(key, 10)])));

      await runPriceCheck();

      expect(env.notifications.create).toHaveBeenCalledTimes(1);
      const [id, options] = env.notifications.create.mock.calls[0];
      expect(id).toBe('price_alerts:Fake One');
      expect(options.message.split('\n')).toHaveLength(4);
      expect(options.message).toContain('$20.00 → $10.00');
    });

    it('notifies each product separately up to the maximum', async () => {
      const keys = ['a', 'b', 'c'];
      for (const key of keys) await addPriceAlert(item(key, 20));
      serve(Object.fromEntries(keys.map((key) => [key, item(key, 10)])));

      await runPriceCheck();

      expect(env.notifications.create).toHaveBeenCalledTimes(3);
    });

    it('shares one run between concurrent calls', async () => {
      await addPriceAlert(item('a', 24));
      serve({ a: item('a', 24) });

      await Promise.all([runPriceCheck(), runPriceCheck()]);

      expect(ctl.refresh['Fake One']).toHaveBeenCalledTimes(1);

      await updatePriceAlert((await alertFor('a')).id, { lastCheckedAt: 0 });
      await runPriceCheck();
      expect(ctl.refresh['Fake One']).toHaveBeenCalledTimes(2);
    });

    it('creates the resume alarm for the run, then clears it', async () => {
      await addPriceAlert(item('a', 24));
      serve({ a: item('a', 24) });

      await runPriceCheck();

      expect(env.alarmsApi.create).toHaveBeenCalledWith(RESUME_ALARM, { periodInMinutes: 1 });
      const created = env.alarmsApi.create.mock.invocationCallOrder[0];
      const cleared = env.alarmsApi.clear.mock.invocationCallOrder.at(-1)!;
      expect(cleared).toBeGreaterThan(created);
      expect(env.alarms.has(RESUME_ALARM)).toBe(false);
    });

    it('does not create the resume alarm when nothing is due', async () => {
      await addPriceAlert(item('a', 24));
      await updatePriceAlert((await alertFor('a')).id, { lastCheckedAt: NOW });

      await runPriceCheck();

      expect(env.alarmsApi.create).not.toHaveBeenCalled();
      expect(env.alarmsApi.clear).toHaveBeenCalledWith(RESUME_ALARM);
    });
  });

  describe('analytics', () => {
    beforeEach(() => {
      vi.mocked(trackEvent).mockClear();
    });

    it('reports each triggered alert without its product', async () => {
      await addPriceAlert(item('a', 24));
      await addPriceAlert(item('b', 30));
      await addPriceAlert(item('c', 10));
      vi.mocked(trackEvent).mockClear();
      serve({ a: item('a', 18), b: item('b', 20), c: item('c', 11) });

      await runPriceCheck();

      const calls = vi.mocked(trackEvent).mock.calls;
      expect(calls).toHaveLength(2);
      for (const drop_percent of [25, 33.33]) {
        expect(calls).toContainEqual([
          'price_alert_triggered',
          { supplier: 'Fake One', drop_percent, dropped_prices: 1 },
        ]);
      }
    });

    it('reports nothing for an alert removed during the check', async () => {
      await addPriceAlert(item('a', 24));
      const { id } = await alertFor('a');
      ctl.refresh['Fake One'] = vi.fn(async (refs: ProductRef[]) => {
        await removePriceAlerts([id]);
        return refs.map((ref) => ({
          status: PRODUCT_REFRESH_STATUS.OK,
          ref,
          product: item('a', 10),
        }));
      });

      await runPriceCheck();

      expect(trackEvent).not.toHaveBeenCalledWith('price_alert_triggered', expect.anything());
    });
  });

  describe('badge', () => {
    it('flashes the number of products with an unseen drop', async () => {
      await addPriceAlert(item('a', 24));
      await addPriceAlert(item('b', 24));
      await addPriceAlert(item('c', 24));
      await updatePriceAlert((await alertFor('c')).id, { hasUnseenDrop: true, lastCheckedAt: NOW });
      serve({ a: item('a', 12), b: item('b', 30) });

      await runPriceCheck();

      expect(env.badge.text).toBe('↓2');
      expect(flash).toHaveBeenCalledTimes(1);
      expect((await alertFor('a')).hasUnseenDrop).toBe(true);
      expect((await alertFor('b')).hasUnseenDrop).toBeUndefined();
    });

    it('works without the notification permission', async () => {
      env = installChrome({ withNotifications: false });
      await addPriceAlert(item('a', 24));
      serve({ a: item('a', 12) });

      await runPriceCheck();

      expect(env.badge.text).toBe('↓1');
    });

    it('is left alone when nothing dropped, or a page controls it', async () => {
      await addPriceAlert(item('a', 24));
      serve({ a: item('a', 24) });
      await runPriceCheck();
      expect(env.sendMessage).not.toHaveBeenCalled();

      env.sendMessage.mockResolvedValue(true);
      await updatePriceAlert((await alertFor('a')).id, { lastCheckedAt: 0 });
      serve({ a: item('a', 12) });
      await runPriceCheck();

      expect(env.badge.text).toBe('');
      expect(env.notifications.create).toHaveBeenCalledTimes(1);
    });

    it.each<[string, () => Promise<unknown>]>([
      ['does not answer', async () => undefined],
      ['is frozen', () => new Promise(() => {})],
    ])('is set when an open page %s', async (_name, reply) => {
      env.sendMessage.mockImplementation(reply);
      await addPriceAlert(item('a', 24));
      serve({ a: item('a', 12) });

      await runPriceCheck();

      expect(env.badge.text).toBe('↓1');
      expect(env.notifications.create).toHaveBeenCalledTimes(1);
    });

    it('does not stop the notification when it fails', async () => {
      delete env.chromeMock.action;
      await addPriceAlert(item('a', 24));
      serve({ a: item('a', 12) });

      await runPriceCheck();

      expect(env.notifications.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerPriceAlerts', () => {
    let openApp: ReturnType<typeof vi.fn<() => Promise<void>>>;

    beforeEach(() => {
      openApp = vi.fn(async () => {});
      registerPriceAlerts(openApp);
    });

    it('marks the drops of a clicked notification as seen', async () => {
      const keys = ['a', 'b', 'c'];
      for (const key of keys) {
        await addPriceAlert(item(key, 24, key === 'c' ? { supplier: 'Fake Two' } : {}));
        await updatePriceAlert((await alertFor(key)).id, { hasUnseenDrop: true });
      }
      const unseen = async () =>
        Promise.all(keys.map(async (key) => (await alertFor(key)).hasUnseenDrop));

      env.listeners.clicked[0](`price_alert:${(await alertFor('a')).id}`);
      await settle();
      expect(await unseen()).toEqual([false, true, true]);

      env.listeners.clicked[0]('price_alerts:Fake One');
      await settle();
      expect(await unseen()).toEqual([false, false, true]);
    });

    it('restores the badge on startup, without flashing', async () => {
      await addPriceAlert(item('a', 24));
      await updatePriceAlert((await alertFor('a')).id, { hasUnseenDrop: true });

      for (const listener of env.listeners.startup) listener();
      await settle();

      expect(env.badge.text).toBe('↓1');
      expect(flash).not.toHaveBeenCalled();
    });

    it('opens a product notification at its permalink and clears it', async () => {
      await addPriceAlert(item('a', 24));
      const { id } = await alertFor('a');

      env.listeners.clicked[0](`price_alert:${id}`);
      await settle();

      expect(env.tabs.create).toHaveBeenCalledWith({ url: 'https://one.example/p/a' });
      expect(env.notifications.clear).toHaveBeenCalledWith(`price_alert:${id}`);
      expect(openApp).not.toHaveBeenCalled();
    });

    it('opens the app for a summary notification', async () => {
      env.listeners.clicked[0]('price_alerts:Fake One');
      await settle();

      expect(openApp).toHaveBeenCalledTimes(1);
      expect(env.tabs.create).not.toHaveBeenCalled();
      expect(env.notifications.clear).toHaveBeenCalledWith('price_alerts:Fake One');
    });

    it('ignores notifications that are not its own', async () => {
      env.listeners.clicked[0]('something_else');
      await settle();

      expect(openApp).not.toHaveBeenCalled();
      expect(env.tabs.create).not.toHaveBeenCalled();
      expect(env.notifications.clear).not.toHaveBeenCalled();
    });

    it('registers the click listener when the permission is granted later', () => {
      env = installChrome({ withNotifications: false });
      registerPriceAlerts(openApp);
      expect(env.listeners.clicked).toHaveLength(0);

      env.chromeMock.notifications = env.notifications;
      for (const listener of env.listeners.permissionsAdded) listener();

      expect(env.listeners.clicked).toHaveLength(1);
    });

    it('runs a check when its alarm fires, and ignores other alarms', async () => {
      await addPriceAlert(item('a', 24));
      serve({ a: item('a', 24) });

      for (const listener of env.listeners.alarm) listener({ name: 'unrelated' });
      await settle();
      expect(ctl.refresh['Fake One']).not.toHaveBeenCalled();

      for (const listener of env.listeners.alarm) listener({ name: CHECK_ALARM });
      await settle();
      expect(ctl.refresh['Fake One']).toHaveBeenCalledTimes(1);
    });

    it('reschedules on install and startup', async () => {
      await addPriceAlert(item('a', 24));

      for (const listener of env.listeners.startup) listener();
      await settle();

      expect(env.alarmsApi.create).toHaveBeenCalledWith(CHECK_ALARM, expect.any(Object));
      expect(env.listeners.installed.length).toBe(env.listeners.startup.length);
    });

    describe('storage changes', () => {
      const change = (changes: Record<string, object>, area = 'local') =>
        env.listeners.storage.forEach((listener) => listener(changes, area));

      it.each<[string, string, string, (id: string) => Promise<void>]>([
        ['counts down', '↓2', '↓1', async () => {}],
        ['is removed with the last drop', '↓1', '', (id) => removePriceAlerts([id])],
        ['keeps a result count', '7', '7', (id) => removePriceAlerts([id])],
      ])('updates the badge when a drop is seen: %s', async (_name, before, after, prepare) => {
        await addPriceAlert(item('a', 24));
        const { id } = await alertFor('a');
        await updatePriceAlert(id, { hasUnseenDrop: true });
        const oldValue = await alertFor('a');
        env.badge.text = before;
        await prepare(id);

        change({
          'price_alert:b': { oldValue, newValue: { ...oldValue, hasUnseenDrop: false } },
        });
        await settle();

        expect(env.badge.text).toBe(after);
      });

      it('leaves a new drop to the check that found it', async () => {
        await addPriceAlert(item('a', 24));
        const oldValue = await alertFor('a');

        change({ 'price_alert:a': { oldValue, newValue: { ...oldValue, hasUnseenDrop: true } } });
        await settle();

        expect(env.sendMessage).not.toHaveBeenCalled();
      });

      it('reschedules when an alert is added', async () => {
        await addPriceAlert(item('a', 24));
        const { id } = await alertFor('a');

        change({ [`price_alert:${id}`]: { newValue: { id } } });
        await settle();

        expect(env.alarmsApi.create).toHaveBeenCalledWith(CHECK_ALARM, expect.any(Object));
      });

      it('reschedules when an alert is removed', async () => {
        change({ 'price_alert:gone': { oldValue: { id: 'gone' } } });
        await settle();

        expect(env.alarmsApi.clear).toHaveBeenCalledWith(CHECK_ALARM);
      });

      it('reschedules when the settings change', async () => {
        await addPriceAlert(item('a', 24));

        change({ [CACHE.USER_SETTINGS]: { oldValue: {}, newValue: {} } });
        await settle();

        expect(env.alarmsApi.create).toHaveBeenCalled();
      });

      it('ignores a check updating its own alert, other keys and other areas', async () => {
        await addPriceAlert(item('a', 24));

        change({ 'price_alert:a': { oldValue: { id: 'a' }, newValue: { id: 'a' } } });
        change({ other_key: { newValue: 1 } });
        change({ 'price_alert:a': { newValue: { id: 'a' } } }, 'session');
        await settle();

        expect(env.alarmsApi.get).not.toHaveBeenCalled();
        expect(env.alarmsApi.create).not.toHaveBeenCalled();
        expect(env.alarmsApi.clear).not.toHaveBeenCalled();
      });
    });
  });
});
