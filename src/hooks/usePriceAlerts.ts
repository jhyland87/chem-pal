import { getErrorMessage } from '@/helpers/exceptions';
import { isPriceAlertKey, loadPriceAlerts, type PriceAlert } from '@/helpers/priceAlerts';
import { Logger } from '@/utils/Logger';
import { cstorage, type ChangedListener } from '@/utils/storage';
import { useEffect, useState } from 'react';

const logger = new Logger('usePriceAlerts');

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

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const loaded = await loadPriceAlerts();
        if (isMounted) setAlerts(loaded);
      } catch (error) {
        logger.warn(`Failed to load price alerts: ${getErrorMessage(error)}`, { error });
      }
    };
    const handleChange: ChangedListener = (changes, areaName) => {
      if (areaName === 'local' && Object.keys(changes).some(isPriceAlertKey)) void load();
    };

    void load();
    cstorage.onChanged.addListener(handleChange);
    return () => {
      isMounted = false;
      cstorage.onChanged.removeListener(handleChange);
    };
  }, []);

  return alerts;
}
