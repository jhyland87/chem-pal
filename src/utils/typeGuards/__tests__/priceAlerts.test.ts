import { isPriceAlert } from '../priceAlerts';
import { describe, expect, it } from 'vitest';

const validAlert = () => ({
  id: '3f9c2a',
  supplier: 'Loudwolf',
  title: 'Acetone',
  createdAt: 1,
  failures: 0,
  lastPrices: { '3f9c2a': { title: 'Acetone', price: 24, currencyCode: 'USD' } },
  ref: { cacheKey: 'ck-1', title: 'Acetone', url: 'https://loudwolf.com/a', variants: [] },
});

describe('isPriceAlert', () => {
  it('accepts a complete alert, with or without optional fields', () => {
    expect(isPriceAlert(validAlert())).toBe(true);
    expect(
      isPriceAlert({
        ...validAlert(),
        permalink: 'https://loudwolf.com/p',
        lastCheckedAt: 5,
        lastStatus: 'ok',
        lastDrop: { title: 'Acetone', from: 24, to: 20, at: 9 },
        lastPrices: { x: { title: 'A', price: 1 } },
      }),
    ).toBe(true);
  });

  it.each([null, undefined, 'text', 5, []])('rejects %j', (value) => {
    expect(isPriceAlert(value)).toBe(false);
  });

  it.each(['id', 'supplier', 'title', 'createdAt', 'failures', 'lastPrices', 'ref'])(
    'rejects an alert missing %s',
    (field) => {
      const { [field]: _removed, ...rest } = validAlert() as Record<string, unknown>;
      expect(isPriceAlert(rest)).toBe(false);
    },
  );

  it('rejects wrongly typed fields', () => {
    expect(isPriceAlert({ ...validAlert(), failures: '0' })).toBe(false);
    expect(isPriceAlert({ ...validAlert(), createdAt: '1' })).toBe(false);
  });

  it('rejects a malformed price snapshot', () => {
    expect(isPriceAlert({ ...validAlert(), lastPrices: { a: { title: 'A', price: '5' } } })).toBe(
      false,
    );
    expect(isPriceAlert({ ...validAlert(), lastPrices: { a: { price: 5 } } })).toBe(false);
  });

  it('rejects a malformed ref', () => {
    const ref = validAlert().ref;
    expect(isPriceAlert({ ...validAlert(), ref: { ...ref, cacheKey: 1 } })).toBe(false);
    expect(isPriceAlert({ ...validAlert(), ref: { ...ref, variants: undefined } })).toBe(false);
  });
});
