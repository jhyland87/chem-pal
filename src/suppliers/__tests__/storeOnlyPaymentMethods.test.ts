import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from '@/__fixtures__/helpers/chrome/storageMock';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as suppliers from '..';
import { SupplierBase } from '../SupplierBase';

beforeAll(() => {
  setupChromeStorageMock();
});

beforeEach(() => {
  resetChromeStorageMock();
});

const controller = new AbortController();

const instances = Object.entries(suppliers).map(([name, SupplierClass]) => {
  const Cls = SupplierClass as unknown as new (
    query: string,
    limit: number,
    controller: AbortController,
  ) => SupplierBase<unknown, Product>;
  return [name, new Cls('', 1, controller)] as const;
});

const isHttpsURL = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * A supplier that declares "ebayonly"/"amazononly" is telling the UI to point users at a
 * marketplace storefront instead of its own site — which needs a URL to point at. TypeScript
 * can't make a property conditional on an array's contents, so the pairing is enforced here.
 */
describe('marketplace-only payment methods', () => {
  it.each(instances)("%s: 'ebayonly' implies a usable ebayStoreURL", (_name, instance) => {
    if (!instance.paymentMethods.includes('ebayonly')) return;
    expect(isHttpsURL(instance.ebayStoreURL)).toBe(true);
  });

  it.each(instances)("%s: 'amazononly' implies a usable amazonStoreURL", (_name, instance) => {
    if (!instance.paymentMethods.includes('amazononly')) return;
    expect(isHttpsURL(instance.amazonStoreURL)).toBe(true);
  });

  // Guards the guard: both assertions above early-return for non-matching suppliers, so if the
  // enumeration broke or paymentMethods came back empty, every case would pass vacuously.
  it('covers at least one supplier of each marketplace-only kind', () => {
    expect(instances.some(([, i]) => i.paymentMethods.includes('ebayonly'))).toBe(true);
    expect(instances.some(([, i]) => i.paymentMethods.includes('amazononly'))).toBe(true);
  });

  // A store URL without its payment method never reaches the UI, since SupplierBase only stamps
  // the URL when the method is present. The URL is valid alongside either the "*only" method
  // (restriction notice) or the plain "ebay"/"amazon" method (informational "more products"
  // notice). Catches a half-finished supplier config.
  it.each(instances)('%s: a store URL is paired with its payment method', (_name, instance) => {
    if (instance.ebayStoreURL !== undefined) {
      expect(
        instance.paymentMethods.includes('ebay') || instance.paymentMethods.includes('ebayonly'),
      ).toBe(true);
    }
    if (instance.amazonStoreURL !== undefined) {
      expect(
        instance.paymentMethods.includes('amazon') ||
          instance.paymentMethods.includes('amazononly'),
      ).toBe(true);
    }
  });
});
