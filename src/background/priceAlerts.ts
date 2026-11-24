/**
 * Background price checks: refetches watched products on a schedule, logs price changes and shows a
 * notification when one gets cheaper.
 *
 * @module
 * @category Background
 * @group Price Alerts
 */
import { priceAlerts as priceAlertsConfig } from '@/../config.json';
import { CACHE, PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { runInBackgroundContext } from '@/helpers/backgroundFetch';
import { getErrorMessage } from '@/helpers/exceptions';
import { patchCachedProduct } from '@/helpers/patchCachedProduct';
import { hasHostPermissions } from '@/helpers/permissions';
import { formatWithSymbol } from '@/helpers/price';
import {
  collectNativePrices,
  detectPriceDrops,
  isPriceAlertKey,
  loadPriceAlerts,
  resolvePriceAlertSettings,
  updatePriceAlert,
  type PriceAlert,
  type PriceDrop,
} from '@/helpers/priceAlerts';
import { recordProductPrices } from '@/helpers/priceHistory';
import { toProductRef, type ProductRefreshResult } from '@/helpers/productRef';
import * as priceAlertSuppliers from '@/suppliers/priceAlertSuppliers';
import { Logger } from '@/utils/Logger';
import { cstorage } from '@/utils/storage';
import { disableStatsRecording } from '@/utils/SupplierStatsStore';
import { isValidUserSettings } from '@/utils/typeGuards/common';
import { Queue } from 'async-await-queue';

const logger = new Logger('priceAlerts');

/** Alarm that starts a check at the user's interval. */
export const CHECK_ALARM = 'price_alerts_check';

/** Alarm that repeats while a check is running, to continue it if the worker is shut down. */
export const RESUME_ALARM = 'price_alerts_resume';

/** Prefix of a notification's id, followed by the alert's id. */
const NOTIFICATION_PREFIX = 'price_alert:';

/** Id of the notification that sums up several drops at one supplier, followed by its name. */
const SUMMARY_PREFIX = 'price_alerts:';

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

/** The check in progress, if any. */
let activeRun: Promise<void> | undefined;

/** A watched product whose price dropped. */
interface AlertDrops {
  alert: PriceAlert;
  drops: PriceDrop[];
}

/**
 * Reads the user's settings.
 * @returns The stored settings, or none when they are missing or invalid
 * @example
 * ```ts
 * await readSettings(); // { priceAlerts: { checkIntervalHours: 12 }, … }
 * ```
 * @source
 */
async function readSettings(): Promise<UserSettings> {
  const stored: unknown = (await cstorage.local.get(CACHE.USER_SETTINGS))[CACHE.USER_SETTINGS];
  return stored !== undefined && isValidUserSettings(stored) ? stored : {};
}

/**
 * Matches the check alarm to the watchlist and settings: none when nothing is watched, otherwise one
 * that first fires when the longest-unchecked product is due. Safe to call repeatedly.
 * @returns Resolves once the alarm is up to date
 * @example
 * ```ts
 * await scheduleChecks();
 * ```
 * @source
 */
export async function scheduleChecks(): Promise<void> {
  const alerts = await loadPriceAlerts();
  if (alerts.length === 0) {
    await chrome.alarms.clear(CHECK_ALARM);
    await chrome.alarms.clear(RESUME_ALARM);
    return;
  }

  const { checkIntervalHours } = resolvePriceAlertSettings(await readSettings());
  const periodInMinutes = checkIntervalHours * MINUTES_PER_HOUR;
  const existing = await chrome.alarms.get(CHECK_ALARM);
  if (existing?.periodInMinutes === periodInMinutes) return;

  const oldestCheck = Math.min(...alerts.map(({ lastCheckedAt }) => lastCheckedAt ?? 0));
  const minutesSince = (Date.now() - oldestCheck) / MS_PER_MINUTE;
  await chrome.alarms.create(CHECK_ALARM, {
    delayInMinutes: Math.max(priceAlertsConfig.resumeDelayMinutes, periodInMinutes - minutesSince),
    periodInMinutes,
  });
}

/**
 * Checks every product that is due. A call while a check is running waits for that one.
 * @returns Resolves once the check is finished
 * @example
 * ```ts
 * await runPriceCheck();
 * ```
 * @source
 */
export async function runPriceCheck(): Promise<void> {
  activeRun ??= checkDueProducts();
  try {
    await activeRun;
  } finally {
    activeRun = undefined;
  }
}

/**
 * Checks the products that are due, grouped by supplier. An alert counts as due after half an
 * interval, so an alarm that fires a little early doesn't skip it.
 * @returns Resolves once every supplier is done
 * @example
 * ```ts
 * await checkDueProducts();
 * ```
 * @source
 */
async function checkDueProducts(): Promise<void> {
  const settings = await readSettings();
  const { checkIntervalHours } = resolvePriceAlertSettings(settings);
  const dueBefore = Date.now() - (checkIntervalHours * MINUTES_PER_HOUR * MS_PER_MINUTE) / 2;
  const due = (await loadPriceAlerts()).filter((alert) => (alert.lastCheckedAt ?? 0) <= dueBefore);
  if (due.length === 0) {
    await chrome.alarms.clear(RESUME_ALARM);
    return;
  }

  // The worker is shut down after 30 idle seconds; any extension API call resets that.
  const keepAlive = setInterval(
    () => void chrome.runtime.getPlatformInfo(),
    priceAlertsConfig.keepAliveSeconds * 1000,
  );
  try {
    await chrome.alarms.create(RESUME_ALARM, {
      periodInMinutes: priceAlertsConfig.resumeDelayMinutes,
    });
    const queue = new Queue(priceAlertsConfig.supplierConcurrency);
    const suppliers = new Set(due.map(({ supplier }) => supplier));
    await Promise.all(
      [...suppliers].map((supplier) =>
        queue.run(() =>
          checkSupplier(
            supplier,
            due.filter((alert) => alert.supplier === supplier),
            settings,
          ),
        ),
      ),
    );
  } finally {
    clearInterval(keepAlive);
    await chrome.alarms.clear(RESUME_ALARM);
  }
}

/**
 * Checks one supplier's watched products and notifies about the drops. Never rejects, so one
 * supplier can't stop the others.
 * @param supplierName - Display name of the supplier
 * @param alerts - Its alerts that are due
 * @param settings - The user's settings
 * @returns Resolves once the alerts are updated
 * @example
 * ```ts
 * await checkSupplier('Carolina Chemical', alerts, settings);
 * ```
 * @source
 */
async function checkSupplier(
  supplierName: string,
  alerts: PriceAlert[],
  settings: UserSettings,
): Promise<void> {
  try {
    // Stamped first, so a product that keeps crashing the worker isn't retried every minute.
    const lastCheckedAt = Date.now();
    await Promise.all(alerts.map(({ id }) => updatePriceAlert(id, { lastCheckedAt })));

    const results = await refreshAlerts(supplierName, alerts);
    const found: AlertDrops[] = [];
    for (const [index, alert] of alerts.entries()) {
      try {
        const drops = await applyResult(alert, results[index], settings);
        if (drops.length > 0) found.push({ alert, drops });
      } catch (error) {
        // The drops already found are saved as the new prices, so they must still be reported.
        logger.error(`Failed to apply a refreshed price: ${getErrorMessage(error)}`, {
          error,
          supplier: supplierName,
          title: alert.title,
        });
      }
    }
    await notifyDrops(supplierName, found);
  } catch (error) {
    logger.error(`Failed to check prices: ${getErrorMessage(error)}`, {
      error,
      supplier: supplierName,
    });
  }
}

/**
 * Refetches a supplier's watched products.
 * @param supplierName - Display name of the supplier
 * @param alerts - The alerts to refetch
 * @returns One result per alert
 * @example
 * ```ts
 * await refreshAlerts('Carolina Chemical', alerts); // [{ status: 'ok', ref, product }]
 * ```
 * @source
 */
async function refreshAlerts(
  supplierName: string,
  alerts: PriceAlert[],
): Promise<ProductRefreshResult[]> {
  const failAll = (reason: string): ProductRefreshResult[] =>
    alerts.map(({ ref }) => ({ status: PRODUCT_REFRESH_STATUS.FAILED, ref, reason }));

  const Supplier = Object.values(priceAlertSuppliers).find(
    (candidate) => candidate.supplierName === supplierName,
  );
  if (!Supplier) return failAll('Supplier is no longer supported');
  if (!(await hasHostPermissions(Supplier.requiredHosts))) return failAll('No host permission');

  const supplier = new Supplier('', alerts.length, new AbortController());
  // Cached product data has no expiry and would replace the fresh prices.
  supplier.initCache(false);
  return supplier.refreshProducts(alerts.map(({ ref }) => ref));
}

/**
 * Applies a refetched product: updates its alert, its cached copies and its price history.
 * @param alert - The alert
 * @param result - The product's result
 * @param settings - The user's settings
 * @returns The drops to notify about; none when the alert was removed in the meantime
 * @example
 * ```ts
 * await applyResult(alert, result, settings); // [{ title: 'Acetone 500 g', from: 24, to: 19.5 }]
 * ```
 * @source
 */
async function applyResult(
  alert: PriceAlert,
  result: ProductRefreshResult,
  settings: UserSettings,
): Promise<PriceDrop[]> {
  const { status: lastStatus } = result;
  switch (result.status) {
    case PRODUCT_REFRESH_STATUS.OK:
      break;
    case PRODUCT_REFRESH_STATUS.UNAVAILABLE:
      await updatePriceAlert(alert.id, { lastStatus, failures: 0 });
      return [];
    case PRODUCT_REFRESH_STATUS.FAILED:
      logger.warn('Failed to refresh a watched product', {
        reason: result.reason,
        supplier: alert.supplier,
        title: alert.title,
      });
      await updatePriceAlert(alert.id, { lastStatus, failures: alert.failures + 1 });
      return [];
    default:
      return result satisfies never;
  }

  const { product } = result;
  const { minDropPercent } = resolvePriceAlertSettings(settings);
  const { drops, changed, lastPrices } = detectPriceDrops(
    alert,
    collectNativePrices(product),
    minDropPercent,
  );
  await patchCachedProduct(product);
  // Exchange rates move the recorded USD price on their own, so only log real changes.
  if (changed) await recordProductPrices([product], settings);

  const [largest] = drops;
  const isWatched = await updatePriceAlert(alert.id, {
    lastStatus,
    failures: 0,
    lastPrices,
    ref: toProductRef(product) ?? alert.ref,
    ...(largest && { lastDrop: { ...largest, at: Date.now() } }),
  });
  return isWatched ? drops : [];
}

/**
 * Formats a drop for a notification.
 * @param drop - The drop
 * @returns The title with both prices, in the supplier's currency
 * @example
 * ```ts
 * describeDrop({ title: 'Acetone 500 g', from: 24, to: 19.5, currencyCode: 'USD' });
 * // 'Acetone 500 g: $24.00 → $19.50'
 * ```
 * @source
 */
function describeDrop({ title, from, to, currencyCode = 'USD' }: PriceDrop): string {
  return `${title}: ${formatWithSymbol(currencyCode, from)} → ${formatWithSymbol(currencyCode, to)}`;
}

/**
 * Shows the drops found at one supplier: a notification per product, or a single one when there are
 * many. Does nothing without the optional permission; the settings page still shows the drops.
 * @param supplierName - Display name of the supplier
 * @param found - The products whose price dropped
 * @returns Resolves once the notifications are shown
 * @example
 * ```ts
 * await notifyDrops('Carolina Chemical', [{ alert, drops }]);
 * ```
 * @source
 */
async function notifyDrops(supplierName: string, found: AlertDrops[]): Promise<void> {
  if (found.length === 0) return;
  // Undefined until the optional permission is granted.
  if (!chrome.notifications) return;

  const base = {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('static/images/logo/ChemPal-logo-128.png'),
    title: chrome.i18n.getMessage('price_alert_notification_title', [supplierName]),
  } as const;

  if (found.length > priceAlertsConfig.maxNotificationsPerSupplier) {
    await chrome.notifications.create(`${SUMMARY_PREFIX}${supplierName}`, {
      ...base,
      message: found.map(({ drops: [largest] }) => describeDrop(largest)).join('\n'),
    });
    return;
  }

  for (const { alert, drops } of found) {
    await chrome.notifications.create(`${NOTIFICATION_PREFIX}${alert.id}`, {
      ...base,
      message: drops.map(describeDrop).join('\n'),
    });
  }
}

/**
 * Opens the page a clicked notification is about: the product, or the supplier's products in
 * ChemPal when it sums up several.
 * @param notificationId - Id of the notification
 * @param openApp - Opens ChemPal
 * @returns Resolves once the page is open
 * @example
 * ```ts
 * await openNotification('price_alert:3f9c2a', openApp);
 * ```
 * @source
 */
async function openNotification(
  notificationId: string,
  openApp: () => Promise<void>,
): Promise<void> {
  if (notificationId.startsWith(SUMMARY_PREFIX)) {
    await openApp();
  } else if (notificationId.startsWith(NOTIFICATION_PREFIX)) {
    const id = notificationId.slice(NOTIFICATION_PREFIX.length);
    const alert = (await loadPriceAlerts()).find((candidate) => candidate.id === id);
    if (alert?.permalink) await chrome.tabs.create({ url: alert.permalink });
  } else {
    return;
  }
  await chrome.notifications.clear(notificationId);
}

/**
 * Runs a task started by a browser event, where nothing is there to catch an error.
 * @param action - What the task does, for the log message
 * @param task - The task
 * @returns Resolves once the task is done; never rejects
 * @example
 * ```ts
 * await logFailure('check prices', runPriceCheck);
 * ```
 * @source
 */
async function logFailure(action: string, task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    logger.error(`Failed to ${action}: ${getErrorMessage(error)}`, { error });
  }
}

/**
 * Registers the price check listeners. Must be called synchronously when the worker starts, or the
 * event that woke it is missed.
 * @param openApp - Opens ChemPal, for a notification that isn't about a single product
 * @example
 * ```ts
 * registerPriceAlerts(() => openOrFocusExtensionTab(url));
 * ```
 * @source
 */
export function registerPriceAlerts(openApp: () => Promise<void>): void {
  runInBackgroundContext();
  disableStatsRecording();

  const schedule = (): void => void logFailure('schedule price checks', scheduleChecks);
  chrome.runtime.onInstalled.addListener(schedule);
  chrome.runtime.onStartup.addListener(schedule);

  cstorage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    // Alerts being added or removed, but not the updates made by a check.
    const isRelevant = Object.entries(changes).some(
      ([key, { oldValue, newValue }]) =>
        key === CACHE.USER_SETTINGS ||
        (isPriceAlertKey(key) && (oldValue === undefined || newValue === undefined)),
    );
    if (isRelevant) schedule();
  });

  chrome.alarms.onAlarm.addListener(({ name }) => {
    if (name === CHECK_ALARM || name === RESUME_ALARM) {
      void logFailure('check prices', runPriceCheck);
    }
  });

  const handleClick = (id: string): void =>
    void logFailure('open a notification', () => openNotification(id, openApp));
  // The API appears when the optional permission is granted, possibly while the worker is running.
  const listenForClicks = (): void => chrome.notifications?.onClicked.addListener(handleClick);
  listenForClicks();
  chrome.permissions.onAdded.addListener(listenForClicks);
}
