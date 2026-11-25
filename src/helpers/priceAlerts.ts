/**
 * The price alert watchlist, and the rules for what counts as a price drop. Price changes
 * themselves are logged in the price history; an alert only remembers the latest prices.
 *
 * @module
 * @category Helpers
 * @group Price Alerts
 */
import { defaultSettings, priceAlerts as priceAlertsConfig } from '@/../config.json';
import { CACHE, type ProductRefreshStatus } from '@/constants/common';
import { trackEvent } from '@/helpers/analytics';
import {
  isRecordablePrice,
  productSeriesKey,
  round2,
  variantSeriesKey,
} from '@/helpers/priceHistory';
import { samePurchasableUnit, variantRowTitle } from '@/helpers/product';
import { toProductRef, type ProductRef } from '@/helpers/productRef';
import { toFiniteNumber } from '@/helpers/utils';
import { cstorage } from '@/utils/storage';
import { isPriceAlert } from '@/utils/typeGuards/priceAlerts';

/**
 * A price as the supplier lists it. Kept in the native currency, so a change in exchange rate can't
 * look like a drop.
 * @category Helpers
 * @group Price Alerts
 * @source
 */
export type PriceSnapshot = Pick<Variant, 'currencyCode' | 'quantity' | 'uom'> & {
  /** Title of the product or size. */
  title: string;
  /** Native-currency price. */
  price: number;
};

/**
 * One price that went down.
 * @category Helpers
 * @group Price Alerts
 * @source
 */
export interface PriceDrop {
  /** Title of the product or size. */
  title: string;
  /** Price before. */
  from: number;
  /** Price now. */
  to: number;
  /** Currency of both prices. */
  currencyCode?: string;
}

/**
 * A watched product.
 * @category Helpers
 * @group Price Alerts
 * @source
 */
export interface PriceAlert {
  /** The product's {@link productSeriesKey}. */
  id: string;
  /** Display name of the supplier. */
  supplier: string;
  /** What is needed to refetch the product. */
  ref: ProductRef;
  /** Product title. */
  title: string;
  /** Page to open for the product. */
  permalink?: string;
  /** When the alert was added, in epoch ms. */
  createdAt: number;
  /** When the product was last checked, in epoch ms. */
  lastCheckedAt?: number;
  /** Failed checks in a row. */
  failures: number;
  /** How the last check ended. */
  lastStatus?: ProductRefreshStatus;
  /** Prices to compare the next check against, by price-history series id. */
  lastPrices: Record<string, PriceSnapshot>;
  /** The latest drop found. */
  lastDrop?: PriceDrop & { at: number };
  /** Whether the user hasn't seen {@link lastDrop} yet. */
  hasUnseenDrop?: boolean;
}

/**
 * The result of comparing fresh prices with an alert's last known ones.
 * @category Helpers
 * @group Price Alerts
 * @source
 */
export interface PriceComparison {
  /** The prices that dropped far enough to report, largest drop first. */
  drops: PriceDrop[];
  /** Whether any native price differs from the last known one. */
  changed: boolean;
  /** Prices to compare the next check against. */
  lastPrices: Record<string, PriceSnapshot>;
}

/**
 * Storage key of an alert. Each has its own, so the page and the background worker never overwrite
 * each other's changes to different alerts.
 * @param id - The alert's id
 * @returns The storage key
 * @example
 * ```ts
 * priceAlertKey('3f9c2a'); // 'price_alert:3f9c2a'
 * ```
 * @source
 */
function priceAlertKey(id: string): string {
  return `${CACHE.PRICE_ALERT}:${id}`;
}

/**
 * Whether a storage key holds a price alert, for change listeners.
 * @category Helpers
 * @group Price Alerts
 * @param key - The storage key
 * @returns True for an alert's key
 * @example
 * ```ts
 * isPriceAlertKey('price_alert:3f9c2a'); // true
 * isPriceAlertKey('user_settings'); // false
 * ```
 * @source
 */
export function isPriceAlertKey(key: string): boolean {
  return key.startsWith(priceAlertKey(''));
}

/**
 * Reads every price alert.
 * @category Helpers
 * @group Price Alerts
 * @returns The alerts, newest first
 * @example
 * ```ts
 * await loadPriceAlerts(); // [{ id: '3f9c2a', title: 'Acetone', … }]
 * ```
 * @source
 */
export async function loadPriceAlerts(): Promise<PriceAlert[]> {
  const stored: Record<string, unknown> = await cstorage.local.get(null);
  return Object.entries(stored)
    .flatMap(([key, value]) => (isPriceAlertKey(key) && isPriceAlert(value) ? [value] : []))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Starts watching a product. Storage is called before anything is awaited, so the write survives
 * the popup closing right after.
 * @category Helpers
 * @group Price Alerts
 * @param product - The product, with all its sizes
 * @returns Whether it could be watched
 * @example
 * ```ts
 * await addPriceAlert(product); // true
 * await addPriceAlert({ ...product, cacheKey: undefined }); // false
 * ```
 * @source
 */
export async function addPriceAlert(product: Product): Promise<boolean> {
  const id = productSeriesKey(product);
  const ref = toProductRef(product);
  if (!id || !ref) return false;

  const alert: PriceAlert = {
    id,
    supplier: product.supplier,
    ref,
    title: product.title,
    permalink: product.permalink ?? product.url,
    createdAt: Date.now(),
    failures: 0,
    lastPrices: collectNativePrices(product),
  };
  await cstorage.local.set({ [priceAlertKey(id)]: alert });
  void trackEvent('price_alert_created', { supplier: alert.supplier });
  return true;
}

/**
 * Applies changes to an alert, unless it was removed in the meantime.
 * @category Helpers
 * @group Price Alerts
 * @param id - The alert's id
 * @param changes - The fields to change
 * @returns Whether the alert still exists
 * @example
 * ```ts
 * await updatePriceAlert(alert.id, { lastCheckedAt: Date.now(), failures: 0 });
 * ```
 * @source
 */
export async function updatePriceAlert(
  id: string,
  changes: Partial<Omit<PriceAlert, 'id'>>,
): Promise<boolean> {
  const key = priceAlertKey(id);
  const current: unknown = (await cstorage.local.get(key))[key];
  if (!isPriceAlert(current)) return false;
  await cstorage.local.set({ [key]: { ...current, ...changes } });
  return true;
}

/**
 * Picks the alerts with a drop the user hasn't seen.
 * @category Helpers
 * @group Price Alerts
 * @param alerts - The alerts
 * @returns Those with an unseen drop
 * @example
 * ```ts
 * getUnseenDrops(await loadPriceAlerts()).length; // 2
 * ```
 * @source
 */
export function getUnseenDrops(alerts: readonly PriceAlert[]): PriceAlert[] {
  return alerts.filter(({ hasUnseenDrop }) => hasUnseenDrop);
}

/**
 * Marks products' latest drops as seen, so the badge stops counting them.
 * @category Helpers
 * @group Price Alerts
 * @param alerts - The alerts; those without an unseen drop are left alone
 * @returns Resolves once they are updated
 * @example
 * ```ts
 * await markDropsSeen(alerts);
 * ```
 * @source
 */
export async function markDropsSeen(alerts: readonly PriceAlert[]): Promise<void> {
  await Promise.all(
    getUnseenDrops(alerts).map(({ id }) => updatePriceAlert(id, { hasUnseenDrop: false })),
  );
}

/**
 * Stops watching products.
 * @category Helpers
 * @group Price Alerts
 * @param ids - The alerts' ids
 * @returns Resolves once they are removed
 * @example
 * ```ts
 * await removePriceAlerts(['3f9c2a']);
 * ```
 * @source
 */
export async function removePriceAlerts(ids: readonly string[]): Promise<void> {
  const keys = ids.map(priceAlertKey);
  const stored: Record<string, unknown> = await cstorage.local.get(keys);
  await cstorage.local.remove(keys);
  for (const { supplier } of Object.values(stored).filter(isPriceAlert)) {
    void trackEvent('price_alert_removed', { supplier });
  }
}

/**
 * Reads a numeric setting. Its input stores a string, and may hold anything.
 * @param value - The stored setting
 * @param fallback - Value to use when it isn't a number
 * @param min - Smallest allowed value
 * @param max - Largest allowed value
 * @returns The setting, kept within the limits
 * @example
 * ```ts
 * clampSetting('500', 12, 1, 168); // 168
 * clampSetting('', 12, 1, 168); // 12
 * ```
 * @source
 */
function clampSetting(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = toFiniteNumber(String(value ?? '')) ?? fallback;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * The price alert settings, with defaults and limits applied.
 * @category Helpers
 * @group Price Alerts
 * @param settings - The user's settings
 * @returns Hours between checks, and the smallest drop to report as a percentage
 * @example
 * ```ts
 * resolvePriceAlertSettings({}); // { checkIntervalHours: 12, minDropPercent: 0 }
 * ```
 * @source
 */
export function resolvePriceAlertSettings(
  settings: UserSettings | undefined,
): Required<PriceAlertSettings> {
  const { checkIntervalHours, minDropPercent } = priceAlertsConfig;
  const defaults = defaultSettings.priceAlerts;
  return {
    checkIntervalHours: clampSetting(
      settings?.priceAlerts?.checkIntervalHours,
      defaults.checkIntervalHours,
      checkIntervalHours.min,
      checkIntervalHours.max,
    ),
    minDropPercent: clampSetting(
      settings?.priceAlerts?.minDropPercent,
      defaults.minDropPercent,
      minDropPercent.min,
      minDropPercent.max,
    ),
  };
}

/**
 * Collects a product's prices by price-history series: each size, plus the headline when no size
 * has its price. Sizes that can't be told apart are left out, since their order may change.
 * @category Helpers
 * @group Price Alerts
 * @param product - The product, with all its sizes
 * @returns Prices by series id
 * @example
 * ```ts
 * collectNativePrices(product); // { '3f9c2a::500g': { title: 'Acetone 500 g', price: 24, … } }
 * ```
 * @source
 */
export function collectNativePrices(product: Product): Record<string, PriceSnapshot> {
  const prices: Record<string, PriceSnapshot> = {};
  const ambiguous = new Set<string>();

  for (const variant of product.variants ?? []) {
    const id = variantSeriesKey(product, variant);
    if (id === undefined || !isRecordablePrice(variant.price)) continue;
    if (id in prices) ambiguous.add(id);
    prices[id] = {
      title: variantRowTitle(product, variant),
      price: round2(variant.price),
      currencyCode: variant.currencyCode ?? product.currencyCode,
      quantity: variant.quantity,
      uom: variant.uom,
    };
  }
  for (const id of ambiguous) delete prices[id];
  const variantPrices = new Set(Object.values(prices).map(({ price }) => price));

  const id = productSeriesKey(product);
  if (id === undefined || !isRecordablePrice(product.price)) return prices;
  const price = round2(product.price);
  if (variantPrices.has(price)) return prices;

  prices[id] = {
    title: product.title,
    price,
    currencyCode: product.currencyCode,
    quantity: product.quantity,
    uom: product.uom,
  };
  return prices;
}

/**
 * Whether two prices can be compared: same currency and, for a headline price, the same pack size.
 * Suppliers promote a different size to the headline as stock changes.
 * @param previous - The last known price
 * @param current - The fresh price
 * @param isHeadline - Whether this is the product's headline price
 * @returns True when comparable
 * @example
 * ```ts
 * isComparable({ price: 9, currencyCode: 'USD', … }, { price: 8, currencyCode: 'EUR', … }, false); // false
 * ```
 * @source
 */
function isComparable(
  previous: PriceSnapshot,
  current: PriceSnapshot,
  isHeadline: boolean,
): boolean {
  if (previous.currencyCode !== current.currencyCode) return false;
  return !isHeadline || samePurchasableUnit(previous, current);
}

/**
 * How far a price went down.
 * @category Helpers
 * @group Price Alerts
 * @param drop - The prices before and after
 * @returns The drop as a percentage of the earlier price
 * @example
 * ```ts
 * dropPercent({ from: 24, to: 18 }); // 25
 * ```
 * @source
 */
export function dropPercent({ from, to }: Pick<PriceDrop, 'from' | 'to'>): number {
  return ((from - to) / from) * 100;
}

/**
 * Compares fresh prices with an alert's last known ones.
 *
 * @remarks
 * A price seen for the first time, or no longer comparable, becomes the new baseline without a
 * drop. A drop below the threshold leaves the baseline alone, so small drops add up. Prices that
 * are missing this time keep their baseline.
 *
 * @category Helpers
 * @group Price Alerts
 * @param alert - The alert
 * @param current - Fresh prices from {@link collectNativePrices}
 * @param minDropPercent - Smallest drop to report
 * @returns The drops and the new baseline
 * @example
 * ```ts
 * detectPriceDrops(alert, collectNativePrices(product), 5).drops;
 * // [{ title: 'Acetone 500 g', from: 24, to: 19.5, currencyCode: 'USD' }]
 * ```
 * @source
 */
export function detectPriceDrops(
  alert: Pick<PriceAlert, 'id' | 'lastPrices'>,
  current: Record<string, PriceSnapshot>,
  minDropPercent: number,
): PriceComparison {
  const lastPrices = { ...alert.lastPrices };
  const drops: PriceDrop[] = [];
  let changed = false;

  for (const [id, fresh] of Object.entries(current)) {
    const previous = alert.lastPrices[id];
    if (!previous || !isComparable(previous, fresh, id === alert.id)) {
      lastPrices[id] = fresh;
      changed = true;
      continue;
    }

    const { price: from, currencyCode } = previous;
    const { price: to, title } = fresh;
    if (from !== to) changed = true;

    if (to < from) {
      if (dropPercent({ from, to }) < minDropPercent) continue;
      drops.push({ title, from, to, currencyCode });
    }
    lastPrices[id] = fresh;
  }

  drops.sort((a, b) => a.to / a.from - b.to / b.from);
  return { drops, changed, lastPrices };
}
