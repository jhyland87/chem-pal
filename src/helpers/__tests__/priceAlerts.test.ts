import { trackEvent } from '@/helpers/analytics';
import {
  addPriceAlert,
  collectNativePrices,
  detectPriceDrops,
  dropPercent,
  getUnseenDrops,
  isPriceAlertKey,
  loadPriceAlerts,
  markDropsSeen,
  removePriceAlerts,
  resolvePriceAlertSettings,
  updatePriceAlert,
  type PriceAlert,
  type PriceSnapshot,
} from '@/helpers/priceAlerts';
import { productSeriesKey, variantSeriesKey } from '@/helpers/priceHistory';
import { variantRowTitle } from '@/helpers/product';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const product = (fields: Partial<Product>): Product => fields as unknown as Product;
const variant = (fields: Partial<Variant>): Variant => fields as unknown as Variant;

const baseProduct = (fields: Partial<Product> = {}): Product =>
  product({
    cacheKey: 'ck-1',
    supplier: 'Loudwolf',
    title: 'Acetone',
    url: 'https://loudwolf.com/acetone',
    price: 24,
    currencyCode: 'USD',
    quantity: 500,
    uom: 'g',
    variants: [],
    ...fields,
  });

/** Installs an in-memory `chrome.storage.local`. */
function installStorage() {
  const data = new Map<string, unknown>();
  const get = vi.fn(async (keys?: string | string[] | null) => {
    if (keys == null) return Object.fromEntries(data);
    const wanted = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(wanted.filter((key) => data.has(key)).map((k) => [k, data.get(k)]));
  });
  const set = vi.fn(async (items: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(items)) data.set(key, structuredClone(value));
  });
  const remove = vi.fn(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) data.delete(key);
  });
  vi.stubGlobal('chrome', { storage: { local: { get, set, remove } } });
  return { data, get, set, remove };
}

const snapshot = (price: number, fields: Partial<PriceSnapshot> = {}): PriceSnapshot => ({
  title: 'Acetone 500 g',
  price,
  currencyCode: 'USD',
  quantity: 500,
  uom: 'g',
  ...fields,
});

describe('price alert watchlist', () => {
  let storage: ReturnType<typeof installStorage>;

  beforeEach(() => {
    storage = installStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('adds an alert and loads it back', async () => {
    const item = baseProduct({ permalink: 'https://loudwolf.com/p/acetone' });

    expect(await addPriceAlert(item)).toBe(true);

    const [alert] = await loadPriceAlerts();
    expect(alert).toMatchObject({
      id: productSeriesKey(item),
      supplier: 'Loudwolf',
      title: 'Acetone',
      permalink: 'https://loudwolf.com/p/acetone',
      failures: 0,
      ref: { cacheKey: 'ck-1', url: 'https://loudwolf.com/acetone' },
    });
    expect(alert.lastPrices[alert.id]).toMatchObject({ price: 24, currencyCode: 'USD' });
  });

  it('falls back to the url when there is no permalink', async () => {
    await addPriceAlert(baseProduct());
    expect((await loadPriceAlerts())[0].permalink).toBe('https://loudwolf.com/acetone');
  });

  it('refuses a product that cannot be refetched or keyed', async () => {
    expect(await addPriceAlert(baseProduct({ cacheKey: undefined }))).toBe(false);
    expect(await addPriceAlert(baseProduct({ url: undefined }))).toBe(false);
    expect(await addPriceAlert(baseProduct({ supplier: undefined }))).toBe(false);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('calls storage before anything is awaited', () => {
    const pending = addPriceAlert(baseProduct());

    expect(storage.set).toHaveBeenCalledTimes(1);
    return pending;
  });

  it('lists the newest alerts first', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    await addPriceAlert(baseProduct({ cacheKey: 'old' }));
    vi.setSystemTime(2000);
    await addPriceAlert(baseProduct({ cacheKey: 'new' }));

    const alerts = await loadPriceAlerts();
    expect(alerts.map(({ ref }) => ref.cacheKey)).toEqual(['new', 'old']);
  });

  it('ignores invalid stored values and unrelated keys', async () => {
    await addPriceAlert(baseProduct());
    storage.data.set('price_alert:broken', { id: 'broken' });
    storage.data.set('price_alert:text', 'nope');
    storage.data.set('user_settings', { priceAlerts: {} });

    expect(await loadPriceAlerts()).toHaveLength(1);
  });

  it('updates an existing alert, keeping the other fields', async () => {
    await addPriceAlert(baseProduct());
    const [alert] = await loadPriceAlerts();

    expect(await updatePriceAlert(alert.id, { failures: 2, lastCheckedAt: 5 })).toBe(true);

    expect((await loadPriceAlerts())[0]).toMatchObject({ title: 'Acetone', failures: 2 });
  });

  it('returns false after removal and does not resurrect the alert', async () => {
    await addPriceAlert(baseProduct());
    const [alert] = await loadPriceAlerts();
    await removePriceAlerts([alert.id]);
    storage.set.mockClear();

    expect(await updatePriceAlert(alert.id, { failures: 1 })).toBe(false);

    expect(storage.set).not.toHaveBeenCalled();
    expect(await loadPriceAlerts()).toEqual([]);
  });

  it('removes only the given alerts', async () => {
    await addPriceAlert(baseProduct({ cacheKey: 'a' }));
    await addPriceAlert(baseProduct({ cacheKey: 'b' }));
    const [first, second] = await loadPriceAlerts();

    await removePriceAlerts([first.id]);

    expect((await loadPriceAlerts()).map(({ id }) => id)).toEqual([second.id]);
  });
});

describe('analytics', () => {
  beforeEach(() => {
    installStorage();
    vi.mocked(trackEvent).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a created alert with its supplier only', async () => {
    await addPriceAlert(baseProduct());
    expect(vi.mocked(trackEvent).mock.calls).toEqual([
      ['price_alert_created', { supplier: 'Loudwolf' }],
    ]);
  });

  it('reports nothing when the product cannot be watched', async () => {
    await addPriceAlert(baseProduct({ cacheKey: undefined }));
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('reports each removed alert, but not ids that were not stored', async () => {
    await addPriceAlert(baseProduct({ cacheKey: 'a' }));
    await addPriceAlert(baseProduct({ cacheKey: 'b', supplier: 'LabChem' }));
    const ids = (await loadPriceAlerts()).map(({ id }) => id);
    vi.mocked(trackEvent).mockClear();

    await removePriceAlerts([...ids, 'missing']);

    const calls = vi.mocked(trackEvent).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls).toContainEqual(['price_alert_removed', { supplier: 'Loudwolf' }]);
    expect(calls).toContainEqual(['price_alert_removed', { supplier: 'LabChem' }]);
  });
});

describe('unseen drops', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('are the only alerts marked as seen', async () => {
    const { set } = installStorage();
    await addPriceAlert(baseProduct({ cacheKey: 'a' }));
    await addPriceAlert(baseProduct({ cacheKey: 'b' }));
    const [{ id }] = await loadPriceAlerts();
    await updatePriceAlert(id, { hasUnseenDrop: true });
    expect(getUnseenDrops(await loadPriceAlerts()).map((alert) => alert.id)).toEqual([id]);
    set.mockClear();

    await markDropsSeen(await loadPriceAlerts());

    expect(set).toHaveBeenCalledTimes(1);
    expect(getUnseenDrops(await loadPriceAlerts())).toEqual([]);
  });
});

describe('dropPercent', () => {
  it('is relative to the earlier price', () => {
    expect(dropPercent({ from: 24, to: 18 })).toBe(25);
  });
});

describe('isPriceAlertKey', () => {
  it('matches alert keys only', () => {
    expect(isPriceAlertKey('price_alert:3f9c2a')).toBe(true);
    expect(isPriceAlertKey('user_settings')).toBe(false);
    expect(isPriceAlertKey('price_alerts')).toBe(false);
  });
});

describe('resolvePriceAlertSettings', () => {
  const resolve = (priceAlerts: unknown) =>
    resolvePriceAlertSettings({ priceAlerts } as unknown as UserSettings);

  it('uses the defaults when nothing is set', () => {
    expect(resolvePriceAlertSettings(undefined)).toEqual({
      checkIntervalHours: 12,
      minDropPercent: 0,
    });
    expect(resolve(undefined)).toEqual({ checkIntervalHours: 12, minDropPercent: 0 });
  });

  it('reads numeric strings from the settings inputs', () => {
    expect(resolve({ checkIntervalHours: '24', minDropPercent: '2.5' })).toEqual({
      checkIntervalHours: 24,
      minDropPercent: 2.5,
    });
  });

  it('falls back on blank and non-numeric values', () => {
    expect(resolve({ checkIntervalHours: '', minDropPercent: 'abc' })).toEqual({
      checkIntervalHours: 12,
      minDropPercent: 0,
    });
  });

  it('clamps values to the configured range', () => {
    expect(resolve({ checkIntervalHours: 500, minDropPercent: 95 })).toEqual({
      checkIntervalHours: 168,
      minDropPercent: 90,
    });
    expect(resolve({ checkIntervalHours: 0, minDropPercent: -5 })).toEqual({
      checkIntervalHours: 1,
      minDropPercent: 0,
    });
  });
});

describe('collectNativePrices', () => {
  it('collects each size by its series key, titled like its table row', () => {
    const small = variant({
      id: 's1',
      title: '100 g',
      price: 9,
      currencyCode: 'USD',
      quantity: 100,
      uom: 'g',
    });
    const large = variant({ id: 's2', title: '500 g', price: 24, quantity: 500, uom: 'g' });
    const item = baseProduct({ price: 9, variants: [small, large] });

    const prices = collectNativePrices(item);

    expect(Object.keys(prices)).toEqual([
      variantSeriesKey(item, small),
      variantSeriesKey(item, large),
    ]);
    expect(prices[variantSeriesKey(item, small)!]).toEqual({
      title: variantRowTitle(item, small),
      price: 9,
      currencyCode: 'USD',
      quantity: 100,
      uom: 'g',
    });
    // A size without its own currency uses the product's.
    expect(prices[variantSeriesKey(item, large)!].currencyCode).toBe('USD');
  });

  it('skips the headline when a size has the same price', () => {
    const item = baseProduct({
      price: 24,
      variants: [variant({ id: 's2', title: '500 g', price: 24 })],
    });

    expect(Object.keys(collectNativePrices(item))).toEqual([
      variantSeriesKey(item, item.variants![0]),
    ]);
  });

  it('keeps the headline when no size has its price', () => {
    const item = baseProduct({
      price: 30,
      variants: [variant({ id: 's2', title: '500 g', price: 24 })],
    });

    const prices = collectNativePrices(item);

    expect(prices[productSeriesKey(item)!]).toMatchObject({ title: 'Acetone', price: 30 });
    expect(Object.keys(prices)).toHaveLength(2);
  });

  it('drops sizes that cannot be told apart', () => {
    const item = baseProduct({
      price: 50,
      variants: [
        variant({ title: '500 g', price: 24 }),
        variant({ title: '500 g', price: 26 }),
        variant({ title: '1 kg', price: 40 }),
      ],
    });

    const titles = Object.values(collectNativePrices(item)).map(({ price }) => price);

    expect(titles.sort()).toEqual([40, 50]);
  });

  it('skips zero, negative and NaN prices', () => {
    const item = baseProduct({
      price: 0,
      variants: [
        variant({ id: 'a', title: 'A', price: 0 }),
        variant({ id: 'b', title: 'B', price: Number.NaN }),
        variant({ id: 'c', title: 'C', price: -3 }),
        variant({ id: 'd', title: 'D', price: 5 }),
      ],
    });

    expect(Object.values(collectNativePrices(item)).map(({ price }) => price)).toEqual([5]);
  });

  it('rounds prices to cents', () => {
    const prices = collectNativePrices(baseProduct({ price: 19.999999 }));
    expect(Object.values(prices)[0].price).toBe(20);
  });

  it('returns nothing for a product that cannot be keyed', () => {
    expect(collectNativePrices(baseProduct({ supplier: undefined }))).toEqual({});
  });
});

describe('detectPriceDrops', () => {
  const alert = (
    lastPrices: Record<string, PriceSnapshot>,
  ): Pick<PriceAlert, 'id' | 'lastPrices'> => ({
    id: 'P',
    lastPrices,
  });

  it('reports a simple drop and moves the baseline', () => {
    const result = detectPriceDrops(alert({ 'P::a': snapshot(24) }), { 'P::a': snapshot(19.5) }, 0);

    expect(result.drops).toEqual([
      { title: 'Acetone 500 g', from: 24, to: 19.5, currencyCode: 'USD' },
    ]);
    expect(result.changed).toBe(true);
    expect(result.lastPrices['P::a'].price).toBe(19.5);
  });

  it('reports a drop of exactly the threshold, not one just under it', () => {
    const last = alert({ 'P::a': snapshot(100) });

    expect(detectPriceDrops(last, { 'P::a': snapshot(95) }, 5).drops).toHaveLength(1);
    expect(detectPriceDrops(last, { 'P::a': snapshot(95.01) }, 5).drops).toHaveLength(0);
  });

  it('adds up small drops until they pass the threshold', () => {
    let last = alert({ 'P::a': snapshot(100) });

    const first = detectPriceDrops(last, { 'P::a': snapshot(98) }, 5);
    expect(first.drops).toEqual([]);
    expect(first.changed).toBe(true);
    expect(first.lastPrices['P::a'].price).toBe(100);

    last = alert(first.lastPrices);
    const second = detectPriceDrops(last, { 'P::a': snapshot(94) }, 5);
    expect(second.drops).toEqual([
      { title: 'Acetone 500 g', from: 100, to: 94, currencyCode: 'USD' },
    ]);
    expect(second.lastPrices['P::a'].price).toBe(94);
  });

  it('moves the baseline silently on an increase', () => {
    const result = detectPriceDrops(alert({ 'P::a': snapshot(20) }), { 'P::a': snapshot(25) }, 0);

    expect(result.drops).toEqual([]);
    expect(result.changed).toBe(true);
    expect(result.lastPrices['P::a'].price).toBe(25);
  });

  it('re-baselines without a drop when the currency changes', () => {
    const result = detectPriceDrops(
      alert({ 'P::a': snapshot(24) }),
      { 'P::a': snapshot(10, { currencyCode: 'EUR' }) },
      0,
    );

    expect(result.drops).toEqual([]);
    expect(result.lastPrices['P::a']).toMatchObject({ price: 10, currencyCode: 'EUR' });
  });

  it('re-baselines the headline when its pack size changes', () => {
    const result = detectPriceDrops(
      alert({ P: snapshot(24) }),
      { P: snapshot(9, { quantity: 100 }) },
      0,
    );

    expect(result.drops).toEqual([]);
    expect(result.changed).toBe(true);
    expect(result.lastPrices.P).toMatchObject({ price: 9, quantity: 100 });
  });

  it('compares a size of a different pack size by its own series, not its headline', () => {
    const result = detectPriceDrops(
      alert({ 'P::a': snapshot(24) }),
      { 'P::a': snapshot(20, { quantity: 100 }) },
      0,
    );

    expect(result.drops).toHaveLength(1);
  });

  it('records a new series without a drop', () => {
    const result = detectPriceDrops(alert({}), { 'P::new': snapshot(5) }, 0);

    expect(result.drops).toEqual([]);
    expect(result.changed).toBe(true);
    expect(result.lastPrices['P::new'].price).toBe(5);
  });

  it('keeps the baseline of a series missing this time', () => {
    const result = detectPriceDrops(
      alert({ 'P::a': snapshot(24), 'P::b': snapshot(10) }),
      { 'P::a': snapshot(24) },
      0,
    );

    expect(result.lastPrices['P::b'].price).toBe(10);
    expect(result.changed).toBe(false);
  });

  it('sorts drops by the largest percentage first', () => {
    const result = detectPriceDrops(
      alert({
        'P::a': snapshot(100, { title: 'small' }),
        'P::b': snapshot(100, { title: 'big' }),
        'P::c': snapshot(10, { title: 'mid' }),
      }),
      {
        'P::a': snapshot(95, { title: 'small' }),
        'P::b': snapshot(50, { title: 'big' }),
        'P::c': snapshot(7, { title: 'mid' }),
      },
      0,
    );

    expect(result.drops.map(({ title }) => title)).toEqual(['big', 'mid', 'small']);
  });

  it('is unchanged when every price is equal', () => {
    const prices = { 'P::a': snapshot(24), 'P::b': snapshot(10) };

    const result = detectPriceDrops(alert(prices), { ...prices }, 0);

    expect(result.changed).toBe(false);
    expect(result.drops).toEqual([]);
  });

  it('treats an exchange-rate-only change as no change', () => {
    const before = collectNativePrices(baseProduct({ usdPrice: 24 }));
    const after = collectNativePrices(baseProduct({ usdPrice: 22 }));

    const result = detectPriceDrops(
      { id: productSeriesKey(baseProduct())!, lastPrices: before },
      after,
      0,
    );

    expect(result.changed).toBe(false);
    expect(result.drops).toEqual([]);
  });
});
