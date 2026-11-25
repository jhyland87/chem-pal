import { getErrorMessage } from '@/helpers/exceptions';
import { isPriceAlertKey, loadPriceAlerts, type PriceAlert } from '@/helpers/priceAlerts';
import { Logger } from '@/utils/Logger';
import { cstorage, type ChangedListener } from '@/utils/storage';
import { useEffect, useState } from 'react';

const logger = new Logger('usePriceAlerts');

/** A running subscription to the price alerts. */
interface PriceAlertsWatch {
  /** Resolves once the first load is done, even if it failed. */
  ready: Promise<void>;
  /** Ends the subscription. */
  stop: () => void;
}

/**
 * Loads the user's price alerts, now and whenever any page or the background worker changes them.
 * @category Hooks
 * @group Price Alerts
 * @param onLoad - Receives the alerts, newest first
 * @returns The subscription
 * @example
 * ```ts
 * const { stop } = watchPriceAlerts((alerts) => setAlerts(alerts));
 * ```
 * @source
 */
export function watchPriceAlerts(onLoad: (alerts: PriceAlert[]) => void): PriceAlertsWatch {
  let isActive = true;
  const load = async () => {
    try {
      const loaded = await loadPriceAlerts();
      if (isActive) onLoad(loaded);
    } catch (error) {
      logger.warn(`Failed to load price alerts: ${getErrorMessage(error)}`, { error });
    }
  };
  const handleChange: ChangedListener = (changes, areaName) => {
    if (areaName === 'local' && Object.keys(changes).some(isPriceAlertKey)) void load();
  };

  const ready = load();
  cstorage.onChanged.addListener(handleChange);
  return {
    ready,
    stop: () => {
      isActive = false;
      cstorage.onChanged.removeListener(handleChange);
    },
  };
}

/**
 * The user's price alerts, kept up to date as any page or the background worker changes them.
 * @category Hooks
 * @group Price Alerts
 * @returns The alerts, newest first; empty until they have loaded
 * @example
 * ```ts
 * const alerts = usePriceAlerts();
 * const isWatched = alerts.some(({ id }) => id === productSeriesKey(product));
 * ```
 * @source
 */
export function usePriceAlerts(): PriceAlert[] {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  useEffect(() => watchPriceAlerts(setAlerts).stop, []);

  return alerts;
}
